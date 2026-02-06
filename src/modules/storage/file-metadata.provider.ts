import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import fs from 'fs-extra'
import * as path from 'path'
import { MetadataProvider } from './metadata.provider.js'
import { FileInfo, FileStats } from '../../common/interfaces/file.interface.js'
import {
  FileSearchParams,
  FileSearchResult,
  StorageMetadata,
} from '../../common/interfaces/storage.interface.js'
import { StorageAppConfig } from '../../config/storage.config.js'
import { DateUtil } from '../../common/utils/date.util.js'

@Injectable()
export class FileMetadataProvider implements MetadataProvider {
  private readonly logger = new Logger(FileMetadataProvider.name)
  private metadataPath!: string
  private metadataLock: Promise<void> = Promise.resolve()
  private basePath!: string

  constructor(private readonly configService: ConfigService) {
    const storageCfg = this.configService.get<StorageAppConfig>('storage')
    this.basePath = storageCfg!.basePath
    this.metadataPath = path.join(this.basePath, 'data.json')
  }

  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.basePath)

      if (!(await fs.pathExists(this.metadataPath))) {
        const initialMetadata: StorageMetadata = {
          version: '1.0.0',
          lastUpdated: new Date(),
          totalFiles: 0,
          totalSize: 0,
          files: {},
        }
        await fs.writeJson(this.metadataPath, initialMetadata, { spaces: 2 })
        this.logger.log('File metadata initialized with empty data')
      } else {
        try {
          await fs.readJson(this.metadataPath)
        } catch (error: any) {
          this.logger.warn('Existing metadata file is corrupted, recreating...')
          await fs.remove(this.metadataPath)
          const initialMetadata: StorageMetadata = {
            version: '1.0.0',
            lastUpdated: new Date(),
            totalFiles: 0,
            totalSize: 0,
            files: {},
          }
          await fs.writeJson(this.metadataPath, initialMetadata, { spaces: 2 })
        }
      }
    } catch (error: any) {
      this.logger.error('Failed to initialize file metadata', error)
      throw new Error(`File metadata initialization failed: ${error.message}`)
    }
  }

  async saveFileInfo(fileInfo: FileInfo): Promise<void> {
    await this.updateMetadata(fileInfo, 'add')
  }

  async getFileInfo(fileId: string): Promise<FileInfo | null> {
    const metadata = await this.loadMetadata()
    return metadata.files[fileId] || null
  }

  async deleteFileInfo(fileId: string): Promise<void> {
    const fileInfo = await this.getFileInfo(fileId)
    if (fileInfo) {
      await this.updateMetadata(fileInfo, 'remove')
    }
  }

  async searchFiles(params: FileSearchParams): Promise<FileSearchResult> {
    try {
      const metadata = await this.loadMetadata()
      let files = Object.values(metadata.files)

      if (!params.expiredOnly) {
        files = files.filter((file) => !DateUtil.isExpired(file.expiresAt))
      }

      if (params.mimeType) {
        files = files.filter((file) => file.mimeType === params.mimeType)
      }
      if (params.minSize !== undefined) {
        files = files.filter((file) => file.size >= params.minSize!)
      }
      if (params.maxSize !== undefined) {
        files = files.filter((file) => file.size <= params.maxSize!)
      }
      if (params.uploadedAfter) {
        files = files.filter((file) => DateUtil.isAfter(file.uploadedAt, params.uploadedAfter!))
      }
      if (params.uploadedBefore) {
        files = files.filter((file) => DateUtil.isBefore(file.uploadedAt, params.uploadedBefore!))
      }
      if (params.expiredOnly) {
        files = files.filter((file) => DateUtil.isExpired(file.expiresAt))
      }

      files.sort((a, b) => DateUtil.toTimestamp(b.uploadedAt) - DateUtil.toTimestamp(a.uploadedAt))

      const total = files.length
      if (params.offset) files = files.slice(params.offset)
      if (params.limit) files = files.slice(0, params.limit)

      return { files, total, params }
    } catch (error: any) {
      this.logger.error('Failed to search files in file metadata', error)
      return { files: [], total: 0, params }
    }
  }

  async getStats(): Promise<FileStats> {
    try {
      const metadata = await this.loadMetadata()
      const files = Object.values(metadata.files)

      const filesByMimeType: Record<string, number> = {}
      const filesByDate: Record<string, number> = {}

      files.forEach((file) => {
        filesByMimeType[file.mimeType] = (filesByMimeType[file.mimeType] || 0) + 1
        const dateKey = DateUtil.format(file.uploadedAt, 'YYYY-MM-DD')
        filesByDate[dateKey] = (filesByDate[dateKey] || 0) + 1
      })

      return {
        totalFiles: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        filesByMimeType,
        filesByDate,
      }
    } catch (error: any) {
      this.logger.error('Failed to get stats from file metadata', error)
      return { totalFiles: 0, totalSize: 0, filesByMimeType: {}, filesByDate: {} }
    }
  }

  async findFileByHash(hash: string): Promise<FileInfo | null> {
    try {
      const metadata = await this.loadMetadata()
      const files = Object.values(metadata.files)
      return files.find((file) => file.hash === hash) || null
    } catch (error: any) {
      this.logger.error('Failed to find file by hash in file metadata', error)
      return null
    }
  }

  async getAllFileIds(): Promise<string[]> {
    const metadata = await this.loadMetadata()
    return Object.keys(metadata.files)
  }

  async isHealthy(): Promise<boolean> {
    try {
      await fs.access(this.metadataPath, fs.constants.R_OK | fs.constants.W_OK)
      return true
    } catch {
      return false
    }
  }

  private async loadMetadata(): Promise<StorageMetadata> {
    try {
      if (!(await fs.pathExists(this.metadataPath))) {
        await this.initialize()
      }
      return await fs.readJson(this.metadataPath)
    } catch (error: any) {
      this.logger.error('Failed to load metadata file', error)
      throw new Error(`Failed to load metadata: ${error.message}`)
    }
  }

  private async updateMetadata(fileInfo: FileInfo, operation: 'add' | 'remove'): Promise<void> {
    const currentLock = this.metadataLock
    let resolveLock: () => void
    this.metadataLock = new Promise((resolve) => {
      resolveLock = resolve
    })

    try {
      await currentLock
      const metadata = await this.loadMetadata()

      if (operation === 'add') {
        metadata.files[fileInfo.id] = fileInfo
        metadata.totalFiles += 1
        metadata.totalSize += fileInfo.size
      } else if (operation === 'remove') {
        delete metadata.files[fileInfo.id]
        metadata.totalFiles -= 1
        metadata.totalSize -= fileInfo.size
      }

      metadata.lastUpdated = new Date()

      const metadataDir = path.dirname(this.metadataPath)
      await fs.ensureDir(metadataDir)

      const tempPath = path.join(
        metadataDir,
        `data.json.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`
      )
      await fs.writeJson(tempPath, metadata, { spaces: 2 })
      await fs.move(tempPath, this.metadataPath, { overwrite: true })
    } catch (error: any) {
      this.logger.error('Failed to update metadata file', error)
      throw new Error(`Failed to update metadata: ${error.message}`)
    } finally {
      resolveLock!()
    }
  }
}
