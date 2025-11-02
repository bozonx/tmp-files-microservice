/**
 * Контроллер для работы с файлами
 * Предоставляет HTTP endpoints для загрузки, получения информации, скачивания и удаления файлов
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  Res,
  Req,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { FilesService } from './files.service';
import { UploadFileDto, FileValidationDto } from './dto/upload-file.dto';
import {
  FileResponseDto,
  UploadFileResponseDto,
  GetFileInfoResponseDto,
  DeleteFileResponseDto,
  ListFilesResponseDto,
  FileStatsResponseDto,
} from './dto/file-response.dto';
import { HealthResponseDto } from './dto/health-response.dto';
import { UploadedFile as UploadedFileInterface } from '../../common/interfaces/file.interface';
import { ValidationUtil } from '../../common/utils/validation.util';

/**
 * Контроллер для работы с файлами
 * Обрабатывает все HTTP запросы связанные с файлами
 */
@ApiTags('Files')
@Controller('files')
@ApiBearerAuth() // Swagger документация для Bearer аутентификации
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Загрузка файла
   * POST /api/v1/files
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload file',
    description: 'Загружает файл в хранилище с автоматической дедупликацией',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File upload data',
    type: FileValidationDto,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The file to upload',
        },
        ttl: {
          type: 'number',
          description: 'Time to live in seconds (60-2592000)',
          minimum: 60,
          maximum: 2592000,
          default: 3600,
        },
        metadata: {
          type: 'string',
          description: 'JSON string with additional metadata',
          example: '{"description": "Important document", "category": "work"}',
        },
        allowDuplicate: {
          type: 'boolean',
          description: 'Whether to allow duplicate files',
          default: true,
        },
        customFilename: {
          type: 'string',
          description: 'Custom filename for the file',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: UploadFileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file or parameters',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'File validation failed' },
        errorCode: { type: 'string', example: 'VALIDATION_ERROR' },
      },
    },
  })
  @ApiResponse({
    status: 413,
    description: 'File too large',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async uploadFile(@Req() request: FastifyRequest): Promise<UploadFileResponseDto> {
    try {
      // Получаем данные из multipart формы
      const data = await (request as any).file();

      if (!data) {
        throw new BadRequestException('No file provided');
      }

      // Получаем дополнительные параметры из полей формы
      const ttl = data.fields.ttl ? parseInt(data.fields.ttl.value as string) : 3600;

      let metadata = {};
      if (data.fields.metadata) {
        try {
          metadata = JSON.parse(data.fields.metadata.value as string);
        } catch (error) {
          throw new BadRequestException('Invalid metadata JSON format');
        }
      }

      const allowDuplicate = data.fields.allowDuplicate
        ? data.fields.allowDuplicate.value === 'true'
        : true;
      const customFilename = data.fields.customFilename
        ? (data.fields.customFilename.value as string)
        : undefined;

      // Создаем объект файла в формате, ожидаемом сервисом
      const fileBuffer = await data.toBuffer();
      const file: UploadedFileInterface = {
        originalname: data.filename || 'unknown',
        mimetype: data.mimetype || 'application/octet-stream',
        size: fileBuffer.length,
        buffer: fileBuffer,
        path: '',
      };

      const result = await this.filesService.uploadFile({
        file,
        ttl,
        metadata,
        allowDuplicate,
        customFilename,
      });

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Получение информации о файле
   * GET /api/v1/files/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get file information',
    description: 'Получает информацию о файле по его ID',
  })
  @ApiParam({
    name: 'id',
    description: 'File ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiQuery({
    name: 'includeExpired',
    description: 'Include expired files in results',
    required: false,
    type: 'boolean',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'File information retrieved successfully',
    type: GetFileInfoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file ID',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found or expired',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getFileInfo(
    @Param('id') fileId: string,
    @Query('includeExpired') includeExpired?: boolean,
  ): Promise<GetFileInfoResponseDto> {
    try {
      const result = await this.filesService.getFileInfo({
        fileId,
        includeExpired: includeExpired === true,
      });

      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(`Get file info failed: ${error.message}`);
    }
  }

  /**
   * Скачивание файла
   * GET /api/v1/files/:id/download
   */
  @Get(':id/download')
  @ApiOperation({
    summary: 'Download file',
    description: 'Скачивает файл по его ID',
  })
  @ApiParam({
    name: 'id',
    description: 'File ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiQuery({
    name: 'includeExpired',
    description: 'Allow download of expired files',
    required: false,
    type: 'boolean',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'File downloaded successfully',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
    headers: {
      'Content-Type': {
        description: 'MIME type of the file',
        schema: { type: 'string', example: 'application/pdf' },
      },
      'Content-Length': {
        description: 'Size of the file in bytes',
        schema: { type: 'number', example: 1024000 },
      },
      'Content-Disposition': {
        description: 'Attachment filename',
        schema: { type: 'string', example: 'attachment; filename="document.pdf"' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file ID',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found or expired',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async downloadFile(
    @Param('id') fileId: string,
    @Query('includeExpired') includeExpired: boolean,
    @Res() res: FastifyReply,
  ): Promise<void> {
    try {
      const result = await this.filesService.downloadFile({
        fileId,
        includeExpired: includeExpired === true,
      });

      const { buffer, fileInfo } = result;

      // Устанавливаем заголовки для скачивания
      res.header('Content-Type', fileInfo.mimeType);
      res.header('Content-Length', fileInfo.size.toString());
      res.header('Content-Disposition', `attachment; filename="${fileInfo.originalName}"`);
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.header('Pragma', 'no-cache');
      res.header('Expires', '0');

      // Отправляем файл
      res.send(buffer);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(`File download failed: ${error.message}`);
    }
  }

  /**
   * Удаление файла
   * DELETE /api/v1/files/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete file',
    description: 'Удаляет файл по его ID',
  })
  @ApiParam({
    name: 'id',
    description: 'File ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiQuery({
    name: 'force',
    description: 'Force delete even if file is expired',
    required: false,
    type: 'boolean',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
    type: DeleteFileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file ID',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found or expired',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async deleteFile(
    @Param('id') fileId: string,
    @Query('force') force?: boolean,
  ): Promise<DeleteFileResponseDto> {
    try {
      const result = await this.filesService.deleteFile({
        fileId,
        force: force === true,
      });

      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(`File deletion failed: ${error.message}`);
    }
  }

  /**
   * Получение списка файлов с фильтрацией
   * GET /api/v1/files
   */
  @Get()
  @ApiOperation({
    summary: 'List files',
    description: 'Получает список файлов с возможностью фильтрации и пагинации',
  })
  @ApiQuery({
    name: 'mimeType',
    description: 'Filter by MIME type',
    required: false,
    type: 'string',
    example: 'application/pdf',
  })
  @ApiQuery({
    name: 'minSize',
    description: 'Minimum file size in bytes',
    required: false,
    type: 'number',
    example: 1024,
  })
  @ApiQuery({
    name: 'maxSize',
    description: 'Maximum file size in bytes',
    required: false,
    type: 'number',
    example: 10485760,
  })
  @ApiQuery({
    name: 'uploadedAfter',
    description: 'Filter files uploaded after this date (ISO string)',
    required: false,
    type: 'string',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'uploadedBefore',
    description: 'Filter files uploaded before this date (ISO string)',
    required: false,
    type: 'string',
    example: '2024-12-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'expiredOnly',
    description: 'Show only expired files',
    required: false,
    type: 'boolean',
    example: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of files per page',
    required: false,
    type: 'number',
    example: 10,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Number of files to skip',
    required: false,
    type: 'number',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Files listed successfully',
    type: ListFilesResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async listFiles(
    @Query('mimeType') mimeType?: string,
    @Query('minSize') minSize?: number,
    @Query('maxSize') maxSize?: number,
    @Query('uploadedAfter') uploadedAfter?: string,
    @Query('uploadedBefore') uploadedBefore?: string,
    @Query('expiredOnly') expiredOnly?: boolean,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ListFilesResponseDto> {
    try {
      const result = await this.filesService.listFiles({
        mimeType,
        minSize,
        maxSize,
        uploadedAfter: uploadedAfter ? new Date(uploadedAfter) : undefined,
        uploadedBefore: uploadedBefore ? new Date(uploadedBefore) : undefined,
        expiredOnly: expiredOnly === true,
        limit,
        offset,
      });

      return result;
    } catch (error) {
      throw new InternalServerErrorException(`List files failed: ${error.message}`);
    }
  }

  /**
   * Получение статистики файлов
   * GET /api/v1/files/stats
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get file statistics',
    description: 'Получает статистику по файлам в хранилище',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: FileStatsResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getFileStats(): Promise<{ stats: any; generatedAt: string }> {
    try {
      const result = await this.filesService.getFileStats();
      return result;
    } catch (error) {
      throw new InternalServerErrorException(`Get file stats failed: ${error.message}`);
    }
  }

  /**
   * Проверка существования файла
   * HEAD /api/v1/files/:id
   */
  @Get(':id/exists')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if file exists',
    description: 'Проверяет существование файла по его ID',
  })
  @ApiParam({
    name: 'id',
    description: 'File ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiQuery({
    name: 'includeExpired',
    description: 'Include expired files in check',
    required: false,
    type: 'boolean',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'File existence check result',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean', example: true },
        fileId: { type: 'string', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
        isExpired: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file ID',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async checkFileExists(
    @Param('id') fileId: string,
    @Query('includeExpired') includeExpired?: boolean,
  ): Promise<{ exists: boolean; fileId: string; isExpired?: boolean }> {
    try {
      // Валидация ID файла
      const idValidation = ValidationUtil.validateFileId(fileId);
      if (!idValidation.isValid) {
        throw new BadRequestException(
          `File ID validation failed: ${idValidation.errors.join(', ')}`,
        );
      }

      const exists = await this.filesService.fileExists(fileId, includeExpired === true);

      // Если файл существует, получаем дополнительную информацию
      let isExpired: boolean | undefined;
      if (exists) {
        try {
          const fileInfo = await this.filesService.getFileInfo({
            fileId,
            includeExpired: includeExpired === true,
          });
          isExpired = fileInfo.file.isExpired;
        } catch {
          // Если не удалось получить информацию, но файл существует
          isExpired = undefined;
        }
      }

      return {
        exists,
        fileId,
        isExpired,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(`File exists check failed: ${error.message}`);
    }
  }
}
