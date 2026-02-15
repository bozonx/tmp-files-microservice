import type {
  StorageOperationResult,
  StorageRange,
} from '../common/interfaces/storage.interface.js'

export interface FileStorageAdapter {
  saveFile(
    input: ReadableStream<Uint8Array>,
    key: string,
    mimeType: string,
    size?: number,
    metadata?: Record<string, string>,
    signal?: AbortSignal
  ): Promise<StorageOperationResult<string>>

  readFile(key: string, signal?: AbortSignal): Promise<StorageOperationResult<Uint8Array>>

  createReadStream(
    key: string,
    range?: StorageRange,
    signal?: AbortSignal
  ): Promise<StorageOperationResult<ReadableStream<Uint8Array>>>

  getMetadata(key: string, signal?: AbortSignal): Promise<StorageOperationResult<Record<string, string>>>

  deleteFile(key: string, signal?: AbortSignal): Promise<StorageOperationResult<void>>

  listAllKeys(prefix?: string, signal?: AbortSignal): Promise<string[]>

  isHealthy(): Promise<boolean>
}
