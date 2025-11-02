/**
 * Сервис для работы с файловым хранилищем
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { v4 as uuidv4 } from 'uuid';

import {
  FileInfo,
  CreateFileParams,
  FileOperationResult,
  FileStats,
} from '../../common/interfaces/file.interface';
import {
  StorageConfig,
  StorageMetadata,
  StorageOperationResult,
  StorageHealth,
  FileSearchParams,
  FileSearchResult,
} from '../../common/interfaces/storage.interface';
import { HashUtil } from '../../common/utils/hash.util';
import { FilenameUtil } from '../../common/utils/filename.util';
import { DateUtil } from '../../common/utils/date.util';
import { STORAGE_CONSTANTS } from '../../config/app.config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private config: StorageConfig;
  private metadataPath: string;

  constructor(private readonly configService: ConfigService) {
    // Инициализация конфигурации будет выполнена при первом обращении к сервису
    // Это позволяет переопределить конфигурацию в тестах
  }

  /**
   * Получение конфигурации с ленивой инициализацией
   */
  private getConfig(): StorageConfig {
    if (!this.config) {
      // Получаем базовый путь и преобразуем его в абсолютный
      const basePath = this.configService.get<string>('STORAGE_DIR', './storage');
      const absoluteBasePath = path.isAbsolute(basePath) ? basePath : path.resolve(basePath);

      this.config = {
        basePath: absoluteBasePath,
        maxFileSize: this.configService.get<number>('MAX_FILE_SIZE_MB', 100) * 1024 * 1024, // Конвертируем MB в байты
        allowedMimeTypes: this.configService.get<string[]>('ALLOWED_MIME_TYPES', []), // Пустой массив = разрешены все типы
        enableDeduplication: this.configService.get<boolean>('ENABLE_DEDUPLICATION', true),
      };

      this.metadataPath = path.join(this.config.basePath, 'data.json');
    }
    return this.config;
  }

  /**
   * Публичный метод для получения конфигурации (для тестов)
   */
  public getConfigForTesting(): StorageConfig {
    return this.getConfig();
  }

  /**
   * Инициализация хранилища
   */
  private async initializeStorage(): Promise<void> {
    try {
      const config = this.getConfig();

      // Создаем базовую директорию если она не существует (используем абсолютный путь)
      const baseDir = path.resolve(config.basePath);
      await fs.ensureDir(baseDir);

      // Убеждаемся, что metadataPath инициализирован
      if (!this.metadataPath) {
        this.metadataPath = path.join(config.basePath, 'data.json');
      }

      // Создаем файл метаданных если он не существует
      if (!(await fs.pathExists(this.metadataPath))) {
        const initialMetadata: StorageMetadata = {
          version: '1.0.0',
          lastUpdated: new Date(),
          totalFiles: 0,
          totalSize: 0,
          files: {},
        };
        await fs.writeJson(this.metadataPath, initialMetadata, { spaces: 2 });
        this.logger.log('Storage initialized with empty metadata');
      } else {
        // Проверяем, что существующий файл валиден
        try {
          await fs.readJson(this.metadataPath);
        } catch (error) {
          this.logger.warn('Existing metadata file is corrupted, recreating...');
          await fs.remove(this.metadataPath);
          const initialMetadata: StorageMetadata = {
            version: '1.0.0',
            lastUpdated: new Date(),
            totalFiles: 0,
            totalSize: 0,
            files: {},
          };
          await fs.writeJson(this.metadataPath, initialMetadata, { spaces: 2 });
        }
      }

      this.logger.log(`Storage initialized at: ${config.basePath}`);
    } catch (error) {
      this.logger.error('Failed to initialize storage', error);
      throw new Error(`Storage initialization failed: ${error.message}`);
    }
  }

  /**
   * Сохранение файла в хранилище
   */
  async saveFile(params: CreateFileParams): Promise<FileOperationResult> {
    try {
      const { file, ttl, metadata = {}, allowDuplicate = true } = params;
      const config = this.getConfig();

      // Инициализируем хранилище если оно еще не инициализировано
      await this.initializeStorage();

      // Убеждаемся, что директория существует
      await fs.ensureDir(config.basePath);

      // Валидация размера файла будет выполнена после чтения буфера

      // Читаем содержимое файла (из buffer или из path)
      const fileBuffer = file.buffer || (await fs.readFile(file.path));

      // Используем реальный размер буфера вместо переданного размера
      const actualFileSize = fileBuffer.length;

      // Валидация размера файла
      if (actualFileSize > config.maxFileSize) {
        return {
          success: false,
          error: `File size ${actualFileSize} exceeds maximum allowed size ${config.maxFileSize}`,
        };
      }

      // Определяем MIME тип файла
      const detectedType = await fileTypeFromBuffer(fileBuffer);
      const mimeType = detectedType?.mime || file.mimetype;

      // Проверяем разрешенные MIME типы (только если список не пустой)
      if (config.allowedMimeTypes.length > 0 && !config.allowedMimeTypes.includes(mimeType)) {
        return {
          success: false,
          error: `MIME type ${mimeType} is not allowed`,
        };
      }

      // Вычисляем хеш файла
      const hash = HashUtil.hashBuffer(fileBuffer);

      // Проверяем дедупликацию
      if (config.enableDeduplication && allowDuplicate !== false) {
        const existingFile = await this.findFileByHash(hash);
        if (existingFile) {
          // Если файл уже существует и дедупликация включена,
          // возвращаем существующий файл с тем же ID
          return {
            success: true,
            data: existingFile,
          };
        }
      }

      // Генерируем уникальный ID и имя файла
      const fileId = uuidv4();
      const safeFilename = FilenameUtil.generateSafeFilename(file.originalname, hash);
      const storedFilename = `${fileId}_${safeFilename}`;

      // Создаем директорию по дате
      const dateDir = DateUtil.format(DateUtil.now().toDate(), STORAGE_CONSTANTS.DATE_FORMAT);
      const fileDir = path.join(config.basePath, dateDir);
      await fs.ensureDir(fileDir);

      // Путь к файлу в хранилище
      const filePath = path.join(fileDir, storedFilename);

      // Сохраняем файл
      await fs.writeFile(filePath, fileBuffer);

      // Создаем метаданные файла
      const fileInfo: FileInfo = {
        id: fileId,
        originalName: file.originalname,
        storedName: storedFilename,
        mimeType,
        size: actualFileSize,
        hash,
        uploadedAt: DateUtil.now().toDate(),
        ttl,
        expiresAt: DateUtil.createExpirationDate(ttl),
        filePath,
        metadata,
      };

      // Обновляем метаданные хранилища
      await this.updateMetadata(fileInfo, 'add');

      // Удаляем временный файл только если он был загружен через path
      if (file.path && !file.buffer) {
        await fs.remove(file.path);
      }

      this.logger.log(`File saved successfully: ${fileId}`);
      return {
        success: true,
        data: fileInfo,
      };
    } catch (error) {
      this.logger.error('Failed to save file', error);
      return {
        success: false,
        error: `Failed to save file: ${error.message}`,
      };
    }
  }

  /**
   * Получение информации о файле по ID
   */
  async getFileInfo(fileId: string): Promise<FileOperationResult> {
    try {
      const metadata = await this.loadMetadata();
      const fileInfo = metadata.files[fileId];

      if (!fileInfo) {
        return {
          success: false,
          error: `File with ID ${fileId} not found`,
        };
      }

      // Проверяем, не истек ли срок жизни файла
      if (DateUtil.isExpired(fileInfo.expiresAt)) {
        return {
          success: false,
          error: `File with ID ${fileId} has expired`,
        };
      }

      return {
        success: true,
        data: fileInfo,
      };
    } catch (error) {
      this.logger.error(`Failed to get file info for ID: ${fileId}`, error);
      return {
        success: false,
        error: `Failed to get file info: ${error.message}`,
      };
    }
  }

  /**
   * Чтение файла по ID
   */
  async readFile(fileId: string): Promise<StorageOperationResult<Buffer>> {
    try {
      const fileInfoResult = await this.getFileInfo(fileId);
      if (!fileInfoResult.success) {
        return {
          success: false,
          error: fileInfoResult.error,
        };
      }

      const fileInfo = fileInfoResult.data as FileInfo;

      // Проверяем существование файла
      if (!(await fs.pathExists(fileInfo.filePath))) {
        return {
          success: false,
          error: `File not found on disk: ${fileInfo.filePath}`,
        };
      }

      const fileBuffer = await fs.readFile(fileInfo.filePath);
      return {
        success: true,
        data: fileBuffer,
      };
    } catch (error) {
      this.logger.error(`Failed to read file with ID: ${fileId}`, error);
      return {
        success: false,
        error: `Failed to read file: ${error.message}`,
      };
    }
  }

  /**
   * Удаление файла по ID
   */
  async deleteFile(fileId: string): Promise<FileOperationResult> {
    try {
      const metadata = await this.loadMetadata();
      const fileInfo = metadata.files[fileId];

      if (!fileInfo) {
        return {
          success: false,
          error: `File with ID ${fileId} not found`,
        };
      }

      // Удаляем файл с диска
      if (await fs.pathExists(fileInfo.filePath)) {
        await fs.remove(fileInfo.filePath);
      }

      // Удаляем из метаданных
      await this.updateMetadata(fileInfo, 'remove');

      this.logger.log(`File deleted successfully: ${fileId}`);
      return {
        success: true,
        data: fileInfo,
      };
    } catch (error) {
      this.logger.error(`Failed to delete file with ID: ${fileId}`, error);
      return {
        success: false,
        error: `Failed to delete file: ${error.message}`,
      };
    }
  }

  /**
   * Поиск файлов по параметрам
   */
  async searchFiles(params: FileSearchParams): Promise<FileSearchResult> {
    try {
      const metadata = await this.loadMetadata();
      let files = Object.values(metadata.files);

      // Применяем фильтры
      if (params.mimeType) {
        files = files.filter((file) => file.mimeType === params.mimeType);
      }

      if (params.minSize !== undefined) {
        files = files.filter((file) => file.size >= params.minSize);
      }

      if (params.maxSize !== undefined) {
        files = files.filter((file) => file.size <= params.maxSize);
      }

      if (params.uploadedAfter) {
        files = files.filter((file) => DateUtil.isAfter(file.uploadedAt, params.uploadedAfter!));
      }

      if (params.uploadedBefore) {
        files = files.filter((file) => DateUtil.isBefore(file.uploadedAt, params.uploadedBefore!));
      }

      if (params.expiredOnly) {
        files = files.filter((file) => DateUtil.isExpired(file.expiresAt));
      }

      // Сортируем по дате загрузки (новые сначала)
      files.sort((a, b) => DateUtil.toTimestamp(b.uploadedAt) - DateUtil.toTimestamp(a.uploadedAt));

      const total = files.length;

      // Применяем пагинацию
      if (params.offset) {
        files = files.slice(params.offset);
      }

      if (params.limit) {
        files = files.slice(0, params.limit);
      }

      return {
        files,
        total,
        params,
      };
    } catch (error) {
      this.logger.error('Failed to search files', error);
      return {
        files: [],
        total: 0,
        params,
      };
    }
  }

  /**
   * Получение статистики файлов
   */
  async getFileStats(): Promise<FileStats> {
    try {
      const metadata = await this.loadMetadata();
      const files = Object.values(metadata.files);

      const filesByMimeType: Record<string, number> = {};
      const filesByDate: Record<string, number> = {};

      files.forEach((file) => {
        // Группировка по MIME типу
        filesByMimeType[file.mimeType] = (filesByMimeType[file.mimeType] || 0) + 1;

        // Группировка по дате загрузки
        const dateKey = DateUtil.format(file.uploadedAt, 'YYYY-MM-DD');
        filesByDate[dateKey] = (filesByDate[dateKey] || 0) + 1;
      });

      return {
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        filesByMimeType,
        filesByDate,
      };
    } catch (error) {
      this.logger.error('Failed to get file stats', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        filesByMimeType: {},
        filesByDate: {},
      };
    }
  }

  /**
   * Получение информации о состоянии хранилища
   */
  async getStorageHealth(): Promise<StorageHealth> {
    try {
      const metadata = await this.loadMetadata();
      const config = this.getConfig();

      // Получаем информацию о диске через fs.stat
      await fs.stat(config.basePath);

      // Для упрощения используем приблизительные значения
      // В реальном проекте можно использовать библиотеку для получения информации о диске
      const freeSpace = 1024 * 1024 * 1024; // 1GB по умолчанию
      const totalSpace = 10 * 1024 * 1024 * 1024; // 10GB по умолчанию
      const usedSpace = totalSpace - freeSpace;
      const usagePercentage = (usedSpace / totalSpace) * 100;

      return {
        isAvailable: true,
        freeSpace,
        totalSpace,
        usedSpace,
        usagePercentage,
        fileCount: metadata.totalFiles,
        lastChecked: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get storage health', error);
      return {
        isAvailable: false,
        freeSpace: 0,
        totalSpace: 0,
        usedSpace: 0,
        usagePercentage: 0,
        fileCount: 0,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Загрузка метаданных из файла
   */
  private async loadMetadata(): Promise<StorageMetadata> {
    try {
      // Получаем конфигурацию для правильного пути
      const config = this.getConfig();
      const metadataPath = path.join(config.basePath, 'data.json');

      // Убеждаемся, что директория существует
      await fs.ensureDir(config.basePath);

      // Проверяем и инициализируем хранилище если необходимо
      if (!(await fs.pathExists(metadataPath))) {
        await this.initializeStorage();
      }

      const metadata = await fs.readJson(metadataPath);
      return metadata as StorageMetadata;
    } catch (error) {
      this.logger.error('Failed to load metadata', error);

      // Если JSON файл поврежден или не существует, пересоздаем его
      if (
        error.message.includes('JSON') ||
        error.message.includes('Unexpected') ||
        error.code === 'ENOENT'
      ) {
        this.logger.warn('Metadata file is corrupted or missing, recreating...');
        try {
          const config = this.getConfig();
          const metadataPath = path.join(config.basePath, 'data.json');

          // Убеждаемся, что директория существует
          await fs.ensureDir(config.basePath);

          // Удаляем файл если он существует
          if (await fs.pathExists(metadataPath)) {
            await fs.remove(metadataPath);
          }

          await this.initializeStorage();
          const metadata = await fs.readJson(metadataPath);
          return metadata as StorageMetadata;
        } catch (recreateError) {
          this.logger.error('Failed to recreate metadata file', recreateError);
          throw new Error(`Failed to recreate metadata: ${recreateError.message}`);
        }
      }

      throw new Error(`Failed to load metadata: ${error.message}`);
    }
  }

  /**
   * Обновление метаданных
   */
  private async updateMetadata(fileInfo: FileInfo, operation: 'add' | 'remove'): Promise<void> {
    try {
      // Инициализируем хранилище если оно еще не инициализировано
      await this.initializeStorage();

      // Убеждаемся, что директория существует
      const config = this.getConfig();
      await fs.ensureDir(config.basePath);

      const metadata = await this.loadMetadata();

      if (operation === 'add') {
        metadata.files[fileInfo.id] = fileInfo;
        metadata.totalFiles += 1;
        metadata.totalSize += fileInfo.size;
      } else if (operation === 'remove') {
        delete metadata.files[fileInfo.id];
        metadata.totalFiles -= 1;
        metadata.totalSize -= fileInfo.size;
      }

      metadata.lastUpdated = new Date();

      // Получаем путь к файлу метаданных
      const metadataPath = path.join(config.basePath, 'data.json');

      // Убеждаемся, что директория существует
      const metadataDir = path.dirname(metadataPath);
      await fs.ensureDir(metadataDir);

      // Атомарная запись: сначала записываем во временный файл, затем переименовываем
      const tempPath = path.join(
        metadataDir,
        `data.json.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`,
      );

      // Записываем во временный файл
      const jsonContent = JSON.stringify(metadata, null, 2);
      await fs.writeFile(tempPath, jsonContent, 'utf8');

      // Проверяем, что временный файл был создан
      if (!(await fs.pathExists(tempPath))) {
        throw new Error(`Failed to create temporary metadata file: ${tempPath}`);
      }

      // Атомарно переименовываем временный файл в основной
      await fs.move(tempPath, metadataPath, { overwrite: true });
    } catch (error) {
      this.logger.error('Failed to update metadata', error);
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  }

  /**
   * Поиск файла по хешу
   */
  private async findFileByHash(hash: string): Promise<FileInfo | null> {
    try {
      const metadata = await this.loadMetadata();
      const files = Object.values(metadata.files);
      return files.find((file) => file.hash === hash) || null;
    } catch (error) {
      this.logger.error('Failed to find file by hash', error);
      return null;
    }
  }

  /**
   * Увеличение счетчика ссылок на файл
   */
  private async incrementFileReference(fileId: string): Promise<void> {
    try {
      const metadata = await this.loadMetadata();
      const fileInfo = metadata.files[fileId];

      if (fileInfo) {
        // Обновляем время истечения срока жизни
        fileInfo.expiresAt = DateUtil.createExpirationDate(fileInfo.ttl);
        fileInfo.uploadedAt = DateUtil.now().toDate();

        await this.updateMetadata(fileInfo, 'add');
        this.logger.log(`File reference incremented: ${fileId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to increment file reference: ${fileId}`, error);
    }
  }
}
