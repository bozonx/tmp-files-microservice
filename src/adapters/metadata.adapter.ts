import type { FileInfo, FileStats } from '../common/interfaces/file.interface.js'
import type { FileSearchParams, FileSearchResult } from '../common/interfaces/storage.interface.js'

export interface MetadataAdapter {
  initialize(): Promise<void>

  saveFileInfo(fileInfo: FileInfo): Promise<void>
  getFileInfo(fileId: string): Promise<FileInfo | null>
  deleteFileInfo(fileId: string): Promise<void>

  searchFiles(params: FileSearchParams): Promise<FileSearchResult>
  getStats(): Promise<FileStats>
  getAllFileIds(): Promise<string[]>

  isHealthy(): Promise<boolean>
}
