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
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

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
    const cryptoAny = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined
    if (!cryptoAny?.randomUUID) {
      throw new Error('crypto.randomUUID is required but not available in this runtime')
    }
    return cryptoAny.randomUUID()
  }

  /**
   * Reads enough chunks from the stream to reach the target size.
   * Internal helper to avoid deadlocks in TransformStream when peeling off the first chunk.
   */
  private async peekFirstChunk(
    stream: ReadableStream<Uint8Array>,
    targetSize: number
  ): Promise<{ chunks: Uint8Array[]; remainingStream: ReadableStream<Uint8Array> }> {
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let totalRead = 0
    let doneReading = false

    try {
      while (totalRead < targetSize) {
        const { value, done } = await reader.read()
        if (done) {
          doneReading = true
          break
        }
        if (value) {
          chunks.push(value)
          totalRead += value.byteLength
        }
      }
    } finally {
      reader.releaseLock()
    }

    const remainingStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Push already read chunks back
        for (const chunk of chunks) {
          controller.enqueue(chunk)
        }
        if (doneReading) {
          controller.close()
          return
        }
        // Pipe the rest
        const restReader = stream.getReader()
        try {
          while (true) {
            const { value, done } = await restReader.read()
            if (done) break
            controller.enqueue(value)
          }
          controller.close()
        } catch (e) {
          controller.error(e)
        } finally {
          restReader.releaseLock()
        }
      },
    })

    return { chunks, remainingStream }
  }

  private createHashingLimitedStream(input: ReadableStream<Uint8Array>): {
    stream: ReadableStream<Uint8Array>
    getResult: () => { hashHex: string; size: number }
  } {
    const hasher = sha256.create()
    let size = 0
    let finalized: { hashHex: string; size: number } | undefined

    const transformer = new TransformStream<Uint8Array, Uint8Array>({
      transform: (chunk, controller) => {
        size += chunk.byteLength
        if (size > this.maxFileSizeBytes) {
          throw new Error(`File size ${size} exceeds maximum allowed size ${this.maxFileSizeBytes}`)
        }
        hasher.update(chunk)
        controller.enqueue(chunk)
      },
      flush: () => {
        const digest = hasher.digest()
        finalized = { hashHex: bytesToHex(digest), size }
      },
    })

    return {
      stream: input.pipeThrough(transformer),
      getResult: () => {
        if (!finalized) {
          throw new Error('Stream processing result is not available')
        }
        return finalized
      },
    }
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



  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    await this.deps.metadata.initialize()
    this.initialized = true
  }

  public async saveFile(params: CreateFileParams): Promise<FileOperationResult> {
    await this.ensureInitialized()

    const fileId = this.randomUUID()
    const key = fileId

    try {
      // Manually peek at the first 4KB for MIME detection to avoid deadlocks
      const { chunks, remainingStream } = await this.peekFirstChunk(params.file.stream, 4096)
      const firstChunk = chunks.length > 0 ? chunks[0] : undefined

      const mimeType = await this.detectMimeTypeFromFirstChunk(
        params.file.mimetype ?? 'application/octet-stream',
        firstChunk
      )

      if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(mimeType)) {
        return { success: false, error: `MIME type ${mimeType} is not allowed` }
      }

      const processedStream = this.createHashingLimitedStream(remainingStream)
      
      const uploadRes = await this.deps.fileStorage.saveFile(
        processedStream.stream,
        key,
        mimeType,
        params.file.size,
        {
          'mime-type': mimeType,
          'original-name': params.file.originalname,
        }
      )

      if (!uploadRes.success) {
        return { success: false, error: uploadRes.error }
      }

      // NOW we can get the result because the stream is exhausted by the storage adapter
      const processed = processedStream.getResult()
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
      this.deps.logger.error('Failed to save file', {
        error: err.message,
        stack: err.stack,
        fileId,
      })

      // Attempt to delete the file from storage if metadata/processing failed
      await this.deps.fileStorage.deleteFile(key).catch((cleanupErr: unknown) => {
        const cErr = cleanupErr instanceof Error ? cleanupErr : new Error(String(cleanupErr))
        this.deps.logger.error(
          'Failed to cleanup file after metadata failure. POTENTIAL ORPHAN FILE!',
          {
            key,
            error: cErr.message,
            stack: cErr.stack,
          }
        )
      })
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
