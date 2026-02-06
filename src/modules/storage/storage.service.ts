import { Injectable, Logger, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID, createHash } from 'node:crypto'
import type { StorageAppConfig } from '../../config/storage.config.js'

import {
  FileInfo,
  CreateFileParams,
  FileOperationResult,
  FileStats,
} from '../../common/interfaces/file.interface.js'
import {
  StorageConfig,
  StorageOperationResult,
  StorageHealth,
  FileSearchParams,
  FileSearchResult,
} from '../../common/interfaces/storage.interface.js'
import { FilenameUtil } from '../../common/utils/filename.util.js'
import { DateUtil } from '../../common/utils/date.util.js'
import { METADATA_PROVIDER } from './metadata.provider.js'
import type { MetadataProvider } from './metadata.provider.js'
import { FILE_STORAGE_PROVIDER, type FileStorageProvider } from './storage-provider.interface.js'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private config!: StorageConfig
  private initialized = false

  constructor(
    private readonly configService: ConfigService,
    @Inject(METADATA_PROVIDER) private readonly metadataProvider: MetadataProvider,
    @Inject(FILE_STORAGE_PROVIDER) private readonly fileStorageProvider: FileStorageProvider
  ) { }

  private getConfig(): StorageConfig {
    if (!this.config) {
      const storageCfg = this.configService.get<StorageAppConfig>('storage')
      this.config = {
        basePath: storageCfg?.basePath || '',
        maxFileSize: storageCfg?.maxFileSize ?? 100 * 1024 * 1024,
        allowedMimeTypes: storageCfg?.allowedMimeTypes ?? [],
        enableDeduplication: storageCfg?.enableDeduplication ?? true,
      } as StorageConfig
    }
    return this.config
  }

  public getConfigForTesting(): StorageConfig {
    return this.getConfig()
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    try {
      await this.metadataProvider.initialize()
      this.initialized = true
      this.logger.log('Storage initialized')
    } catch (error: any) {
      this.logger.error('Failed to initialize storage', error)
      throw new Error(`Storage initialization failed: ${error.message}`)
    }
  }

  async saveFile(params: CreateFileParams): Promise<FileOperationResult> {
    const { file, ttl, metadata = {} } = params
    const config = this.getConfig()

    await this.ensureInitialized()

    const fileId = randomUUID()
    const hash = createHash('sha256')
    
    let size = 0
    let mimeType = file.mimetype
    let firstChunk: Buffer | null = null

    // We still need to process the stream to get hash and size
    // and potentially detect MIME type.
    // However, we want to stream directly to S3 if possible.
    // For deduplication, we might need the hash BEFORE saving to S3, 
    // or we save and then delete if duplicate found.
    // To keep it efficient and support large files, we'll stream to S3 and compute hash on the fly.

    const passThrough = new (await import('node:stream')).PassThrough()
    
    const streamProcessing = new Promise<{ fileHash: string; size: number; detectedMime: string }>((resolve, reject) => {
      file.stream.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > config.maxFileSize) {
          file.stream.emit('error', new Error(`File size ${size} exceeds maximum allowed size ${config.maxFileSize}`))
          return
        }
        if (!firstChunk) firstChunk = chunk
        hash.update(chunk)
        passThrough.write(chunk)
      })

      file.stream.on('error', (err) => {
        passThrough.destroy(err)
        reject(err)
      })

      file.stream.on('end', async () => {
        passThrough.end()
        const fileHash = hash.digest('hex')
        let detectedMime = mimeType

        try {
          if (firstChunk) {
            const { fileTypeFromBuffer } = await import('file-type')
            const detectedType = await fileTypeFromBuffer(firstChunk)
            detectedMime = detectedType?.mime || detectedMime
          }
        } catch (err: any) {
          this.logger.warn(`MIME detection skipped/failed: ${err.message}`)
        }

        resolve({ fileHash, size, detectedMime })
      })
    })

    try {
      // We need the hash for deduplication. If enabled, we might want to check it first.
      // But standard multi-part upload doesn't allow knowing the hash until it's done.
      // For now, we'll upload, get hash, and then check deduplication.
      
      const storageKey = `${fileId}`
      const uploadPromise = this.fileStorageProvider.saveFile(passThrough, storageKey, mimeType)
      
      const [uploadResult, processed] = await Promise.all([uploadPromise, streamProcessing])

      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error }
      }

      const { fileHash, detectedMime } = processed
      mimeType = detectedMime

      // Deduplication check
      if (config.enableDeduplication) {
        const existingFile = await this.metadataProvider.findFileByHash(fileHash)
        if (existingFile) {
          await this.fileStorageProvider.deleteFile(storageKey)
          return {
            success: true,
            data: existingFile
          }
        }
      }

      if (config.allowedMimeTypes.length > 0 && !config.allowedMimeTypes.includes(mimeType)) {
        await this.fileStorageProvider.deleteFile(storageKey)
        return {
          success: false,
          error: `MIME type ${mimeType} is not allowed`
        }
      }

      const safeFilename = FilenameUtil.generateSafeFilename(file.originalname, fileHash)
      const storedFilename = `${fileId}_${safeFilename}`

      const fileInfo: FileInfo = {
        id: fileId,
        originalName: file.originalname,
        storedName: storedFilename,
        mimeType,
        size,
        hash: fileHash,
        uploadedAt: DateUtil.now().toDate(),
        ttl,
        expiresAt: DateUtil.createExpirationDate(ttl),
        filePath: storageKey, // In S3 mode, filePath stores the S3 Key
        metadata
      }

      await this.metadataProvider.saveFileInfo(fileInfo)
      
      this.logger.log(`File saved successfully to S3: ${fileId}`)
      return {
        success: true,
        data: fileInfo
      }

    } catch (error: any) {
      this.logger.error('Failed to save file', error)
      return {
        success: false,
        error: `Failed to save file: ${error.message}`
      }
    }
  }

  async getFileInfo(fileId: string): Promise<FileOperationResult> {
    try {
      await this.ensureInitialized()
      const fileInfo = await this.metadataProvider.getFileInfo(fileId)

      if (!fileInfo) {
        return { success: false, error: `File with ID ${fileId} not found` }
      }

      if (DateUtil.isExpired(fileInfo.expiresAt)) {
        return { success: false, error: `File with ID ${fileId} has expired` }
      }

      return { success: true, data: fileInfo }
    } catch (error: any) {
      this.logger.error(`Failed to get file info for ID: ${fileId}`, error)
      return { success: false, error: `Failed to get file info: ${error.message}` }
    }
  }

  async readFile(fileId: string): Promise<StorageOperationResult<Buffer>> {
    try {
      const fileInfoResult = await this.getFileInfo(fileId)
      if (!fileInfoResult.success) {
        return { success: false, error: fileInfoResult.error }
      }

      const fileInfo = fileInfoResult.data as FileInfo
      return await this.fileStorageProvider.readFile(fileInfo.filePath)
    } catch (error: any) {
      this.logger.error(`Failed to read file with ID: ${fileId}`, error)
      return { success: false, error: `Failed to read file: ${error.message}` }
    }
  }

  async createFileReadStream(fileId: string): Promise<StorageOperationResult<any>> {
    try {
      const fileInfoResult = await this.getFileInfo(fileId)
      if (!fileInfoResult.success) {
        return { success: false, error: fileInfoResult.error }
      }

      const fileInfo = fileInfoResult.data as FileInfo
      return await this.fileStorageProvider.createReadStream(fileInfo.filePath)
    } catch (error: any) {
      this.logger.error(`Failed to create read stream for file with ID: ${fileId}`, error)
      return { success: false, error: `Failed to create read stream: ${error.message}` }
    }
  }

  async deleteFile(fileId: string): Promise<FileOperationResult> {
    try {
      await this.ensureInitialized()
      const fileInfo = await this.metadataProvider.getFileInfo(fileId)

      if (!fileInfo) {
        return { success: false, error: `File with ID ${fileId} not found` }
      }

      await this.fileStorageProvider.deleteFile(fileInfo.filePath)
      await this.metadataProvider.deleteFileInfo(fileId)

      this.logger.log(`File deleted successfully: ${fileId}`)
      return { success: true, data: fileInfo }
    } catch (error: any) {
      this.logger.error(`Failed to delete file with ID: ${fileId}`, error)
      return { success: false, error: `Failed to delete file: ${error.message}` }
    }
  }

  async searchFiles(params: FileSearchParams): Promise<FileSearchResult> {
    try {
      await this.ensureInitialized()
      return await this.metadataProvider.searchFiles(params)
    } catch (error: any) {
      this.logger.error('Failed to search files', error)
      return { files: [], total: 0, params } as FileSearchResult
    }
  }

  async getFileStats(): Promise<FileStats> {
    try {
      await this.ensureInitialized()
      return await this.metadataProvider.getStats()
    } catch (error: any) {
      this.logger.error('Failed to get file stats', error)
      return { totalFiles: 0, totalSize: 0, filesByMimeType: {}, filesByDate: {} }
    }
  }

  async getStorageHealth(): Promise<StorageHealth> {
    try {
      await this.ensureInitialized()
      const stats = await this.metadataProvider.getStats()
      
      const isMetadataHealthy = await this.metadataProvider.isHealthy()
      const isStorageHealthy = await this.fileStorageProvider.isHealthy()

      return {
        isAvailable: isMetadataHealthy && isStorageHealthy,
        freeSpace: 0, // S3 doesn't have a simple "free space" concept
        totalSpace: 0,
        usedSpace: stats.totalSize,
        usagePercentage: 0,
        fileCount: stats.totalFiles,
        lastChecked: new Date(),
      }
    } catch (error: any) {
      this.logger.error('Failed to get storage health', error)
      return {
        isAvailable: false,
        freeSpace: 0,
        totalSpace: 0,
        usedSpace: 0,
        usagePercentage: 0,
        fileCount: 0,
        lastChecked: new Date(),
      }
    }
  }

  async deleteOrphanedFiles(): Promise<{ deleted: number; freed: number }> {
    const startTime = Date.now()
    let deleted = 0
    let freed = 0

    try {
      await this.ensureInitialized()
      const allFileIds = await this.metadataProvider.getAllFileIds()
      const validKeys = new Set<string>()
      
      for (const id of allFileIds) {
        const info = await this.metadataProvider.getFileInfo(id)
        if (info) {
          validKeys.add(info.filePath)
        }
      }

      const allKeys = await this.fileStorageProvider.listAllKeys()
      
      for (const key of allKeys) {
        if (!validKeys.has(key)) {
          // It's an orphan
          await this.fileStorageProvider.deleteFile(key)
          deleted++
          this.logger.warn(`Deleted orphaned S3 object: ${key}`)
        }
      }

      if (deleted > 0) {
        this.logger.log(
          `Orphan cleanup completed: ${deleted} files deleted in ${Date.now() - startTime}ms`
        )
      }

      return { deleted, freed }
    } catch (error: any) {
      this.logger.error('Failed to clean orphaned files', error)
      return { deleted, freed }
    }
  }
}
