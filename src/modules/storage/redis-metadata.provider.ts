import { Injectable, Logger } from '@nestjs/common'
import { MetadataProvider } from './metadata.provider.js'
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
    
    await client
      .multi()
      .hset(this.FILES_KEY, fileInfo.id, JSON.stringify(fileInfo))
      .hset(this.HASHES_KEY, fileInfo.hash, fileInfo.id)
      .hincrby(this.STATS_KEY, 'totalFiles', 1)
      .hincrby(this.STATS_KEY, 'totalSize', fileInfo.size)
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
    await client
      .multi()
      .hdel(this.FILES_KEY, fileId)
      .hdel(this.HASHES_KEY, fileInfo.hash)
      .hincrby(this.STATS_KEY, 'totalFiles', -1)
      .hincrby(this.STATS_KEY, 'totalSize', -fileInfo.size)
      .exec()
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
    const stats = await client.hgetall(this.STATS_KEY)
    
    // We also need to compute mime type and date stats which are not currently in STATS_KEY
    // For now, let's compute them from all files (similar to searchFiles)
    // In a high-load scenario, these should be updated incrementally in Redis.
    const allFilesData = await client.hgetall(this.FILES_KEY)
    const files = Object.values(allFilesData).map(data => JSON.parse(data) as FileInfo)

    const filesByMimeType: Record<string, number> = {}
    const filesByDate: Record<string, number> = {}

    files.forEach((file) => {
      filesByMimeType[file.mimeType] = (filesByMimeType[file.mimeType] || 0) + 1
      const dateKey = DateUtil.format(new Date(file.uploadedAt), 'YYYY-MM-DD')
      filesByDate[dateKey] = (filesByDate[dateKey] || 0) + 1
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
