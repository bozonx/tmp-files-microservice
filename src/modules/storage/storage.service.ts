import { Injectable, Logger, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import fs from 'fs-extra'
import { createReadStream, type ReadStream } from 'fs'
import * as path from 'path'
// Use dynamic import for ESM-only module 'file-type' inside methods to avoid CJS interop issues
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
import { STORAGE_CONSTANTS } from '../../common/constants/storage.constants.js'
import { MetadataProvider, METADATA_PROVIDER } from './metadata.provider.js'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private config!: StorageConfig
  private initialized = false

  constructor(
    private readonly configService: ConfigService,
    @Inject(METADATA_PROVIDER) private readonly metadataProvider: MetadataProvider
  ) { }

  private getConfig(): StorageConfig {
    if (!this.config) {
      const storageCfg = this.configService.get<StorageAppConfig>('storage')
      if (!storageCfg?.basePath) {
        throw new Error(
          'Storage base path is not configured. Set STORAGE_DIR environment variable.'
        )
      }
      const basePath = storageCfg.basePath
      const absoluteBasePath = path.isAbsolute(basePath) ? basePath : path.resolve(basePath)

      this.config = {
        basePath: absoluteBasePath,
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
      const config = this.getConfig()
      await fs.ensureDir(config.basePath)
      await this.metadataProvider.initialize()
      this.initialized = true
      this.logger.log(`Storage initialized at: ${config.basePath}`)
    } catch (error: any) {
      this.logger.error('Failed to initialize storage', error)
      throw new Error(`Storage initialization failed: ${error.message}`)
    }
  }

  async saveFile(params: CreateFileParams): Promise<FileOperationResult> {
    const { file, ttl, metadata = {} } = params
    const config = this.getConfig()

    await this.ensureInitialized()
    await fs.ensureDir(config.basePath)

    // Ensure temp directory exists
    const tempDir = path.join(config.basePath, 'temp')
    await fs.ensureDir(tempDir)

    const fileId = randomUUID()
    const tempPath = path.join(tempDir, `${fileId}.tmp`)


    const hash = createHash('sha256')
    
    let size = 0
    let mimeType = file.mimetype
    let firstChunk: Buffer | null = null

    return new Promise<FileOperationResult>((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempPath)
      
      const cleanup = async () => {
        try {
           if (await fs.pathExists(tempPath)) {
            await fs.remove(tempPath)
           }
        } catch (e) {
          this.logger.error('Failed to cleanup temp file', e)
        }
      }

      const handleError = async (error: Error) => {
        writeStream.destroy()
        if ('destroy' in file.stream && typeof file.stream.destroy === 'function') {
            (file.stream as any).destroy()
        }
        await cleanup()
        
        if (error.message.includes('exceeds maximum allowed size')) {
           return resolve({
            success: false,
            error: error.message
          })
        }
        
        this.logger.error('Stream processing failed', error)
        resolve({
          success: false,
          error: `Failed to save file: ${error.message}`
        })
      }

      file.stream.on('data', (chunk: Buffer) => {
        size += chunk.length
        
        if (size > config.maxFileSize) {
          handleError(new Error(`File size ${size} exceeds maximum allowed size ${config.maxFileSize}`))
          return
        }

        if (!firstChunk) {
            firstChunk = chunk
        }

        hash.update(chunk)
        
        const canWrite = writeStream.write(chunk)
        if (!canWrite) {
          file.stream.pause()
          writeStream.once('drain', () => file.stream.resume())
        }
      })

      file.stream.on('error', (err) => handleError(err))
      writeStream.on('error', (err) => handleError(err))

      file.stream.on('end', async () => {
        writeStream.end()
        
        try {
            await new Promise<void>((res) => writeStream.on('finish', () => res()))
            
            const fileHash = hash.digest('hex')

            // Deduplication check
            if (config.enableDeduplication) {
                const existingFile = await this.metadataProvider.findFileByHash(fileHash)
                if (existingFile) {
                    await cleanup()
                    return resolve({
                        success: true,
                        data: existingFile
                    })
                }
            }

            // Mime detection
            try {
                if (firstChunk) {
                     const { fileTypeFromBuffer } = await import('file-type')
                     const detectedType = await fileTypeFromBuffer(firstChunk)
                     mimeType = detectedType?.mime || mimeType
                }
            } catch (err: any) {
                 this.logger.warn(`MIME detection skipped/failed: ${err.message}`)
            }

            if (config.allowedMimeTypes.length > 0 && !config.allowedMimeTypes.includes(mimeType)) {
                 await cleanup()
                 return resolve({
                     success: false,
                     error: `MIME type ${mimeType} is not allowed`
                 })
            }

            // Move to final location
            const safeFilename = FilenameUtil.generateSafeFilename(file.originalname, fileHash)
            const storedFilename = `${fileId}_${safeFilename}`
            const dateDir = DateUtil.format(DateUtil.now().toDate(), STORAGE_CONSTANTS.DATE_FORMAT)
            const fileDir = path.join(config.basePath, dateDir)
            await fs.ensureDir(fileDir)
            
            const finalPath = path.join(fileDir, storedFilename)
            await fs.move(tempPath, finalPath)

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
                filePath: finalPath,
                metadata
            }

            await this.metadataProvider.saveFileInfo(fileInfo)
            
            this.logger.log(`File saved successfully: ${fileId}`)
            resolve({
                success: true,
                data: fileInfo
            })

        } catch (err: any) {
             await handleError(err)
        }
      })
    })
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
      if (!(await fs.pathExists(fileInfo.filePath))) {
        return { success: false, error: `File not found on disk: ${fileInfo.filePath}` }
      }

      const fileBuffer = await fs.readFile(fileInfo.filePath)
      return { success: true, data: fileBuffer }
    } catch (error: any) {
      this.logger.error(`Failed to read file with ID: ${fileId}`, error)
      return { success: false, error: `Failed to read file: ${error.message}` }
    }
  }

  async createFileReadStream(fileId: string): Promise<StorageOperationResult<ReadStream>> {
    try {
      const fileInfoResult = await this.getFileInfo(fileId)
      if (!fileInfoResult.success) {
        return { success: false, error: fileInfoResult.error }
      }

      const fileInfo = fileInfoResult.data as FileInfo
      if (!(await fs.pathExists(fileInfo.filePath))) {
        return { success: false, error: `File not found on disk: ${fileInfo.filePath}` }
      }

      const stream = createReadStream(fileInfo.filePath)
      return { success: true, data: stream }
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

      if (await fs.pathExists(fileInfo.filePath)) {
        await fs.remove(fileInfo.filePath)
      }

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
      const config = this.getConfig()
      await fs.stat(config.basePath)

      const isRedisHealthy = await this.metadataProvider.isHealthy()

      // Basic mock for space, as generic cross-platform space check is complex
      const freeSpace = 1024 * 1024 * 1024
      const totalSpace = 10 * 1024 * 1024 * 1024
      const usedSpace = totalSpace - freeSpace
      const usagePercentage = (usedSpace / totalSpace) * 100

      return {
        isAvailable: isRedisHealthy,
        freeSpace,
        totalSpace,
        usedSpace,
        usagePercentage,
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
      const config = this.getConfig()
      const allFileIds = await this.metadataProvider.getAllFileIds()
      
      const validFilePaths = new Set<string>()
      for (const id of allFileIds) {
          const info = await this.metadataProvider.getFileInfo(id)
          if (info) {
              validFilePaths.add(path.resolve(info.filePath))
          }
      }

      // Helper to process directories recursively
      const processDirectory = async (dirParams: string) => {
        const items = await fs.readdir(dirParams, { withFileTypes: true })

        for (const item of items) {
          const fullPath = path.join(dirParams, item.name)

          if (item.isDirectory()) {
            await processDirectory(fullPath)

            // Remove empty directories
            const remaining = await fs.readdir(fullPath)
            if (remaining.length === 0) {
              await fs.rmdir(fullPath)
            }
          } else if (item.isFile()) {
            // Skip metadata files
            if (item.name.startsWith('data.json')) {
              continue
            }

            // Check if file is in metadata
            if (!validFilePaths.has(path.resolve(fullPath))) {
              try {
                const stat = await fs.stat(fullPath)
                // Small safety buffer: files modified < 1 minute ago are skipped.
                const ageMs = Date.now() - stat.mtimeMs
                if (ageMs < 60000) {
                  continue
                }

                await fs.remove(fullPath)
                deleted++
                freed += stat.size
                this.logger.warn(`Deleted orphaned file: ${fullPath}`)
              } catch (err) {
                this.logger.warn(`Failed to process potential orphan: ${fullPath}`, err)
              }
            }
          }
        }
      }

      await processDirectory(config.basePath)

      if (deleted > 0) {
        this.logger.log(
          `Orphan cleanup completed: ${deleted} files deleted, freed ${freed} bytes in ${Date.now() - startTime
          }ms`
        )
      }

      return { deleted, freed }
    } catch (error: any) {
      this.logger.error('Failed to clean orphaned files', error)
      return { deleted, freed }
    }
  }
}
