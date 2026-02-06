import { ReadStream } from 'fs'
import { StorageOperationResult } from '../../common/interfaces/storage.interface.js'

export interface FileStorageProvider {
  /**
   * Save a file from a stream
   * @returns The storage key/path of the saved file
   */
  saveFile(
    fileStream: any,
    key: string,
    mimeType: string
  ): Promise<StorageOperationResult<string>>

  /**
   * Read a file as a Buffer
   */
  readFile(key: string): Promise<StorageOperationResult<Buffer>>

  /**
   * Create a read stream for a file
   */
  createReadStream(key: string): Promise<StorageOperationResult<ReadStream | any>>

  /**
   * Delete a file
   */
  deleteFile(key: string): Promise<StorageOperationResult<void>>

  /**
   * Check if the storage is healthy
   */
  isHealthy(): Promise<boolean>

  /**
   * List all stored object keys (for cleanup/orphans)
   */
  listAllKeys(): Promise<string[]>
}

export const FILE_STORAGE_PROVIDER = 'FILE_STORAGE_PROVIDER'
