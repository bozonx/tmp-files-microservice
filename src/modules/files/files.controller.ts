import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Res,
  Req,
  HttpStatus,
  HttpCode,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  FilesService,
  UploadFileResponse,
  GetFileInfoResponse,
  DeleteFileResponse,
} from './files.service.js'
import { ValidationUtil } from '../../common/utils/validation.util.js'
import { RequestUtil } from '../../common/utils/request.util.js'

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name)

  constructor(private readonly filesService: FilesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(
    @Req() request: FastifyRequest
  ): Promise<UploadFileResponse | UploadFileResponse[]> {
    let cleanupAbortListener: (() => void) | undefined

    try {
      // Check if request is already aborted
      RequestUtil.throwIfAborted(request, 'File upload aborted by client')

      // Setup abort listener to cleanup resources
      cleanupAbortListener = RequestUtil.onRequestAborted(request, () => {
        this.logger.warn('File upload aborted by client during processing')
      })

      const parts = (request as any).parts?.()
      if (!parts) throw new BadRequestException('Multipart request expected')

      let ttlMins: number | undefined
      let metadata: Record<string, any> = {}
      const responses: UploadFileResponse[] = []

      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file') {
            part.file.resume() // Consume and discard unused files
            continue
          }

          const ttl = Math.max(60, Math.floor((ttlMins ?? 1440) * 60))
          const file = {
            originalname: part.filename || 'unknown',
            mimetype: part.mimetype || 'application/octet-stream',
            size: 0, // Streaming upload, size unknown initially
            stream: part.file,
          }

          const response = await this.filesService.uploadFile({ file, ttl, metadata })
          responses.push(response)
        } else if (part.type === 'field') {
          if (part.fieldname === 'ttlMins') {
            const v = String(part.value ?? '').trim()
            if (v !== '') ttlMins = parseInt(v, 10)
          } else if (part.fieldname === 'metadata') {
            const v = String(part.value ?? '').trim()
            if (v !== '') {
              try {
                metadata = JSON.parse(v)
              } catch {
                throw new BadRequestException('Invalid metadata JSON format')
              }
            }
          }
        }
      }

      if (responses.length === 0) {
        throw new BadRequestException('No file provided')
      }

      return responses.length === 1 ? responses[0] : responses
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error
      throw new InternalServerErrorException(`File upload failed: ${error.message}`)
    } finally {
      if (cleanupAbortListener) {
        cleanupAbortListener()
      }
    }
  }

  @Post('url')
  @HttpCode(HttpStatus.CREATED)
  async uploadFileFromUrl(@Req() request: FastifyRequest): Promise<UploadFileResponse> {
    try {
      // Check if request is already aborted
      RequestUtil.throwIfAborted(request, 'File upload by URL aborted by client')

      const body: any = (request as any).body || {}
      const url = body.url
      if (!url || typeof url !== 'string') {
        throw new BadRequestException('Field "url" is required and must be a string')
      }

      const hasTtl = body.ttlMins !== undefined && body.ttlMins !== null
      const ttlMins = hasTtl ? parseInt(String(body.ttlMins), 10) : 1440
      const ttl = Math.max(60, Math.floor(ttlMins * 60))

      let metadata: Record<string, any> | undefined
      if (body.metadata !== undefined) {
        if (typeof body.metadata === 'string' && body.metadata.trim() !== '') {
          try {
            metadata = JSON.parse(body.metadata)
          } catch {
            throw new BadRequestException('Invalid metadata JSON format')
          }
        } else if (typeof body.metadata === 'object' && body.metadata !== null) {
          metadata = body.metadata
        }
      }

      return await this.filesService.uploadFileFromUrl({ url, ttl, metadata, request })
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException)
        throw error
      throw new InternalServerErrorException(`File upload by URL failed: ${error.message}`)
    }
  }

  @Get('stats')
  async getFileStats(): Promise<{ stats: any; generatedAt: string }> {
    try {
      return await this.filesService.getFileStats()
    } catch (error: any) {
      throw new InternalServerErrorException(`Get file stats failed: ${error.message}`)
    }
  }

  @Get(':id')
  async getFileInfo(@Param('id') fileId: string): Promise<GetFileInfoResponse> {
    try {
      return await this.filesService.getFileInfo({ fileId })
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      )
        throw error
      throw new InternalServerErrorException(`Get file info failed: ${error.message}`)
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteFile(@Param('id') fileId: string): Promise<DeleteFileResponse> {
    try {
      return await this.filesService.deleteFile({ fileId })
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      )
        throw error
      throw new InternalServerErrorException(`File deletion failed: ${error.message}`)
    }
  }

  @Get()
  async listFiles(
    @Query('mimeType') mimeType?: string,
    @Query('minSize') minSize?: string,
    @Query('maxSize') maxSize?: string,
    @Query('uploadedAfter') uploadedAfter?: string,
    @Query('uploadedBefore') uploadedBefore?: string,
    @Query('expiredOnly') expiredOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<{ files: any[]; total: number; pagination: any }> {
    try {
      return await this.filesService.listFiles({
        mimeType,
        minSize: minSize ? parseInt(minSize) : undefined,
        maxSize: maxSize ? parseInt(maxSize) : undefined,
        uploadedAfter: uploadedAfter ? new Date(uploadedAfter) : undefined,
        uploadedBefore: uploadedBefore ? new Date(uploadedBefore) : undefined,
        expiredOnly: expiredOnly === 'true',
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      })
    } catch (error: any) {
      throw new InternalServerErrorException(`List files failed: ${error.message}`)
    }
  }

  @Get(':id/exists')
  @HttpCode(HttpStatus.OK)
  async checkFileExists(
    @Param('id') fileId: string
  ): Promise<{ exists: boolean; fileId: string; isExpired: boolean }> {
    try {
      const idValidation = ValidationUtil.validateFileId(fileId)
      if (!idValidation.isValid) {
        throw new BadRequestException(
          `File ID validation failed: ${idValidation.errors.join(', ')}`
        )
      }

      const exists = await this.filesService.fileExists(fileId)
      if (!exists) {
        return { exists, fileId, isExpired: false }
      }
      const fileInfo = await this.filesService.getFileInfo({ fileId })
      return { exists, fileId, isExpired: fileInfo.file.isExpired }
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error
      throw new InternalServerErrorException(`File exists check failed: ${error.message}`)
    }
  }
}
