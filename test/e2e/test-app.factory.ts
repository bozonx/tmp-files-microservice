import { Hono } from 'hono'
import type { FileInfo } from '@/common/interfaces/file.interface.js'
import type {
  FileSearchParams,
  FileSearchResult,
  StorageOperationResult,
} from '@/common/interfaces/storage.interface.js'
import type { FileStorageAdapter } from '@/adapters/file-storage.adapter.js'
import type { MetadataAdapter } from '@/adapters/metadata.adapter.js'
import { DateUtil } from '@/common/utils/date.util.js'
import { createApp, createDefaultLogger } from '@/app.js'
import { loadAppEnv } from '@/config/env.js'
import { createErrorHandler } from '@/middleware/error-handler.js'
import type { HonoEnv } from '@/types/hono.types.js'
import { serveStatic } from '@hono/node-server/serve-static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

class MemoryFileStorageAdapter implements FileStorageAdapter {
  private readonly data = new Map<string, Uint8Array>()

  public async saveFile(
    input: ReadableStream<Uint8Array>,
    key: string,
    _mimeType: string
  ): Promise<StorageOperationResult<string>> {
    try {
      const chunks: Uint8Array[] = []
      const reader = input.getReader()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }

      const size = chunks.reduce((s, c) => s + c.byteLength, 0)
      const out = new Uint8Array(size)
      let offset = 0
      for (const c of chunks) {
        out.set(c, offset)
        offset += c.byteLength
      }

      this.data.set(key, out)
      return { success: true, data: key }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: err.message }
    }
  }

  public async readFile(key: string): Promise<StorageOperationResult<Uint8Array>> {
    const v = this.data.get(key)
    if (!v) return { success: false, error: 'NotFound' }
    return { success: true, data: v }
  }

  public async createReadStream(
    key: string
  ): Promise<StorageOperationResult<ReadableStream<Uint8Array>>> {
    const v = this.data.get(key)
    if (!v) return { success: false, error: 'NotFound' }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(v)
        controller.close()
      },
    })

    return { success: true, data: stream }
  }

  public async deleteFile(key: string): Promise<StorageOperationResult<void>> {
    this.data.delete(key)
    return { success: true }
  }

  public async listAllKeys(): Promise<string[]> {
    return Array.from(this.data.keys())
  }

  public async isHealthy(): Promise<boolean> {
    return true
  }
}

class MemoryMetadataAdapter implements MetadataAdapter {
  private readonly byId = new Map<string, FileInfo>()
  private readonly byHash = new Map<string, string>()

  public async initialize(): Promise<void> {
    // No-op
  }

  public async saveFileInfo(fileInfo: FileInfo): Promise<void> {
    this.byId.set(fileInfo.id, fileInfo)
    this.byHash.set(fileInfo.hash, fileInfo.id)
  }

  public async getFileInfo(fileId: string): Promise<FileInfo | null> {
    return this.byId.get(fileId) ?? null
  }

  public async deleteFileInfo(fileId: string): Promise<void> {
    const info = this.byId.get(fileId)
    if (!info) return
    this.byId.delete(fileId)
    const current = this.byHash.get(info.hash)
    if (current === fileId) this.byHash.delete(info.hash)
  }

  public async findFileByHash(hash: string): Promise<FileInfo | null> {
    const id = this.byHash.get(hash)
    if (!id) return null
    return this.getFileInfo(id)
  }

  public async searchFiles(params: FileSearchParams): Promise<FileSearchResult> {
    let files = Array.from(this.byId.values())

    if (!params.expiredOnly) {
      files = files.filter((f) => !DateUtil.isExpired(f.expiresAt as Date))
    }

    if (params.mimeType) files = files.filter((f) => f.mimeType === params.mimeType)
    if (params.minSize !== undefined) files = files.filter((f) => f.size >= params.minSize!)
    if (params.maxSize !== undefined) files = files.filter((f) => f.size <= params.maxSize!)
    if (params.uploadedAfter !== undefined) {
      files = files.filter((f) => DateUtil.isAfter(f.uploadedAt as Date, params.uploadedAfter!))
    }
    if (params.uploadedBefore !== undefined) {
      files = files.filter((f) => DateUtil.isBefore(f.uploadedAt as Date, params.uploadedBefore!))
    }
    if (params.expiredOnly) files = files.filter((f) => DateUtil.isExpired(f.expiresAt as Date))

    files.sort(
      (a, b) =>
        DateUtil.toTimestamp(b.uploadedAt as Date) - DateUtil.toTimestamp(a.uploadedAt as Date)
    )

    const total = files.length
    if (params.offset) files = files.slice(params.offset)
    if (params.limit) files = files.slice(0, params.limit)

    return { files, total, params }
  }

  public async getStats(): Promise<{
    totalFiles: number
    totalSize: number
    filesByMimeType: Record<string, number>
    filesByDate: Record<string, number>
  }> {
    const all = Array.from(this.byId.values())
    return {
      totalFiles: all.length,
      totalSize: all.reduce((s, f) => s + f.size, 0),
      filesByMimeType: {},
      filesByDate: {},
    }
  }

  public async getAllFileIds(): Promise<string[]> {
    return Array.from(this.byId.keys())
  }

  public async isHealthy(): Promise<boolean> {
    return true
  }
}

export interface TestApp {
  app: Hono<HonoEnv>
}

export async function createTestApp(): Promise<TestApp> {
  const env = loadAppEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    CLEANUP_INTERVAL_MINS: '0',
    MAX_FILE_SIZE_MB: '10',
  })
  const logger = createDefaultLogger(env)

  const storage = new MemoryFileStorageAdapter()
  const metadata = new MemoryMetadataAdapter()

  const apiApp = createApp({ env, storage, metadata, logger })

  const app = new Hono<HonoEnv>()
  app.onError(createErrorHandler())
  app.route('/', apiApp)

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const publicDir = path.resolve(__dirname, '..', '..', 'public')

  app.get('/', (c) => c.redirect('/ui/', 302))
  app.get('/ui', (c) => c.redirect('/ui/', 302))
  app.get('/ui/', serveStatic({ root: publicDir, path: 'index.html' }))
  app.get(
    '/ui/public/*',
    serveStatic({
      root: publicDir,
      rewriteRequestPath: (p) => p.replace(/^\/ui\/public/, ''),
    })
  )

  return { app }
}
