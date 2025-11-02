import { Controller, Get, Post, Delete, Param, Body, Req, Res } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { StorageService } from '../../modules/storage/storage.service';
import { FileInfo, FileStats } from '../../common/interfaces/file.interface';
import {
  StorageHealth,
  FileSearchParams,
  FileSearchResult,
} from '../../common/interfaces/storage.interface';

/**
 * Тестовый контроллер для проверки StorageService
 * Этот контроллер будет удален после завершения разработки
 */
@ApiTags('Storage Test')
@Controller('storage-test')
export class StorageTestController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Получение информации о состоянии хранилища
   */
  @Get('health')
  @ApiOperation({
    summary: 'Storage health check',
    description: 'Проверка состояния хранилища',
  })
  @ApiResponse({
    status: 200,
    description: 'Информация о состоянии хранилища',
  })
  async getStorageHealth(): Promise<StorageHealth> {
    return this.storageService.getStorageHealth();
  }

  /**
   * Получение статистики файлов
   */
  @Get('stats')
  @ApiOperation({
    summary: 'File statistics',
    description: 'Получение статистики файлов в хранилище',
  })
  @ApiResponse({
    status: 200,
    description: 'Статистика файлов',
  })
  async getFileStats(): Promise<FileStats> {
    return this.storageService.getFileStats();
  }

  /**
   * Поиск файлов
   */
  @Post('search')
  @ApiOperation({
    summary: 'Search files',
    description: 'Поиск файлов по параметрам',
  })
  @ApiResponse({
    status: 200,
    description: 'Результаты поиска файлов',
  })
  async searchFiles(@Body() params: FileSearchParams): Promise<FileSearchResult> {
    return this.storageService.searchFiles(params);
  }

  /**
   * Получение информации о файле по ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get file info',
    description: 'Получение информации о файле по ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Информация о файле',
  })
  @ApiResponse({
    status: 404,
    description: 'Файл не найден',
  })
  async getFileInfo(@Param('id') id: string) {
    const result = await this.storageService.getFileInfo(id);
    if (!result.success) {
      return { error: result.error };
    }
    return result.data;
  }

  /**
   * Скачивание файла по ID
   */
  @Get(':id/download')
  @ApiOperation({
    summary: 'Download file',
    description: 'Скачивание файла по ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Файл для скачивания',
  })
  @ApiResponse({
    status: 404,
    description: 'Файл не найден',
  })
  async downloadFile(@Param('id') id: string) {
    const result = await this.storageService.readFile(id);
    if (!result.success) {
      return { error: result.error };
    }
    return result.data;
  }

  /**
   * Удаление файла по ID
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete file',
    description: 'Удаление файла по ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Файл удален',
  })
  @ApiResponse({
    status: 404,
    description: 'Файл не найден',
  })
  async deleteFile(@Param('id') id: string) {
    const result = await this.storageService.deleteFile(id);
    if (!result.success) {
      return { error: result.error };
    }
    return { message: 'File deleted successfully', file: result.data };
  }

  /**
   * Тестовая загрузка файла
   */
  @Post('upload')
  @ApiOperation({
    summary: 'Upload test file',
    description: 'Тестовая загрузка файла для проверки StorageService',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Файл для загрузки',
    type: 'multipart/form-data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        ttl: {
          type: 'number',
          description: 'Время жизни файла в секундах',
          default: 3600,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Файл успешно загружен',
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации',
  })
  async uploadTestFile(@Req() request: any, @Res() reply: FastifyReply) {
    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file provided' });
      }

      // Получаем TTL из полей формы
      const ttlField = data.fields?.ttl;
      const ttl = ttlField ? parseInt(ttlField.value as string, 10) : 3600;

      if (isNaN(ttl) || ttl <= 0) {
        return reply.code(400).send({ error: 'Invalid TTL value' });
      }

      // Создаем объект файла в формате, ожидаемом StorageService
      const file = {
        fieldname: data.fieldname,
        originalname: data.filename,
        encoding: data.encoding,
        mimetype: data.mimetype,
        size: data.file.bytesRead,
        path: '', // Будет заполнено StorageService
        buffer: await data.toBuffer(),
      };

      const result = await this.storageService.saveFile({
        file,
        ttl,
        metadata: {
          uploadedBy: 'test-controller',
          testUpload: true,
        },
      });

      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }

      return reply.code(201).send({
        message: 'File uploaded successfully',
        file: result.data,
      });
    } catch (error) {
      return reply.code(500).send({ error: `Upload failed: ${error.message}` });
    }
  }
}
