export interface UploadedFile {
  originalname: string
  mimetype: string
  size: number
  stream: ReadableStream<Uint8Array>
  encoding?: string
}

export interface FileInfo {
  id: string
  originalName: string
  storedName: string
  mimeType: string
  size: number
  hash: string
  uploadedAt: Date | string
  ttl: number
  expiresAt: Date | string
  filePath: string
  metadata: Record<string, unknown>
}

export interface CreateFileParams {
  file: UploadedFile
  ttl: number
  metadata?: Record<string, unknown>
}

export interface FileOperationResult<T = FileInfo> {
  success: boolean
  data?: T
  error?: string
}

export interface FileStats {
  totalFiles: number
  totalSize: number
  filesByMimeType: Record<string, number>
  filesByDate: Record<string, number>
}
