import type { StorageOperationResult } from '../common/interfaces/storage.interface.js'

export interface FileStorageAdapter {
  saveFile(
    input: ReadableStream<Uint8Array>,
    key: string,
    mimeType: string
  ): Promise<StorageOperationResult<string>>

  readFile(key: string): Promise<StorageOperationResult<Uint8Array>>

  createReadStream(key: string): Promise<StorageOperationResult<ReadableStream<Uint8Array>>>

  deleteFile(key: string): Promise<StorageOperationResult<void>>

  listAllKeys(): Promise<string[]>

  isHealthy(): Promise<boolean>
}
