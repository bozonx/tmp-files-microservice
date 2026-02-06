import type { AppEnv } from '../config/env.js'
import type { LoggerAdapter } from '../adapters/logger.adapter.js'
import type { FileStorageAdapter } from '../adapters/file-storage.adapter.js'
import type { MetadataAdapter } from '../adapters/metadata.adapter.js'
import type {
  CreateFileParams,
  FileInfo,
  FileOperationResult,
  FileStats,
} from '../common/interfaces/file.interface.js'
import type {
  FileSearchParams,
  FileSearchResult,
  StorageHealth,
  StorageOperationResult,
} from '../common/interfaces/storage.interface.js'
import { DateUtil } from '../common/utils/date.util.js'
import { FilenameUtil } from '../common/utils/filename.util.js'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'

export interface StorageServiceDeps {
  env: AppEnv
  fileStorage: FileStorageAdapter
  metadata: MetadataAdapter
  logger: LoggerAdapter
}

export class StorageService {
  private initialized = false

  constructor(private readonly deps: StorageServiceDeps) {}

  private randomUUID(): string {
    // Prefer native web crypto (Workers, modern Node)
    const cryptoAny = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined
    if (cryptoAny?.randomUUID) return cryptoAny.randomUUID()

    // Fallback UUID v4 (RFC4122-ish) using Math.random
    const hex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
    // Set version and variant
    hex[6] = (hex[6] & 0x0f) | 0x40
    hex[8] = (hex[8] & 0x3f) | 0x80
    const toHex = (b: number) => b.toString(16).padStart(2, '0')
    const s = hex.map(toHex).join('')
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
  }

  private async computeHashAndSize(
    input: ReadableStream<Uint8Array>
  ): Promise<{ hashHex: string; size: number; firstChunk?: Uint8Array }> {
    const reader = input.getReader()

    const hasher = sha256.create()
    let size = 0
    let firstChunk: Uint8Array | undefined

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue

      size += value.byteLength
      if (size > this.maxFileSizeBytes) {
        throw new Error(`File size ${size} exceeds maximum allowed size ${this.maxFileSizeBytes}`)
      }

      firstChunk ??= value
      hasher.update(value)
    }

