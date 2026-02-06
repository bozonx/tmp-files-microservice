import type { MetadataAdapter } from '../metadata.adapter.js'
import type { FileInfo, FileStats } from '../../common/interfaces/file.interface.js'
import type {
  FileSearchParams,
  FileSearchResult,
} from '../../common/interfaces/storage.interface.js'
import { DateUtil } from '../../common/utils/date.util.js'

export interface KvMetadataAdapterDeps {
  kv: KVNamespace
}

const FILE_PREFIX = 'file:'
const HASH_PREFIX = 'hash:'

function fileKey(id: string): string {
  return `${FILE_PREFIX}${id}`
}

function hashKey(hash: string): string {
  return `${HASH_PREFIX}${hash}`
}

function toDateSafe(v: unknown): Date {
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

export class KvMetadataAdapter implements MetadataAdapter {
  constructor(private readonly deps: KvMetadataAdapterDeps) {}

  public async initialize(): Promise<void> {
    // No-op
  }

  public async saveFileInfo(fileInfo: FileInfo): Promise<void> {
    const expiresAt = toDateSafe(fileInfo.expiresAt)
    const ttlSeconds = Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000))

    const normalized: FileInfo = {
      ...fileInfo,
      uploadedAt:
        typeof fileInfo.uploadedAt === 'string'
          ? fileInfo.uploadedAt
          : fileInfo.uploadedAt.toISOString(),
      expiresAt:
        typeof fileInfo.expiresAt === 'string' ? fileInfo.expiresAt : expiresAt.toISOString(),
    }

    await this.deps.kv.put(fileKey(fileInfo.id), JSON.stringify(normalized), {
      expirationTtl: ttlSeconds,
    })

    await this.deps.kv.put(hashKey(fileInfo.hash), fileInfo.id, {
      expirationTtl: ttlSeconds,
    })
  }

  public async getFileInfo(fileId: string): Promise<FileInfo | null> {
    const raw = await this.deps.kv.get(fileKey(fileId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as FileInfo
    parsed.uploadedAt = toDateSafe(parsed.uploadedAt)
    parsed.expiresAt = toDateSafe(parsed.expiresAt)
    return parsed
  }

  public async deleteFileInfo(fileId: string): Promise<void> {
    const info = await this.getFileInfo(fileId)
    if (!info) return

    await this.deps.kv.delete(fileKey(fileId))

    const current = await this.deps.kv.get(hashKey(info.hash))
    if (current === fileId) {
      await this.deps.kv.delete(hashKey(info.hash))
    }
  }

  public async findFileByHash(hash: string): Promise<FileInfo | null> {
    const id = await this.deps.kv.get(hashKey(hash))
    if (!id) return null
    return this.getFileInfo(id)
  }

  public async searchFiles(params: FileSearchParams): Promise<FileSearchResult> {
    // KV doesn't support rich queries; we list and filter in-memory.
    // This is acceptable for a tmp-files service with limited volume.

    const files: FileInfo[] = []
    let cursor: string | undefined

    do {
      const res = await this.deps.kv.list({ prefix: FILE_PREFIX, cursor, limit: 1000 })
      for (const k of res.keys) {
        const id = k.name.slice(FILE_PREFIX.length)
        const info = await this.getFileInfo(id)
        if (info) files.push(info)
      }
      cursor = res.list_complete ? undefined : res.cursor
    } while (cursor)

    let out = files

    if (!params.expiredOnly) {
      out = out.filter((f) => !DateUtil.isExpired(f.expiresAt))
    }

    if (params.mimeType) out = out.filter((f) => f.mimeType === params.mimeType)
    if (params.minSize !== undefined) {
      const min = params.minSize
      out = out.filter((f) => f.size >= min)
    }
    if (params.maxSize !== undefined) {
      const max = params.maxSize
      out = out.filter((f) => f.size <= max)
    }
    if (params.uploadedAfter !== undefined) {
      const after = params.uploadedAfter
      out = out.filter((f) => DateUtil.isAfter(f.uploadedAt, after))
    }
    if (params.uploadedBefore !== undefined) {
      const before = params.uploadedBefore
      out = out.filter((f) => DateUtil.isBefore(f.uploadedAt, before))
    }
    if (params.expiredOnly) out = out.filter((f) => DateUtil.isExpired(f.expiresAt))

    out.sort((a, b) => DateUtil.toTimestamp(b.uploadedAt) - DateUtil.toTimestamp(a.uploadedAt))

    const total = out.length
    if (params.offset) out = out.slice(params.offset)
    if (params.limit) out = out.slice(0, params.limit)

    return { files: out, total, params }
  }

  public async getStats(): Promise<FileStats> {
    const res = await this.searchFiles({ expiredOnly: true })
    const all = res.files

    const filesByMimeType: Record<string, number> = {}
    const filesByDate: Record<string, number> = {}

    for (const f of all) {
      filesByMimeType[f.mimeType] = (filesByMimeType[f.mimeType] || 0) + 1
      const dateKey = DateUtil.format(f.uploadedAt, 'YYYY-MM-DD')
      filesByDate[dateKey] = (filesByDate[dateKey] || 0) + 1
    }

    return {
      totalFiles: all.length,
      totalSize: all.reduce((sum, f) => sum + f.size, 0),
      filesByMimeType,
      filesByDate,
    }
  }

  public async getAllFileIds(): Promise<string[]> {
    const ids: string[] = []
    let cursor: string | undefined

    do {
      const res = await this.deps.kv.list({ prefix: FILE_PREFIX, cursor, limit: 1000 })
      for (const k of res.keys) {
        ids.push(k.name.slice(FILE_PREFIX.length))
      }
      cursor = res.list_complete ? undefined : res.cursor
    } while (cursor)

    return ids
  }

  public async isHealthy(): Promise<boolean> {
    try {
      await this.deps.kv.list({ limit: 1 })
      return true
    } catch {
      return false
    }
  }
}
