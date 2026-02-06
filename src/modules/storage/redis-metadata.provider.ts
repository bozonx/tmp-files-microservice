import { Injectable, Logger } from '@nestjs/common'
import type { MetadataProvider } from './metadata.provider.js'
import { FileInfo, FileStats } from '../../common/interfaces/file.interface.js'
import { FileSearchParams, FileSearchResult } from '../../common/interfaces/storage.interface.js'
import { RedisService } from './redis.service.js'
import { DateUtil } from '../../common/utils/date.util.js'

@Injectable()
export class RedisMetadataProvider implements MetadataProvider {
  private readonly logger = new Logger(RedisMetadataProvider.name)
  private readonly FILES_KEY = 'files'
  private readonly HASHES_KEY = 'hashes'
  private readonly STATS_KEY = 'stats'

  constructor(private readonly redisService: RedisService) {}

  async initialize(): Promise<void> {
    this.logger.log('Redis metadata provider initialized')
  }

  async saveFileInfo(fileInfo: FileInfo): Promise<void> {
    const client = this.redisService.getClient()
    const dateKey = DateUtil.format(fileInfo.uploadedAt, 'YYYY-MM-DD')
    
    await client
      .multi()
      .hset(this.FILES_KEY, fileInfo.id, JSON.stringify(fileInfo))
      .hset(this.HASHES_KEY, fileInfo.hash, fileInfo.id)
      .hincrby(this.STATS_KEY, 'totalFiles', 1)
      .hincrby(this.STATS_KEY, 'totalSize', fileInfo.size)
      .hincrby(`${this.STATS_KEY}:mime_types`, fileInfo.mimeType, 1)
      .hincrby(`${this.STATS_KEY}:dates`, dateKey, 1)
      .exec()
  }

  async getFileInfo(fileId: string): Promise<FileInfo | null> {
    const client = this.redisService.getClient()
    const data = await client.hget(this.FILES_KEY, fileId)
    if (!data) return null
    
    const fileInfo = JSON.parse(data) as FileInfo
    // Standardize dates
    fileInfo.uploadedAt = new Date(fileInfo.uploadedAt)
    fileInfo.expiresAt = new Date(fileInfo.expiresAt)
    
    return fileInfo
  }

  async deleteFileInfo(fileId: string): Promise<void> {
    const fileInfo = await this.getFileInfo(fileId)
    if (!fileInfo) return

    const client = this.redisService.getClient()
    const dateKey = DateUtil.format(fileInfo.uploadedAt, 'YYYY-MM-DD')
    
    // Only delete hash mapping if it points to this specific file
    const currentHashId = await client.hget(this.HASHES_KEY, fileInfo.hash)
    const shouldDeleteHash = currentHashId === fileId

    const multi = client.multi()
      .hdel(this.FILES_KEY, fileId)
      .hincrby(this.STATS_KEY, 'totalFiles', -1)
      .hincrby(this.STATS_KEY, 'totalSize', -fileInfo.size)
      .hincrby(`${this.STATS_KEY}:mime_types`, fileInfo.mimeType, -1)
      .hincrby(`${this.STATS_KEY}:dates`, dateKey, -1)
    
    if (shouldDeleteHash) {
      multi.hdel(this.HASHES_KEY, fileInfo.hash)
    }
    
    await multi.exec()
    
    // Cleanup zero-valued stats (optional but keeps Redis clean)
    // We don't do it in the multi because hincrby might reach zero
  }

  async searchFiles(params: FileSearchParams): Promise<FileSearchResult> {
    const client = this.redisService.getClient()
    // For large datasets, this should use HSCAN. For now, we'll HGETALL for simplicity,
    // assuming it's a temporary files service with a reasonable amount of data.
    const allFilesData = await client.hgetall(this.FILES_KEY)
    
    let files = Object.values(allFilesData).map(data => {
        const f = JSON.parse(data) as FileInfo
        f.uploadedAt = new Date(f.uploadedAt)
        f.expiresAt = new Date(f.expiresAt)
        return f
    })

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
  }

  async getStats(): Promise<FileStats> {
    const client = this.redisService.getClient()
    
    const [stats, mimeTypes, dates] = await Promise.all([
      client.hgetall(this.STATS_KEY),
      client.hgetall(`${this.STATS_KEY}:mime_types`),
      client.hgetall(`${this.STATS_KEY}:dates`)
    ])
    
    const filesByMimeType: Record<string, number> = {}
    const filesByDate: Record<string, number> = {}

    Object.entries(mimeTypes).forEach(([type, count]) => {
      const c = parseInt(count, 10)
      if (c > 0) filesByMimeType[type] = c
    })

    Object.entries(dates).forEach(([date, count]) => {
      const c = parseInt(count, 10)
      if (c > 0) filesByDate[date] = c
    })

    return {
      totalFiles: parseInt(stats.totalFiles || '0', 10),
      totalSize: parseInt(stats.totalSize || '0', 10),
      filesByMimeType,
      filesByDate,
    }
  }

  async findFileByHash(hash: string): Promise<FileInfo | null> {
    const client = this.redisService.getClient()
    const fileId = await client.hget(this.HASHES_KEY, hash)
    if (!fileId) return null
    return this.getFileInfo(fileId)
  }

  async getAllFileIds(): Promise<string[]> {
    const client = this.redisService.getClient()
    return client.hkeys(this.FILES_KEY)
  }

  async isHealthy(): Promise<boolean> {
    try {
      const client = this.redisService.getClient()
      await client.ping()
      return true
    } catch {
      return false
    }
  }
}
