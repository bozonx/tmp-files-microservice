import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  PayloadTooLargeException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { FastifyRequest } from 'fastify'
import type { ReadStream } from 'fs'
import { DateUtil } from '../../common/utils/date.util.js'
import { StorageService } from '../storage/storage.service.js'
import { ValidationUtil } from '../../common/utils/validation.util.js'
import { RequestUtil } from '../../common/utils/request.util.js'
import { UploadedFile, FileInfo } from '../../common/interfaces/file.interface.js'
import type { AppConfig } from '../../config/app.config.js'
import type { StorageAppConfig } from '../../config/storage.config.js'
import * as http from 'http'
import * as https from 'https'

interface UploadFileParams {
  file: UploadedFile
  ttl: number
  metadata?: Record<string, any>
}

interface GetFileInfoParams {
  fileId: string
}
interface DownloadFileParams {
  fileId: string
}
interface DeleteFileParams {
  fileId: string
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
  infoUrl: string
  deleteUrl: string
  message: string
}

export interface GetFileInfoResponse {
  file: FileResponse
  downloadUrl: string
  deleteUrl: string
}
export interface DeleteFileResponse {
  fileId: string
  message: string
  deletedAt: string
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name)
  private readonly maxFileSize: number
  private readonly allowedMimeTypes: string[]

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService
  ) {
    const storageCfg = this.configService.get<StorageAppConfig>('storage')
    this.maxFileSize = storageCfg?.maxFileSize ?? 100 * 1024 * 1024
    this.allowedMimeTypes = storageCfg?.allowedMimeTypes ?? []
  }

  async uploadFileFromUrl(params: {
    url: string
    ttl: number
    metadata?: Record<string, any>
    request?: FastifyRequest
  }): Promise<UploadFileResponse> {
    const startTime = Date.now()
    try {
      if (!params.url || typeof params.url !== 'string') {
        throw new BadRequestException('Invalid URL')
      }

      // Check if request was aborted before starting remote fetch
      if (params.request) {
        RequestUtil.throwIfAborted(params.request, 'File upload by URL aborted by client')
      }

      const file = await this.fetchRemoteFile(params.url, params.request)
      // Reuse existing validation and save pipeline
      return await this.uploadFile({ file, ttl: params.ttl, metadata: params.metadata })
    } catch (error: any) {
      const executionTime = Date.now() - startTime
      this.logger.error(
        `File upload by URL failed: ${error.message} (${executionTime}ms)`,
        error.stack
      )
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException ||
        error instanceof PayloadTooLargeException
      )
        throw error
      throw new InternalServerErrorException(`File upload by URL failed: ${error.message}`)
    }
  }

  private generateApiUrl(endpoint: string, params: Record<string, string> = {}): string {
    const appCfg = this.configService.get<AppConfig>('app')!
    const apiPrefix = 'api/v1'
    const prefix = appCfg.basePath ? `${appCfg.basePath}/${apiPrefix}` : apiPrefix
    let url = `/${prefix}/${endpoint}`
    Object.entries(params).forEach(([k, v]) => (url = url.replace(`:${k}`, v)))
    return url
  }

  async uploadFile(params: UploadFileParams): Promise<UploadFileResponse> {
    const startTime = Date.now()
    try {
      this.logger.log(`Starting file upload: ${params.file.originalname}`)

      const v = ValidationUtil.validateUploadedFile(
        params.file,
        this.allowedMimeTypes,
        this.maxFileSize
      )
      if (!v.isValid) {
        const tooLarge = v.errors.some((e) => e.includes('exceeds maximum allowed size'))
        if (tooLarge) {
          throw new PayloadTooLargeException('File size exceeds the maximum allowed limit')
        }
        throw new BadRequestException(`File validation failed: ${v.errors.join(', ')}`)
      }

      const storageCfg = this.configService.get('storage')
      const ttlValidation = ValidationUtil.validateTTL(
        params.ttl,
        60,
        storageCfg?.maxTtl ?? 31 * 24 * 3600
      )
      if (!ttlValidation.isValid)
        throw new BadRequestException(`TTL validation failed: ${ttlValidation.errors.join(', ')}`)

      if (params.metadata) {
        const mv = ValidationUtil.validateMetadata(params.metadata)
        if (!mv.isValid)
          throw new BadRequestException(`Metadata validation failed: ${mv.errors.join(', ')}`)
      }

      const saveResult = await this.storageService.saveFile({
        file: params.file,
        ttl: params.ttl,
        metadata: params.metadata,
      })
      if (!saveResult.success)
        throw new InternalServerErrorException(`Failed to save file: ${saveResult.error}`)

      const fileInfo = saveResult.data as FileInfo
      const respFile = this.toFileResponse(fileInfo)

      return {
        file: respFile,
        downloadUrl: this.generateApiUrl('download/:id', { id: fileInfo.id }),
        infoUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
        deleteUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
        message: 'File uploaded successfully',
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime
      this.logger.error(`File upload failed: ${error.message} (${executionTime}ms)`, error.stack)
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException ||
        error instanceof PayloadTooLargeException
      )
        throw error
      throw new InternalServerErrorException(`File upload failed: ${error.message}`)
    }
  }

  async getFileInfo(params: GetFileInfoParams): Promise<GetFileInfoResponse> {
    const startTime = Date.now()
    try {
      const idValidation = ValidationUtil.validateFileId(params.fileId)
      if (!idValidation.isValid)
        throw new BadRequestException(
          `File ID validation failed: ${idValidation.errors.join(', ')}`
        )

      const fileResult = await this.storageService.getFileInfo(params.fileId)
      if (!fileResult.success) {
        if (fileResult.error?.includes('not found'))
          throw new NotFoundException(`File with ID ${params.fileId} not found`)
        if (fileResult.error?.includes('expired'))
          throw new NotFoundException(`File with ID ${params.fileId} has expired`)
        throw new InternalServerErrorException(`Failed to get file info: ${fileResult.error}`)
      }

      const fileInfo = fileResult.data as FileInfo
      const fileResponse = this.toFileResponse(fileInfo)
      return {
        file: fileResponse,
        downloadUrl: this.generateApiUrl('download/:id', { id: fileInfo.id }),
        deleteUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime
      this.logger.error(`Get file info failed: ${error.message} (${executionTime}ms)`, error.stack)
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      )
        throw error
      throw new InternalServerErrorException(`Get file info failed: ${error.message}`)
    }
  }

  async downloadFile(params: DownloadFileParams): Promise<{ buffer: Buffer; fileInfo: FileInfo }> {
    const startTime = Date.now()
    try {
      const idValidation = ValidationUtil.validateFileId(params.fileId)
      if (!idValidation.isValid)
        throw new BadRequestException(
          `File ID validation failed: ${idValidation.errors.join(', ')}`
        )

      const fileResult = await this.storageService.getFileInfo(params.fileId)
      if (!fileResult.success) {
        if (fileResult.error?.includes('not found'))
          throw new NotFoundException(`File with ID ${params.fileId} not found`)
        if (fileResult.error?.includes('expired'))
          throw new NotFoundException(`File with ID ${params.fileId} has expired`)
        throw new InternalServerErrorException(`Failed to get file info: ${fileResult.error}`)
      }
      const fileInfo = fileResult.data as FileInfo

      const readResult = await this.storageService.readFile(params.fileId)
      if (!readResult.success)
        throw new InternalServerErrorException(`Failed to read file: ${readResult.error}`)

      return { buffer: readResult.data as Buffer, fileInfo }
    } catch (error: any) {
      const executionTime = Date.now() - startTime
      this.logger.error(`File download failed: ${error.message} (${executionTime}ms)`, error.stack)
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      )
        throw error
      throw new InternalServerErrorException(`File download failed: ${error.message}`)
    }
  }

  async downloadFileStream(
    params: DownloadFileParams
  ): Promise<{ stream: ReadStream; fileInfo: FileInfo }> {
    const startTime = Date.now()
    try {
      const idValidation = ValidationUtil.validateFileId(params.fileId)
      if (!idValidation.isValid)
        throw new BadRequestException(
          `File ID validation failed: ${idValidation.errors.join(', ')}`
        )

      const fileResult = await this.storageService.getFileInfo(params.fileId)
      if (!fileResult.success) {
        if (fileResult.error?.includes('not found'))
          throw new NotFoundException(`File with ID ${params.fileId} not found`)
        if (fileResult.error?.includes('expired'))
          throw new NotFoundException(`File with ID ${params.fileId} has expired`)
        throw new InternalServerErrorException(`Failed to get file info: ${fileResult.error}`)
      }
      const fileInfo = fileResult.data as FileInfo

      const streamResult = await this.storageService.createFileReadStream(params.fileId)
      if (!streamResult.success)
        throw new InternalServerErrorException(
          `Failed to create read stream: ${streamResult.error}`
        )

      return { stream: streamResult.data as ReadStream, fileInfo }
    } catch (error: any) {
      const executionTime = Date.now() - startTime
      this.logger.error(
        `File download stream failed: ${error.message} (${executionTime}ms)`,
        error.stack
      )
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      )
        throw error
      throw new InternalServerErrorException(`File download stream failed: ${error.message}`)
    }
  }

  async deleteFile(params: DeleteFileParams): Promise<DeleteFileResponse> {
    const startTime = Date.now()
    try {
      const idValidation = ValidationUtil.validateFileId(params.fileId)
      if (!idValidation.isValid)
        throw new BadRequestException(
          `File ID validation failed: ${idValidation.errors.join(', ')}`
        )

      const deleteResult = await this.storageService.deleteFile(params.fileId)
      if (!deleteResult.success) {
        if (deleteResult.error?.includes('not found')) {
          throw new NotFoundException(`File with ID ${params.fileId} not found`)
        }
        throw new InternalServerErrorException(`Failed to delete file: ${deleteResult.error}`)
      }

      const fileInfo = deleteResult.data as FileInfo
      return {
        fileId: fileInfo.id,
        message: 'File deleted successfully',
        deletedAt: new Date().toISOString(),
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime
      this.logger.error(`File deletion failed: ${error.message} (${executionTime}ms)`, error.stack)
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      )
        throw error
      throw new InternalServerErrorException(`File deletion failed: ${error.message}`)
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
    try {
      const searchResult = await this.storageService.searchFiles(params)
      const files = searchResult.files.map((f) => this.toFileResponse(f))
      const pagination = {
        page: Math.floor((params.offset || 0) / (params.limit || 10)) + 1,
        limit: params.limit || 10,
        totalPages: Math.ceil(searchResult.total / (params.limit || 10)),
        hasNext: (params.offset || 0) + (params.limit || 10) < searchResult.total,
        hasPrev: (params.offset || 0) > 0,
      }
      return { files, total: searchResult.total, pagination }
    } catch (error: any) {
      throw new InternalServerErrorException(`List files failed: ${error.message}`)
    }
  }

  async getFileStats(): Promise<{ stats: any; generatedAt: string }> {
    const startTime = Date.now()
    try {
      const stats = await this.storageService.getFileStats()
      return { stats, generatedAt: new Date().toISOString() }
    } catch (error: any) {
      const executionTime = Date.now() - startTime
      this.logger.error(`Get file stats failed: ${error.message} (${executionTime}ms)`, error.stack)
      throw new InternalServerErrorException(`Get file stats failed: ${error.message}`)
    }
  }

  async fileExists(fileId: string): Promise<boolean> {
    try {
      const fileResult = await this.storageService.getFileInfo(fileId)
      return !!fileResult.success
    } catch (error: any) {
      this.logger.error(`File exists check failed: ${error.message}`, error.stack)
      return false
    }
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

  private async fetchRemoteFile(
    urlStr: string,
    clientRequest?: FastifyRequest,
    redirectCount = 0
  ): Promise<UploadedFile> {
    return new Promise<UploadedFile>((resolve, reject) => {
      try {
        const urlObj = new URL(urlStr)
        const lib = urlObj.protocol === 'https:' ? https : http

        let abortCleanup: (() => void) | undefined
        let httpRequest: http.ClientRequest | undefined

        // Setup abort listener if client request is provided
        if (clientRequest) {
          abortCleanup = RequestUtil.onRequestAborted(clientRequest, () => {
            this.logger.warn('Remote file fetch aborted due to client disconnect')
            if (httpRequest) {
              httpRequest.destroy()
            }
            reject(new BadRequestException('File upload by URL aborted by client'))
          })
        }

        httpRequest = lib.get(urlObj, (res) => {
          // Check if client aborted before processing response
          if (clientRequest && RequestUtil.isRequestAborted(clientRequest)) {
            res.destroy()
            if (abortCleanup) abortCleanup()
            return reject(new BadRequestException('File upload by URL aborted by client'))
          }

          // Handle redirects (up to 5)
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            if (redirectCount >= 5) {
              if (abortCleanup) abortCleanup()
              return reject(new BadRequestException('Too many redirects'))
            }
            const nextUrl = new URL(res.headers.location, urlObj).toString()
            res.resume()
            if (abortCleanup) abortCleanup()
            return resolve(this.fetchRemoteFile(nextUrl, clientRequest, redirectCount + 1))
          }

          if (res.statusCode !== 200) {
            res.resume()
            if (abortCleanup) abortCleanup()
            return reject(new BadRequestException(`Failed to fetch URL. Status: ${res.statusCode}`))
          }

          const contentType = (res.headers['content-type'] as string) || 'application/octet-stream'
          const contentLengthHeader = res.headers['content-length']
          const size = contentLengthHeader ? parseInt(String(contentLengthHeader), 10) : 0
          
          if (size && size > this.maxFileSize) {
            res.destroy()
            if (abortCleanup) abortCleanup()
            return reject(
              new PayloadTooLargeException('File size exceeds the maximum allowed limit')
            )
          }

          // Derive filename
          let filename = 'file'
          const cd = res.headers['content-disposition']
          if (typeof cd === 'string') {
            const match =
              cd.match(/filename\*=UTF-8''([^;\n]+)/) || cd.match(/filename="?([^";\n]+)"?/)
            if (match && match[1]) filename = decodeURIComponent(match[1])
          } else {
            const pathname = urlObj.pathname
            const last = pathname.split('/').filter(Boolean).pop()
            if (last) filename = last
          }
          
          if (abortCleanup) abortCleanup()

          const uploaded: UploadedFile = {
            originalname: filename,
            mimetype: contentType,
            size,
            stream: res
          }
          resolve(uploaded)
        })
        
        httpRequest.on('error', (err) => {
          if (abortCleanup) abortCleanup()
          reject(err)
        })
      } catch (err) {
        reject(err)
      }
    })
  }

}
