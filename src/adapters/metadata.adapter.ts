import type { FileInfo, FileStats } from '../common/interfaces/file.interface.js'
import type { FileSearchParams, FileSearchResult } from '../common/interfaces/storage.interface.js'

export interface MetadataAdapter {
  initialize(): Promise<void>

  saveFileInfo(fileInfo: FileInfo, signal?: AbortSignal): Promise<void>
  getFileInfo(fileId: string, signal?: AbortSignal): Promise<FileInfo | null>
  deleteFileInfo(fileId: string, signal?: AbortSignal): Promise<void>

  searchFiles(params: FileSearchParams, signal?: AbortSignal): Promise<FileSearchResult>
  getStats(signal?: AbortSignal): Promise<FileStats>
  getAllFileIds(signal?: AbortSignal): Promise<string[]>

  isHealthy(): Promise<boolean>
}
