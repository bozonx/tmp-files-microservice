import { FileInfo, FileStats } from '../../common/interfaces/file.interface.js'
import { FileSearchParams, FileSearchResult } from '../../common/interfaces/storage.interface.js'

export interface MetadataProvider {
  /**
   * Initialize the provider
   */
  initialize(): Promise<void>

  /**
   * Save file information
   */
  saveFileInfo(fileInfo: FileInfo): Promise<void>

  /**
   * Get file information by ID
   */
  getFileInfo(fileId: string): Promise<FileInfo | null>

  /**
   * Delete file information by ID
   */
  deleteFileInfo(fileId: string): Promise<void>

  /**
   * Search for files based on parameters
   */
  searchFiles(params: FileSearchParams): Promise<FileSearchResult>

  /**
   * Get overall storage statistics
   */
  getStats(): Promise<FileStats>

  /**
   * Find a file by its content hash
   */
  findFileByHash(hash: string): Promise<FileInfo | null>

  /**
   * Get all file IDs (useful for cleanup/migration)
   */
  getAllFileIds(): Promise<string[]>

  /**
   * Check if the provider is healthy
   */
  isHealthy(): Promise<boolean>
}

export const METADATA_PROVIDER = 'METADATA_PROVIDER'
