import { Redis } from 'ioredis'
import type { MetadataAdapter } from '../metadata.adapter.js'
import type { FileInfo, FileStats } from '../../common/interfaces/file.interface.js'
import type {
  FileSearchParams,
  FileSearchResult,
} from '../../common/interfaces/storage.interface.js'
import { DateUtil } from '../../common/utils/date.util.js'

export interface RedisMetadataAdapterDeps {
  client: Redis
  keyPrefix: string
}

function toDateSafe(v: unknown): Date {
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

export class RedisMetadataAdapter implements MetadataAdapter {
  private readonly FILES_KEY: string
  private readonly HASHES_KEY: string
  private readonly STATS_KEY: string

  constructor(private readonly deps: RedisMetadataAdapterDeps) {
    const p = deps.keyPrefix
    this.FILES_KEY = `${p}files`
    this.HASHES_KEY = `${p}hashes`
    this.STATS_KEY = `${p}stats`
  }

  async initialize(): Promise<void> {
    // No-op
  }

  async saveFileInfo(fileInfo: FileInfo): Promise<void> {
    const dateKey = DateUtil.format(fileInfo.uploadedAt, 'YYYY-MM-DD')
    const normalized: FileInfo = {
      ...fileInfo,
      uploadedAt:
        typeof fileInfo.uploadedAt === 'string'
          ? fileInfo.uploadedAt
          : fileInfo.uploadedAt.toISOString(),
      expiresAt:
        typeof fileInfo.expiresAt === 'string'
          ? fileInfo.expiresAt
          : toDateSafe(fileInfo.expiresAt).toISOString(),
    }

    await this.deps.client
      .multi()
      .hset(this.FILES_KEY, fileInfo.id, JSON.stringify(normalized))
      .hset(this.HASHES_KEY, fileInfo.hash, fileInfo.id)
      .hincrby(this.STATS_KEY, 'totalFiles', 1)
      .hincrby(this.STATS_KEY, 'totalSize', fileInfo.size)
      .hincrby(`${this.STATS_KEY}:mime_types`, fileInfo.mimeType, 1)
      .hincrby(`${this.STATS_KEY}:dates`, dateKey, 1)
      .exec()
  }

  async getFileInfo(fileId: string): Promise<FileInfo | null> {
    const raw = await this.deps.client.hget(this.FILES_KEY, fileId)
    if (!raw) return null

    const parsed = JSON.parse(raw) as FileInfo
    parsed.uploadedAt = toDateSafe(parsed.uploadedAt)
    parsed.expiresAt = toDateSafe(parsed.expiresAt)
    return parsed
  }

  async deleteFileInfo(fileId: string): Promise<void> {
    const fileInfo = await this.getFileInfo(fileId)
    if (!fileInfo) return

    const dateKey = DateUtil.format(fileInfo.uploadedAt, 'YYYY-MM-DD')

    const current = await this.deps.client.hget(this.HASHES_KEY, fileInfo.hash)
    const shouldDeleteHash = current === fileId

    const multi = this.deps.client
      .multi()
      .hdel(this.FILES_KEY, fileId)
      .hincrby(this.STATS_KEY, 'totalFiles', -1)
      .hincrby(this.STATS_KEY, 'totalSize', -fileInfo.size)
      .hincrby(`${this.STATS_KEY}:mime_types`, fileInfo.mimeType, -1)
      .hincrby(`${this.STATS_KEY}:dates`, dateKey, -1)

    if (shouldDeleteHash) {
      multi.hdel(this.HASHES_KEY, fileInfo.hash)
    }

    await multi.exec()
  }

  async findFileByHash(hash: string): Promise<FileInfo | null> {
    const id = await this.deps.client.hget(this.HASHES_KEY, hash)
    if (!id) return null
    return this.getFileInfo(id)
  }

  async searchFiles(params: FileSearchParams): Promise<FileSearchResult> {
    const all = (await this.deps.client.hgetall(this.FILES_KEY)) as Record<string, string>
    let files = Object.values(all).map((v) => {
      const f = JSON.parse(v) as FileInfo
      f.uploadedAt = toDateSafe(f.uploadedAt)
      f.expiresAt = toDateSafe(f.expiresAt)
      return f
    })

    if (!params.expiredOnly) {
      files = files.filter((f) => !DateUtil.isExpired(f.expiresAt))
    }

    if (params.mimeType) files = files.filter((f) => f.mimeType === params.mimeType)
    if (params.minSize !== undefined) files = files.filter((f) => f.size >= params.minSize!)
    if (params.maxSize !== undefined) files = files.filter((f) => f.size <= params.maxSize!)
    if (params.uploadedAfter)
      files = files.filter((f) => DateUtil.isAfter(f.uploadedAt, params.uploadedAfter!))
    if (params.uploadedBefore)
      files = files.filter((f) => DateUtil.isBefore(f.uploadedAt, params.uploadedBefore!))
    if (params.expiredOnly) files = files.filter((f) => DateUtil.isExpired(f.expiresAt))

    files.sort((a, b) => DateUtil.toTimestamp(b.uploadedAt) - DateUtil.toTimestamp(a.uploadedAt))

    const total = files.length
    if (params.offset) files = files.slice(params.offset)
    if (params.limit) files = files.slice(0, params.limit)

    return { files, total, params }
  }

  async getStats(): Promise<FileStats> {
    const [stats, mimeTypes, dates] = await Promise.all([
      this.deps.client.hgetall(this.STATS_KEY) as unknown as Promise<Record<string, string>>,
      this.deps.client.hgetall(`${this.STATS_KEY}:mime_types`) as unknown as Promise<
        Record<string, string>
      >,
      this.deps.client.hgetall(`${this.STATS_KEY}:dates`) as unknown as Promise<
        Record<string, string>
      >,
    ])

    const filesByMimeType: Record<string, number> = {}
    const filesByDate: Record<string, number> = {}

    for (const [k, v] of Object.entries(mimeTypes)) {
      const n = Number.parseInt(String(v), 10)
      if (n > 0) filesByMimeType[k] = n
    }

    for (const [k, v] of Object.entries(dates)) {
      const n = Number.parseInt(String(v), 10)
      if (n > 0) filesByDate[k] = n
    }

    return {
      totalFiles: Number.parseInt(stats.totalFiles || '0', 10),
      totalSize: Number.parseInt(stats.totalSize || '0', 10),
      filesByMimeType,
      filesByDate,
    }
  }

  async getAllFileIds(): Promise<string[]> {
    return this.deps.client.hkeys(this.FILES_KEY)
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.deps.client.ping()
      return true
    } catch {
      return false
    }
  }
}
