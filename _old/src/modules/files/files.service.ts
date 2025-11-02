/**
 * Сервис для работы с файлами
 * Содержит бизнес-логику для загрузки, получения информации, скачивания и удаления файлов
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateUtil } from '../../common/utils/date.util';

import { StorageService } from '../storage/storage.service';
import { ValidationUtil } from '../../common/utils/validation.util';
import { UploadedFile, FileInfo, FileResponse } from '../../common/interfaces/file.interface';
import { UploadFileDto } from './dto/upload-file.dto';
import {
  FileResponseDto,
  UploadFileResponseDto,
  GetFileInfoResponseDto,
  DeleteFileResponseDto,
} from './dto/file-response.dto';

/**
 * Параметры для загрузки файла
 */
interface UploadFileParams {
  file: UploadedFile;
  ttl: number; // Теперь обязательный параметр
  metadata?: Record<string, any>;
  allowDuplicate?: boolean;
  customFilename?: string;
}

/**
 * Параметры для получения информации о файле
 */
interface GetFileInfoParams {
  fileId: string;
  includeExpired?: boolean;
}

/**
 * Параметры для скачивания файла
 */
interface DownloadFileParams {
  fileId: string;
  includeExpired?: boolean;
}

/**
 * Параметры для удаления файла
 */
