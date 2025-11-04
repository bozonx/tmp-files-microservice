import { Controller, Post, Get, Delete, Param, Query, Res, Req, HttpStatus, HttpCode, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { FilesService, UploadFileResponse, GetFileInfoResponse, DeleteFileResponse } from './files.service';
import { ValidationUtil } from '@common/utils/validation.util';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(@Req() request: FastifyRequest): Promise<UploadFileResponse> {
    try {
      const data: any = await (request as any).file();
      if (!data) throw new BadRequestException('No file provided');

      const ttlMinutes = data.fields.ttl ? parseInt(data.fields.ttl.value as string) : 1440;
      const ttl = Math.max(60, Math.floor(ttlMinutes * 60));
      let metadata: Record<string, any> = {};
      if (data.fields.metadata) {
        try { metadata = JSON.parse(data.fields.metadata.value as string); } catch { throw new BadRequestException('Invalid metadata JSON format'); }
      }
      const allowDuplicate = data.fields.allowDuplicate ? data.fields.allowDuplicate.value === 'true' : false;
      const customFilename = data.fields.customFilename ? (data.fields.customFilename.value as string) : undefined;

      const fileBuffer = await data.toBuffer();
      const file = {
        originalname: data.filename || 'unknown',
        mimetype: data.mimetype || 'application/octet-stream',
        size: fileBuffer.length,
        buffer: fileBuffer,
        path: '',
      };

      return await this.filesService.uploadFile({ file, ttl, metadata, allowDuplicate, customFilename });
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(`File upload failed: ${error.message}`);
    }
  }

  @Get('stats')
  async getFileStats(): Promise<{ stats: any; generatedAt: string }> {
    try {
      return await this.filesService.getFileStats();
    } catch (error: any) {
      throw new InternalServerErrorException(`Get file stats failed: ${error.message}`);
    }
  }

  @Get(':id')
  async getFileInfo(@Param('id') fileId: string, @Query('includeExpired') includeExpired?: string): Promise<GetFileInfoResponse> {
    try {
      return await this.filesService.getFileInfo({ fileId, includeExpired: includeExpired === 'true' });
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(`Get file info failed: ${error.message}`);
    }
  }

  @Get(':id/download')
  async downloadFile(
    @Param('id') fileId: string,
    @Query('includeExpired') includeExpired: string | undefined,
    @Res() res: FastifyReply,
  ): Promise<void> {
    try {
      const result = await this.filesService.downloadFile({ fileId, includeExpired: includeExpired === 'true' });
      const { buffer, fileInfo } = result;
      res.header('Content-Type', fileInfo.mimeType);
      res.header('Content-Length', fileInfo.size.toString());
      res.header('Content-Disposition', `attachment; filename="${fileInfo.originalName}"`);
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.header('Pragma', 'no-cache');
      res.header('Expires', '0');
      res.send(buffer);
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(`File download failed: ${error.message}`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteFile(@Param('id') fileId: string, @Query('force') force?: string): Promise<DeleteFileResponse> {
    try {
      return await this.filesService.deleteFile({ fileId, force: force === 'true' });
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(`File deletion failed: ${error.message}`);
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
    @Query('offset') offset?: string,
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
      });
    } catch (error: any) {
      throw new InternalServerErrorException(`List files failed: ${error.message}`);
    }
  }

  @Get(':id/exists')
  @HttpCode(HttpStatus.OK)
  async checkFileExists(@Param('id') fileId: string, @Query('includeExpired') includeExpired?: string): Promise<{ exists: boolean; fileId: string; isExpired: boolean }> {
    try {
      const idValidation = ValidationUtil.validateFileId(fileId);
      if (!idValidation.isValid) {
        throw new BadRequestException(`File ID validation failed: ${idValidation.errors.join(', ')}`);
      }

      const exists = await this.filesService.fileExists(fileId, includeExpired === 'true');
      let isExpired: boolean = false;
      if (exists) {
        try {
          const fileInfo = await this.filesService.getFileInfo({ fileId, includeExpired: includeExpired === 'true' });
          isExpired = fileInfo.file.isExpired;
        } catch {
          isExpired = includeExpired === 'true' ? true : false;
        }
      }
      return { exists, fileId, isExpired };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`File exists check failed: ${error.message}`);
    }
  }
}
