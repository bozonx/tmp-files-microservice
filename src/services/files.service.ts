import type { AppEnv } from '../config/env.js'
import type { LoggerAdapter } from '../adapters/logger.adapter.js'
import type { StorageService } from './storage.service.js'
import type { UploadedFile, FileInfo } from '../common/interfaces/file.interface.js'
import { ValidationUtil } from '../common/utils/validation.util.js'
import { DateUtil } from '../common/utils/date.util.js'

export interface FilesServiceDeps {
  env: AppEnv
  storage: StorageService
  logger: LoggerAdapter
}

export interface FileResponse {
  id: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: string
  ttlMins: number
  expiresAt: string
  metadata?: Record<string, any>
  hash: string
  isExpired: boolean
  timeRemainingMins: number
}

export interface UploadFileResponse {
  file: FileResponse
  downloadUrl: string
  downloadPath: string
  infoUrl: string
  deleteUrl: string
  message: string
}

export interface GetFileInfoResponse {
  file: FileResponse
  downloadUrl: string
  downloadPath: string
  deleteUrl: string
}

export interface DeleteFileResponse {
  fileId: string
  message: string
  deletedAt: string
}

export class FilesService {
  constructor(private readonly deps: FilesServiceDeps) {}

  private apiBasePath(): string {
    const base = this.deps.env.BASE_PATH
    return base ? `/${base}/api/v1` : '/api/v1'
  }