    const digest = hasher.digest()
    return { hashHex: bytesToHex(digest), size, firstChunk }
  }

  private async detectMimeTypeFromFirstChunk(
    fallbackMime: string,
    firstChunk?: Uint8Array
  ): Promise<string> {
    if (!firstChunk || firstChunk.byteLength === 0) return fallbackMime

    try {
      // file-type uses Node Buffer; for Workers we just skip detection.
      const maybeBuffer = (globalThis as unknown as { Buffer?: typeof Buffer }).Buffer
      if (!maybeBuffer) return fallbackMime

      const { fileTypeFromBuffer } = await import('file-type')
      const detected = await fileTypeFromBuffer(maybeBuffer.from(firstChunk))
      return detected?.mime ?? fallbackMime
    } catch {
      return fallbackMime
    }
  }

  private get maxFileSizeBytes(): number {
    return this.deps.env.MAX_FILE_SIZE_MB * 1024 * 1024
  }

  private get allowedMimeTypes(): string[] {
    return this.deps.env.ALLOWED_MIME_TYPES
  }

  private get enableDeduplication(): boolean {
    return this.deps.env.ENABLE_DEDUPLICATION
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    await this.deps.metadata.initialize()
    this.initialized = true
  }

  public async saveFile(params: CreateFileParams): Promise<FileOperationResult> {
    await this.ensureInitialized()

    const fileId = this.randomUUID()
    const key = fileId

    // We need to stream-upload and compute hash/size. Web Streams allow tee().
    const [forUpload, forHash] = params.file.stream.tee()

    const uploadPromise = this.deps.fileStorage.saveFile(
      forUpload,
      key,
      params.file.mimetype ?? 'application/octet-stream'
    )

    try {
      const [uploadRes, processed] = await Promise.all([
        uploadPromise,
        this.computeHashAndSize(forHash),
      ])

      if (!uploadRes.success) {
        return { success: false, error: uploadRes.error }
      }

      if (this.enableDeduplication) {
        const existing = await this.deps.metadata.findFileByHash(processed.hashHex)
        if (existing) {
          await this.deps.fileStorage.deleteFile(key)
          return { success: true, data: existing }
        }
      }

      const mimeType = await this.detectMimeTypeFromFirstChunk(
        params.file.mimetype ?? 'application/octet-stream',
        processed.firstChunk
      )
      if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(mimeType)) {
        await this.deps.fileStorage.deleteFile(key)
        return { success: false, error: `MIME type ${mimeType} is not allowed` }
      }

      const safeFilename = FilenameUtil.generateSafeFilename(
        params.file.originalname,
        processed.hashHex
      )
      const storedFilename = `${fileId}_${safeFilename}`

      const fileInfo: FileInfo = {
        id: fileId,
        originalName: params.file.originalname,
        storedName: storedFilename,
        mimeType,
        size: processed.size,
        hash: processed.hashHex,
        uploadedAt: DateUtil.now().toDate(),
        ttl: params.ttl,
        expiresAt: DateUtil.createExpirationDate(params.ttl),
        filePath: key,
        metadata: params.metadata ?? {},
      }

      await this.deps.metadata.saveFileInfo(fileInfo)

      return { success: true, data: fileInfo }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      this.deps.logger.error('Failed to save file', { error: err.message })
      return { success: false, error: `Failed to save file: ${err.message}` }
    }
  }

  public async getFileInfo(fileId: string): Promise<FileOperationResult> {
    await this.ensureInitialized()

    const fileInfo = await this.deps.metadata.getFileInfo(fileId)
    if (!fileInfo) return { success: false, error: `File with ID ${fileId} not found` }

    if (DateUtil.isExpired(fileInfo.expiresAt)) {
      return { success: false, error: `File with ID ${fileId} has expired` }
    }

    return { success: true, data: fileInfo }
  }

  public async readFile(fileId: string): Promise<StorageOperationResult<Uint8Array>> {
    const infoRes = await this.getFileInfo(fileId)
    if (!infoRes.success) return { success: false, error: infoRes.error }

    const info = infoRes.data as FileInfo
    return this.deps.fileStorage.readFile(info.filePath)
  }

  public async createFileReadStream(
    fileId: string
  ): Promise<StorageOperationResult<ReadableStream<Uint8Array>>> {
    const infoRes = await this.getFileInfo(fileId)
    if (!infoRes.success) return { success: false, error: infoRes.error }

    const info = infoRes.data as FileInfo
    return this.deps.fileStorage.createReadStream(info.filePath)
  }

  public async deleteFile(fileId: string): Promise<FileOperationResult> {
    await this.ensureInitialized()

    const fileInfo = await this.deps.metadata.getFileInfo(fileId)
    if (!fileInfo) return { success: false, error: `File with ID ${fileId} not found` }

    await this.deps.fileStorage.deleteFile(fileInfo.filePath)
    await this.deps.metadata.deleteFileInfo(fileId)

    return { success: true, data: fileInfo }
  }

  public async searchFiles(params: FileSearchParams): Promise<FileSearchResult> {
    await this.ensureInitialized()
    return this.deps.metadata.searchFiles(params)
  }

  public async getFileStats(): Promise<FileStats> {
    await this.ensureInitialized()
    return this.deps.metadata.getStats()
  }

  public async getStorageHealth(): Promise<StorageHealth> {
    await this.ensureInitialized()

    const [isMetadataHealthy, isStorageHealthy, stats] = await Promise.all([
      this.deps.metadata.isHealthy(),
      this.deps.fileStorage.isHealthy(),
      this.deps.metadata.getStats(),
    ])

    return {
      isAvailable: isMetadataHealthy && isStorageHealthy,
      freeSpace: 0,
      totalSpace: 0,
      usedSpace: stats.totalSize,
      usagePercentage: 0,
      fileCount: stats.totalFiles,
      lastChecked: new Date(),
    }
  }

  public async deleteOrphanedFiles(): Promise<{ deleted: number; freed: number }> {
    await this.ensureInitialized()

    const ids = await this.deps.metadata.getAllFileIds()
    const valid = new Set<string>()

    for (const id of ids) {
      const info = await this.deps.metadata.getFileInfo(id)
      if (info) valid.add(info.filePath)
    }

    const keys = await this.deps.fileStorage.listAllKeys()

    let deleted = 0
    for (const key of keys) {
      if (!valid.has(key)) {
        await this.deps.fileStorage.deleteFile(key)
        deleted += 1
      }
    }

    return { deleted, freed: 0 }
  }
}
