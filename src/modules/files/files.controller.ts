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
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  FilesService,
  UploadFileResponse,
  GetFileInfoResponse,
  DeleteFileResponse,
} from './files.service.js'
import { ValidationUtil } from '../../common/utils/validation.util.js'

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(@Req() request: FastifyRequest): Promise<UploadFileResponse> {
    try {
      let ttlMins: number | undefined
      let metadata: Record<string, any> = {}
      let gotMetadata = false
      let fileBuffer: Buffer | undefined
      let filename: string | undefined
      let mimetype: string | undefined

      const parts = (request as any).parts?.()
      if (!parts || typeof parts[Symbol.asyncIterator] !== 'function') {
        const data: any = await (request as any).file()
        if (!data) throw new BadRequestException('No file provided')

        const rawTtlField: any = data.fields?.ttlMins
        if (rawTtlField !== undefined && rawTtlField !== null) {
          let ttlStr: string | undefined
          if (typeof rawTtlField === 'string') ttlStr = rawTtlField
          else if (typeof rawTtlField?.value === 'string') ttlStr = rawTtlField.value as string
          else if (Array.isArray(rawTtlField)) {
            const first = rawTtlField[0]
            ttlStr =
              typeof first === 'string'
                ? first
                : typeof first?.value === 'string'
                  ? first.value
                  : undefined
          }
          if (ttlStr !== undefined) ttlMins = parseInt(ttlStr, 10)
        }
        if (data.fields?.metadata !== undefined) {
          let metaStr: string | undefined
          const rawMeta: any = data.fields.metadata
          if (typeof rawMeta === 'string') metaStr = rawMeta
          else if (typeof rawMeta?.value === 'string') metaStr = rawMeta.value as string
          else if (Array.isArray(rawMeta)) {
            const first = rawMeta[0]
            metaStr =
              typeof first === 'string'
                ? first
                : typeof first?.value === 'string'
                  ? first.value
                  : undefined
          }
          if (metaStr && metaStr.trim() !== '') {
            try {
              metadata = JSON.parse(metaStr)
              gotMetadata = true
            } catch {
              throw new BadRequestException('Invalid metadata JSON format')
            }
          }
        }

        const buf = await data.toBuffer()
        fileBuffer = buf
        filename = data.filename || 'unknown'
        mimetype = data.mimetype || 'application/octet-stream'
      } else {
        for await (const part of parts) {
          if (part.type === 'file') {
            if (part.fieldname !== 'file') continue
            filename = part.filename || 'unknown'
            mimetype = part.mimetype || 'application/octet-stream'
            const chunks: Buffer[] = []
            for await (const chunk of part.file) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
            }
            fileBuffer = Buffer.concat(chunks)
          } else if (part.type === 'field') {
            if (part.fieldname === 'ttlMins') {
              const v = String(part.value ?? '').trim()
              if (v !== '') ttlMins = parseInt(v, 10)
            } else if (part.fieldname === 'metadata') {
              const v = String(part.value ?? '').trim()
              if (v !== '') {
                try {
                  metadata = JSON.parse(v)
                  gotMetadata = true
                } catch {
                  throw new BadRequestException('Invalid metadata JSON format')
                }
              }
            }
          }
        }
      }

      if (!fileBuffer) throw new BadRequestException('No file provided')

      const ttl = Math.max(60, Math.floor((ttlMins ?? 1440) * 60))
      const file = {
        originalname: filename || 'unknown',
        mimetype: mimetype || 'application/octet-stream',
        size: fileBuffer.length,
        buffer: fileBuffer,
        path: '',
      }

      return await this.filesService.uploadFile({ file, ttl, metadata })
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException)
        throw error
      throw new InternalServerErrorException(`File upload failed: ${error.message}`)
    }
  }

  @Post('url')
  @HttpCode(HttpStatus.CREATED)
  async uploadFileFromUrl(@Req() request: FastifyRequest): Promise<UploadFileResponse> {
    try {
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

      return await this.filesService.uploadFileFromUrl({ url, ttl, metadata })
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
