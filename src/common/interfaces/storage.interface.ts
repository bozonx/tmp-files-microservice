/** Storage interfaces */
import type { FileInfo } from './file.interface.js'

export interface StorageConfig {
  basePath: string
  maxFileSize: number
  allowedMimeTypes: string[]
  enableDeduplication: boolean
}

export interface StorageMetadata {
  version: string
  lastUpdated: Date
  totalFiles: number
  totalSize: number
  files: Record<string, FileInfo>
}

export interface StorageOperationResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export interface DirectoryInfo {
  path: string
  fileCount: number
  totalSize: number
  createdAt: Date
  modifiedAt: Date
}

export interface FileSearchParams {
  mimeType?: string
  minSize?: number
  maxSize?: number
  uploadedAfter?: Date
  uploadedBefore?: Date
  expiredOnly?: boolean
  limit?: number
  offset?: number
}

export interface FileSearchResult {
  files: FileInfo[]
  total: number
  params: FileSearchParams
}

export interface StorageHealth {
  isAvailable: boolean
  freeSpace: number
  totalSpace: number
  usedSpace: number
  usagePercentage: number
  fileCount: number
  lastChecked: Date
}