interface DeleteFileParams {
  fileId: string;
  force?: boolean;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly defaultTTL: number;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.defaultTTL = (this.configService.get<number>('MAX_TTL_MIN') || 10080) * 60; // Конвертируем минуты в секунды
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE_MB', 100) * 1024 * 1024; // Конвертируем MB в байты
    this.allowedMimeTypes = this.configService.get<string[]>('ALLOWED_MIME_TYPES', []); // Пустой массив = разрешены все типы
  }

  /**
   * Генерирует URL для API эндпоинта
   * @param endpoint Эндпоинт (например, 'files', 'files/:id/download')
   * @param params Параметры для замены в эндпоинте
   * @returns Полный URL
   */
  private generateApiUrl(endpoint: string, params: Record<string, string> = {}): string {
    const config = this.configService.get('server');

    // Если конфигурация сервера недоступна (например, в тестах), используем значения по умолчанию
    const basePath = config?.basePath || 'api';
    const apiVersion = config?.apiVersion || 'v1';

    // Формируем префикс
    const prefix = basePath ? `${basePath}/${apiVersion}` : apiVersion;

    // Заменяем параметры в эндпоинте
    let url = `/${prefix}/${endpoint}`;
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });

    return url;
  }

  /**
   * Загрузка файла с дедупликацией и валидацией
   */
  async uploadFile(params: UploadFileParams): Promise<UploadFileResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.log(`Starting file upload: ${params.file.originalname}`);

      // Нормализация параметров
      const validatedParams = this.validateUploadParams(params);

      // Валидация файла
      const fileValidation = ValidationUtil.validateUploadedFile(
        validatedParams.file,
        this.allowedMimeTypes,
        this.maxFileSize,
      );
      if (!fileValidation.isValid) {
        throw new BadRequestException(
          `File validation failed: ${fileValidation.errors.join(', ')}`,
        );
      }

      // Валидация TTL
      const config = this.configService.get('storage');
      const ttlValidation = ValidationUtil.validateTTL(
        validatedParams.ttl,
        60, // Минимум 1 минута
        config.maxTtl,
      );
      if (!ttlValidation.isValid) {
        throw new BadRequestException(`TTL validation failed: ${ttlValidation.errors.join(', ')}`);
      }

      // Валидация метаданных
      if (validatedParams.metadata) {
        const metadataValidation = ValidationUtil.validateMetadata(validatedParams.metadata);
        if (!metadataValidation.isValid) {
          throw new BadRequestException(
            `Metadata validation failed: ${metadataValidation.errors.join(', ')}`,
          );
        }
      }

      // Подготовка параметров для StorageService
      const createFileParams = {
        file: validatedParams.file,
        ttl: validatedParams.ttl,
        metadata: validatedParams.metadata,
      };

      // Если указано кастомное имя файла, добавляем его в метаданные
      if (validatedParams.customFilename) {
        createFileParams.metadata.customFilename = validatedParams.customFilename;
      }

      // Сохранение файла через StorageService
      const saveResult = await this.storageService.saveFile(createFileParams);

      if (!saveResult.success) {
        throw new InternalServerErrorException(`Failed to save file: ${saveResult.error}`);
      }

      const fileInfo = saveResult.data as FileInfo;
      const executionTime = Date.now() - startTime;

      this.logger.log(`File uploaded successfully: ${fileInfo.id} (${executionTime}ms)`);

      // Преобразуем FileInfo в FileResponseDto
      const fileResponse = this.convertToFileResponseDto(fileInfo);

      // Создаем ответ
      const response: UploadFileResponseDto = {
        file: fileResponse,
        downloadUrl: this.generateApiUrl('files/:id/download', { id: fileInfo.id }),
        infoUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
        deleteUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
        message: 'File uploaded successfully',
      };

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`File upload failed: ${error.message} (${executionTime}ms)`, error.stack);

      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Получение информации о файле
   */
  async getFileInfo(params: GetFileInfoParams): Promise<GetFileInfoResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.log(`Getting file info: ${params.fileId}`);

      // Валидация ID файла
      const idValidation = ValidationUtil.validateFileId(params.fileId);
      if (!idValidation.isValid) {
        throw new BadRequestException(
          `File ID validation failed: ${idValidation.errors.join(', ')}`,
        );
      }

      // Получение информации о файле через StorageService
      const fileResult = await this.storageService.getFileInfo(params.fileId);

      if (!fileResult.success) {
        if (fileResult.error?.includes('not found')) {
          throw new NotFoundException(`File with ID ${params.fileId} not found`);
        }
        if (fileResult.error?.includes('expired')) {
          if (params.includeExpired) {
            // Если разрешено включать истекшие файлы, но файл истек,
            // то это означает что файл не найден в метаданных
            throw new NotFoundException(`File with ID ${params.fileId} not found`);
          } else {
            throw new NotFoundException(`File with ID ${params.fileId} has expired`);
          }
        }
        throw new InternalServerErrorException(`Failed to get file info: ${fileResult.error}`);
      }

      const fileInfo = fileResult.data as FileInfo;
      const executionTime = Date.now() - startTime;

      this.logger.log(`File info retrieved successfully: ${fileInfo.id} (${executionTime}ms)`);

      // Преобразуем FileInfo в FileResponseDto
      const fileResponse = this.convertToFileResponseDto(fileInfo);

      // Создаем ответ
      const response: GetFileInfoResponseDto = {
        file: fileResponse,
        downloadUrl: this.generateApiUrl('files/:id/download', { id: fileInfo.id }),
        deleteUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
      };

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Get file info failed: ${error.message} (${executionTime}ms)`, error.stack);

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
   */
  async downloadFile(params: DownloadFileParams): Promise<{ buffer: Buffer; fileInfo: FileInfo }> {
    const startTime = Date.now();

    try {
      this.logger.log(`Downloading file: ${params.fileId}`);

      // Валидация ID файла
      const idValidation = ValidationUtil.validateFileId(params.fileId);
      if (!idValidation.isValid) {
        throw new BadRequestException(
          `File ID validation failed: ${idValidation.errors.join(', ')}`,
        );
      }

      // Получение информации о файле
      const fileResult = await this.storageService.getFileInfo(params.fileId);

      if (!fileResult.success) {
        if (fileResult.error?.includes('not found')) {
          throw new NotFoundException(`File with ID ${params.fileId} not found`);
        }
        if (fileResult.error?.includes('expired') && !params.includeExpired) {
          throw new NotFoundException(`File with ID ${params.fileId} has expired`);
        }
        throw new InternalServerErrorException(`Failed to get file info: ${fileResult.error}`);
      }

      const fileInfo = fileResult.data as FileInfo;

      // Чтение файла через StorageService
      const readResult = await this.storageService.readFile(params.fileId);

      if (!readResult.success) {
        throw new InternalServerErrorException(`Failed to read file: ${readResult.error}`);
      }

      const executionTime = Date.now() - startTime;
      this.logger.log(`File downloaded successfully: ${fileInfo.id} (${executionTime}ms)`);

      return {
        buffer: readResult.data as Buffer,
        fileInfo,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`File download failed: ${error.message} (${executionTime}ms)`, error.stack);

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
   */
  async deleteFile(params: DeleteFileParams): Promise<DeleteFileResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.log(`Deleting file: ${params.fileId}`);

      // Валидация ID файла
      const idValidation = ValidationUtil.validateFileId(params.fileId);
      if (!idValidation.isValid) {
        throw new BadRequestException(
          `File ID validation failed: ${idValidation.errors.join(', ')}`,
        );
      }

      // Получение информации о файле перед удалением
      const fileResult = await this.storageService.getFileInfo(params.fileId);

      if (!fileResult.success) {
        if (fileResult.error?.includes('not found')) {
          throw new NotFoundException(`File with ID ${params.fileId} not found`);
        }
        if (fileResult.error?.includes('expired')) {
          if (!params.force) {
            throw new NotFoundException(`File with ID ${params.fileId} has expired`);
          }
          // Если force=true, продолжаем с удалением даже для истекших файлов
        } else {
          throw new InternalServerErrorException(`Failed to get file info: ${fileResult.error}`);
        }
      }

      // Удаление файла через StorageService
      const deleteResult = await this.storageService.deleteFile(params.fileId);

      if (!deleteResult.success) {
        throw new InternalServerErrorException(`Failed to delete file: ${deleteResult.error}`);
      }

      const fileInfo = deleteResult.data as FileInfo;
      const executionTime = Date.now() - startTime;
      this.logger.log(`File deleted successfully: ${fileInfo.id} (${executionTime}ms)`);

      // Создаем ответ
      const response: DeleteFileResponseDto = {
        fileId: fileInfo.id,
        message: 'File deleted successfully',
        deletedAt: new Date().toISOString(),
      };

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`File deletion failed: ${error.message} (${executionTime}ms)`, error.stack);

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
   */
  async listFiles(params: {
    mimeType?: string;
    minSize?: number;
    maxSize?: number;
    uploadedAfter?: Date;
    uploadedBefore?: Date;
    expiredOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ files: FileResponseDto[]; total: number; pagination: any }> {
    const startTime = Date.now();

    try {
      this.logger.log('Listing files with filters');

      // Поиск файлов через StorageService
      const searchResult = await this.storageService.searchFiles(params);

      const executionTime = Date.now() - startTime;
      this.logger.log(
        `Files listed successfully: ${searchResult.files.length} files (${executionTime}ms)`,
      );

      // Преобразуем FileInfo в FileResponseDto
      const files = searchResult.files.map((fileInfo) => this.convertToFileResponseDto(fileInfo));

      // Создаем информацию о пагинации
      const pagination = {
        page: Math.floor((params.offset || 0) / (params.limit || 10)) + 1,
        limit: params.limit || 10,
        totalPages: Math.ceil(searchResult.total / (params.limit || 10)),
        hasNext: (params.offset || 0) + (params.limit || 10) < searchResult.total,
        hasPrev: (params.offset || 0) > 0,
      };

      return {
        files,
        total: searchResult.total,
        pagination,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`List files failed: ${error.message} (${executionTime}ms)`, error.stack);

      throw new InternalServerErrorException(`List files failed: ${error.message}`);
    }
  }

  /**
   * Получение статистики файлов
   */
  async getFileStats(): Promise<{ stats: any; generatedAt: string }> {
    const startTime = Date.now();

    try {
      this.logger.log('Getting file statistics');

      // Получение статистики через StorageService
      const stats = await this.storageService.getFileStats();

      const executionTime = Date.now() - startTime;
      this.logger.log(`File statistics retrieved successfully (${executionTime}ms)`);

      return {
        stats,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(
        `Get file stats failed: ${error.message} (${executionTime}ms)`,
        error.stack,
      );

      throw new InternalServerErrorException(`Get file stats failed: ${error.message}`);
    }
  }

  /**
   * Проверка существования файла
   */
  async fileExists(fileId: string, includeExpired: boolean = false): Promise<boolean> {
    try {
      const fileResult = await this.storageService.getFileInfo(fileId);

      if (!fileResult.success) {
        return false;
      }

      // Если файл истек и не разрешено включать истекшие файлы
      if (fileResult.error?.includes('expired') && !includeExpired) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`File exists check failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Преобразование FileInfo в FileResponseDto
   */
  private convertToFileResponseDto(fileInfo: FileInfo): FileResponseDto {
    // Преобразуем даты в объекты Date, если они являются строками
    const uploadedAt =
      typeof fileInfo.uploadedAt === 'string' ? new Date(fileInfo.uploadedAt) : fileInfo.uploadedAt;
    const expiresAt =
      typeof fileInfo.expiresAt === 'string' ? new Date(fileInfo.expiresAt) : fileInfo.expiresAt;

    return {
      id: fileInfo.id,
      originalName: fileInfo.originalName,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      uploadedAt: uploadedAt.toISOString(),
      ttl: fileInfo.ttl,
      expiresAt: expiresAt.toISOString(),
      metadata: fileInfo.metadata,
      hash: fileInfo.hash,
      isExpired: DateUtil.isExpired(expiresAt),
      timeRemaining: Math.max(0, DateUtil.diffInSeconds(expiresAt, DateUtil.now().toDate())),
    };
  }

  /**
   * Валидация и нормализация параметров загрузки
   */
  private validateUploadParams(params: UploadFileParams): UploadFileParams {
    const validatedParams = { ...params };

    // TTL теперь обязательный параметр, нормализация не нужна

    // Нормализация метаданных
    if (!validatedParams.metadata) {
      validatedParams.metadata = {};
    }

    // Нормализация allowDuplicate
    if (validatedParams.allowDuplicate === undefined || validatedParams.allowDuplicate === null) {
      validatedParams.allowDuplicate = true;
    }

    return validatedParams;
  }

  /**
   * Проверка доступности хранилища
   */
  async isStorageAvailable(): Promise<boolean> {
    try {
      const health = await this.storageService.getStorageHealth();
      return health.isAvailable;
    } catch (error) {
      this.logger.error(`Storage availability check failed: ${error.message}`, error.stack);
      return false;
    }
  }
}