  async uploadFileFromUrl(params: {
    url: string
    ttl: number
    metadata?: Record<string, any>
  }): Promise<UploadFileResponse> {
    if (!params.url || typeof params.url !== 'string') {
      const err: any = new Error('Invalid URL')
      err.status = 400
      throw err
    }

    const res = await fetch(params.url, { redirect: 'follow' as any })
    if (!res.ok) {
      const err: any = new Error(`Failed to fetch URL. Status: ${res.status}`)
      err.status = 400
      throw err
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const contentLength = res.headers.get('content-length')
    const size = contentLength ? Number.parseInt(contentLength, 10) : 0

    const max = this.deps.env.MAX_FILE_SIZE_MB * 1024 * 1024
    if (size && size > max) {
      const err: any = new Error('File size exceeds the maximum allowed limit')
      err.status = 413
      throw err
    }

    const urlObj = new URL(params.url)
    const nameFromUrl = urlObj.pathname.split('/').filter(Boolean).pop() || 'file'

    if (!res.body) {
      const err: any = new Error('Remote response body is empty')
      err.status = 500
      throw err
    }

    const file: UploadedFile = {
      originalname: nameFromUrl,
      mimetype: contentType,
      size,
      stream: res.body as any,
    }

    return this.uploadFile({ file, ttl: params.ttl, metadata: params.metadata })
  }

  private generateApiUrl(endpoint: string, params: Record<string, string> = {}): string {
    let url = `${this.apiBasePath()}/${endpoint}`
    for (const [k, v] of Object.entries(params)) {
      url = url.replace(`:${k}`, v)
    }
    return url
  }

  private getFullDownloadUrl(downloadPath: string): string {
    const base = this.deps.env.DOWNLOAD_BASE_URL
    if (!base) return downloadPath
    return `${base}${downloadPath}`
  }

  private toFileResponse(fileInfo: FileInfo): FileResponse {
    const uploadedAt =
      typeof fileInfo.uploadedAt === 'string' ? new Date(fileInfo.uploadedAt) : fileInfo.uploadedAt
    const expiresAt =
      typeof fileInfo.expiresAt === 'string' ? new Date(fileInfo.expiresAt) : fileInfo.expiresAt

    return {
      id: fileInfo.id,
      originalName: fileInfo.originalName,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      uploadedAt: uploadedAt.toISOString(),
      ttlMins: Math.floor(fileInfo.ttl / 60),
      expiresAt: expiresAt.toISOString(),
      metadata: fileInfo.metadata,
      hash: fileInfo.hash,
      isExpired: DateUtil.isExpired(expiresAt),
      timeRemainingMins: Math.floor(
        Math.max(0, DateUtil.diffInSeconds(expiresAt, DateUtil.now().toDate())) / 60
      ),
    }
  }

  async uploadFile(params: {
    file: UploadedFile
    ttl: number
    metadata?: Record<string, any>
  }): Promise<UploadFileResponse> {
    const maxFileSize = this.deps.env.MAX_FILE_SIZE_MB * 1024 * 1024

    const v = ValidationUtil.validateUploadedFile(
      params.file,
      this.deps.env.ALLOWED_MIME_TYPES,
      maxFileSize
    )
    if (!v.isValid) {
      const tooLarge = v.errors.some((e) => e.includes('exceeds maximum allowed size'))
      const error: any = new Error(`File validation failed: ${v.errors.join(', ')}`)
      error.status = tooLarge ? 413 : 400
      throw error
    }

    const ttlValidation = ValidationUtil.validateTTL(params.ttl, 60, this.deps.env.MAX_TTL_MIN * 60)
    if (!ttlValidation.isValid) {
      const error: any = new Error(`TTL validation failed: ${ttlValidation.errors.join(', ')}`)
      error.status = 400
      throw error
    }

    if (params.metadata) {
      const mv = ValidationUtil.validateMetadata(params.metadata)
      if (!mv.isValid) {
        const error: any = new Error(`Metadata validation failed: ${mv.errors.join(', ')}`)
        error.status = 400
        throw error
      }
    }

    const saveRes = await this.deps.storage.saveFile({
      file: params.file,
      ttl: params.ttl,
      metadata: params.metadata,
    })

    if (!saveRes.success) {
      const error: any = new Error(`Failed to save file: ${saveRes.error}`)
      error.status = 500
      throw error
    }

    const fileInfo = saveRes.data as FileInfo
    const respFile = this.toFileResponse(fileInfo)
    const downloadPath = this.generateApiUrl('download/:id', { id: fileInfo.id })

    return {
      file: respFile,
      downloadUrl: this.getFullDownloadUrl(downloadPath),
      downloadPath,
      infoUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
      deleteUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
      message: 'File uploaded successfully',
    }
  }

  async getFileInfo(params: { fileId: string }): Promise<GetFileInfoResponse> {
    const idValidation = ValidationUtil.validateFileId(params.fileId)
    if (!idValidation.isValid) {
      const error: any = new Error(`File ID validation failed: ${idValidation.errors.join(', ')}`)
      error.status = 400
      throw error
    }

    const res = await this.deps.storage.getFileInfo(params.fileId)
    if (!res.success) {
      const notFound = res.error?.includes('not found') || res.error?.includes('expired')
      const error: any = new Error(res.error ?? 'Not found')
      error.status = notFound ? 404 : 500
      throw error
    }

    const fileInfo = res.data as FileInfo
    const downloadPath = this.generateApiUrl('download/:id', { id: fileInfo.id })

    return {
      file: this.toFileResponse(fileInfo),
      downloadUrl: this.getFullDownloadUrl(downloadPath),
      downloadPath,
      deleteUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
    }
  }

  async downloadFileStream(params: {
    fileId: string
  }): Promise<{ stream: ReadableStream<Uint8Array>; fileInfo: FileInfo }> {
    const idValidation = ValidationUtil.validateFileId(params.fileId)
    if (!idValidation.isValid) {
      const error: any = new Error(`File ID validation failed: ${idValidation.errors.join(', ')}`)
      error.status = 400
      throw error
    }

    const fileRes = await this.deps.storage.getFileInfo(params.fileId)
    if (!fileRes.success) {
      const notFound = fileRes.error?.includes('not found') || fileRes.error?.includes('expired')
      const error: any = new Error(fileRes.error ?? 'Not found')
      error.status = notFound ? 404 : 500
      throw error
    }

    const info = fileRes.data as FileInfo
    const streamRes = await this.deps.storage.createFileReadStream(params.fileId)
    if (!streamRes.success) {
      const error: any = new Error(`Failed to create read stream: ${streamRes.error}`)
      error.status = 500
      throw error
    }

    return { stream: streamRes.data as ReadableStream<Uint8Array>, fileInfo: info }
  }

  async deleteFile(params: { fileId: string }): Promise<DeleteFileResponse> {
    const idValidation = ValidationUtil.validateFileId(params.fileId)
    if (!idValidation.isValid) {
      const error: any = new Error(`File ID validation failed: ${idValidation.errors.join(', ')}`)
      error.status = 400
      throw error
    }

    const res = await this.deps.storage.deleteFile(params.fileId)
    if (!res.success) {
      const notFound = res.error?.includes('not found')
      const error: any = new Error(res.error ?? 'Failed to delete')
      error.status = notFound ? 404 : 500
      throw error
    }

    return {
      fileId: params.fileId,
      message: 'File deleted successfully',
      deletedAt: new Date().toISOString(),
    }
  }

  async listFiles(params: {
    mimeType?: string
    minSize?: number
    maxSize?: number
    uploadedAfter?: Date
    uploadedBefore?: Date
    expiredOnly?: boolean
    limit?: number
    offset?: number
  }): Promise<{ files: FileResponse[]; total: number; pagination: any }> {
    const res = await this.deps.storage.searchFiles(params)
    const files = res.files.map((f) => this.toFileResponse(f))

    const limit = params.limit || 10
    const offset = params.offset || 0

    const pagination = {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(res.total / limit),
      hasNext: offset + limit < res.total,
      hasPrev: offset > 0,
    }

    return { files, total: res.total, pagination }
  }

  async getFileStats(): Promise<{ stats: any; generatedAt: string }> {
    const stats = await this.deps.storage.getFileStats()
    return { stats, generatedAt: new Date().toISOString() }
  }

  async fileExists(fileId: string): Promise<boolean> {
    const res = await this.deps.storage.getFileInfo(fileId)
    return !!res.success
  }
}
