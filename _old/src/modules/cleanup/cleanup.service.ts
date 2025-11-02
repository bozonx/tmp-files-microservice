/**
 * Сервис для автоматической очистки устаревших файлов
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs-extra';
import * as path from 'path';
import { DateUtil } from '../../common/utils/date.util';

import { StorageService } from '../storage/storage.service';
import { FileInfo } from '../../common/interfaces/file.interface';

/**
 * Результат операции очистки
 */
export interface CleanupResult {
  /** Успешность операции */
  success: boolean;

  /** Количество удаленных файлов */
  deletedFiles: number;

  /** Общий размер освобожденного места в байтах */
  freedSpace: number;

  /** Количество ошибок при удалении */
  errors: number;

  /** Список ошибок */
  errorMessages: string[];

  /** Время выполнения операции */
  executionTime: number;

  /** Дата выполнения */
  executedAt: Date;
}

/**
 * Статистика очистки
 */
export interface CleanupStats {
  /** Общее количество выполненных очисток */
  totalCleanups: number;

  /** Общее количество удаленных файлов */
  totalDeletedFiles: number;

  /** Общий размер освобожденного места */
  totalFreedSpace: number;

  /** Последняя очистка */
  lastCleanup?: CleanupResult;

  /** Среднее время выполнения очистки */
  averageExecutionTime: number;
}

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly config: {
    enabled: boolean;
    cronExpression: string;
    batchSize: number;
    dryRun: boolean;
  };

  private cleanupStats: CleanupStats = {
    totalCleanups: 0,
    totalDeletedFiles: 0,
    totalFreedSpace: 0,
    averageExecutionTime: 0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {
    this.config = {
      enabled: true, // Очистка всегда включена - это основная функция микросервиса
      cronExpression: this.configService.get<string>('CLEANUP_CRON', '0 */10 * * * *'),
      batchSize: this.configService.get<number>('CLEANUP_BATCH_SIZE', 100),
      dryRun: this.configService.get<boolean>('CLEANUP_DRY_RUN', false),
    };

    this.logger.log(`Cleanup service initialized with config: ${JSON.stringify(this.config)}`);
  }

  /**
   * Автоматическая очистка по расписанию
   */
  @Cron('0 */10 * * * *')
  async handleScheduledCleanup(): Promise<void> {
    // Очистка всегда включена - это основная функция микросервиса

    this.logger.log('Starting scheduled cleanup');
    const result = await this.cleanupExpiredFiles();

    if (result.success) {
      this.logger.log(
        `Scheduled cleanup completed: ${result.deletedFiles} files deleted, ` +
          `${this.formatBytes(result.freedSpace)} freed, ${result.executionTime}ms`,
      );
    } else {
      this.logger.error(`Scheduled cleanup failed: ${result.errorMessages.join(', ')}`);
    }
  }

  /**
   * Очистка устаревших файлов
   */
  async cleanupExpiredFiles(): Promise<CleanupResult> {
    const startTime = Date.now();
    const result: CleanupResult = {
      success: true,
      deletedFiles: 0,
      freedSpace: 0,
      errors: 0,
      errorMessages: [],
      executionTime: 0,
      executedAt: DateUtil.now().toDate(),
    };

    try {
      this.logger.log('Starting cleanup of expired files');

      // Получаем список истекших файлов
      const expiredFiles = await this.getExpiredFiles();

      if (expiredFiles.length === 0) {
        this.logger.log('No expired files found');
        result.executionTime = Date.now() - startTime;
        return result;
      }

      this.logger.log(`Found ${expiredFiles.length} expired files to clean up`);

      // Обрабатываем файлы батчами
      const batches = this.createBatches(expiredFiles, this.config.batchSize);

      for (const batch of batches) {
        const batchResult = await this.processBatch(batch);

        result.deletedFiles += batchResult.deletedFiles;
        result.freedSpace += batchResult.freedSpace;
        result.errors += batchResult.errors;
        result.errorMessages.push(...batchResult.errorMessages);
      }

      // Обновляем статистику
      this.updateStats(result);

      result.executionTime = Date.now() - startTime;
      result.success = result.errors === 0;

      this.logger.log(
        `Cleanup completed: ${result.deletedFiles} files deleted, ` +
          `${this.formatBytes(result.freedSpace)} freed, ` +
          `${result.errors} errors, ${result.executionTime}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error('Cleanup failed with error', error);
      result.success = false;
      result.errorMessages.push(`Cleanup failed: ${error.message}`);
      result.executionTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Ручная очистка с возможностью настройки параметров
   */
  async manualCleanup(
    options: {
      dryRun?: boolean;
      batchSize?: number;
      olderThan?: Date;
    } = {},
  ): Promise<CleanupResult> {
    const startTime = Date.now();
    const result: CleanupResult = {
      success: true,
      deletedFiles: 0,
      freedSpace: 0,
      errors: 0,
      errorMessages: [],
      executionTime: 0,
      executedAt: DateUtil.now().toDate(),
    };

    try {
      this.logger.log('Starting manual cleanup');

      // Получаем список файлов для удаления
      const filesToDelete = options.olderThan
        ? await this.getFilesOlderThan(options.olderThan)
        : await this.getExpiredFiles();

      if (filesToDelete.length === 0) {
        this.logger.log('No files found for cleanup');
        result.executionTime = Date.now() - startTime;
        return result;
      }

      this.logger.log(`Found ${filesToDelete.length} files for cleanup`);

      const batchSize = options.batchSize || this.config.batchSize;
      const batches = this.createBatches(filesToDelete, batchSize);

      for (const batch of batches) {
        const batchResult = await this.processBatch(batch, options.dryRun);

        result.deletedFiles += batchResult.deletedFiles;
        result.freedSpace += batchResult.freedSpace;
        result.errors += batchResult.errors;
        result.errorMessages.push(...batchResult.errorMessages);
      }

      // Обновляем статистику только если это не dry run
      if (!options.dryRun) {
        this.updateStats(result);
      }

      result.executionTime = Date.now() - startTime;
      result.success = result.errors === 0;

      this.logger.log(
        `Manual cleanup completed: ${result.deletedFiles} files deleted, ` +
          `${this.formatBytes(result.freedSpace)} freed, ` +
          `${result.errors} errors, ${result.executionTime}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error('Manual cleanup failed with error', error);
      result.success = false;
      result.errorMessages.push(`Manual cleanup failed: ${error.message}`);
      result.executionTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Получение статистики очистки
   */
  getCleanupStats(): CleanupStats {
    return { ...this.cleanupStats };
  }

  /**
   * Сброс статистики очистки
   */
  resetCleanupStats(): void {
    this.cleanupStats = {
      totalCleanups: 0,
      totalDeletedFiles: 0,
      totalFreedSpace: 0,
      averageExecutionTime: 0,
    };
    this.logger.log('Cleanup statistics reset');
  }

  /**
   * Получение списка истекших файлов
   */
  private async getExpiredFiles(): Promise<FileInfo[]> {
    try {
      const searchResult = await this.storageService.searchFiles({
        expiredOnly: true,
        limit: 10000, // Ограничиваем количество для безопасности
      });

      return searchResult.files;
    } catch (error) {
      this.logger.error('Failed to get expired files', error);
      throw new Error(`Failed to get expired files: ${error.message}`);
    }
  }

  /**
   * Получение файлов старше указанной даты
   */
  private async getFilesOlderThan(date: Date): Promise<FileInfo[]> {
    try {
      const searchResult = await this.storageService.searchFiles({
        uploadedBefore: date,
        limit: 10000, // Ограничиваем количество для безопасности
      });

      return searchResult.files;
    } catch (error) {
      this.logger.error('Failed to get files older than date', error);
      throw new Error(`Failed to get files older than date: ${error.message}`);
    }
  }

  /**
   * Создание батчей из списка файлов
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Обработка батча файлов
   */
  private async processBatch(
    files: FileInfo[],
    dryRun: boolean = this.config.dryRun,
  ): Promise<{
    deletedFiles: number;
    freedSpace: number;
    errors: number;
    errorMessages: string[];
  }> {
    let deletedFiles = 0;
    let freedSpace = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    for (const file of files) {
      try {
        if (dryRun) {
          this.logger.debug(`[DRY RUN] Would delete file: ${file.id} (${file.originalName})`);
          deletedFiles++;
          freedSpace += file.size;
        } else {
          // Удаляем файл через StorageService
          const deleteResult = await this.storageService.deleteFile(file.id);

          if (deleteResult.success) {
            deletedFiles++;
            freedSpace += file.size;
            this.logger.debug(`Deleted file: ${file.id} (${file.originalName})`);
          } else {
            errors++;
            errorMessages.push(`Failed to delete file ${file.id}: ${deleteResult.error}`);
            this.logger.error(`Failed to delete file ${file.id}: ${deleteResult.error}`);
          }
        }
      } catch (error) {
        errors++;
        const errorMsg = `Error deleting file ${file.id}: ${error.message}`;
        errorMessages.push(errorMsg);
        this.logger.error(errorMsg, error);
      }
    }

    return {
      deletedFiles,
      freedSpace,
      errors,
      errorMessages,
    };
  }

  /**
   * Обновление статистики очистки
   */
  private updateStats(result: CleanupResult): void {
    this.cleanupStats.totalCleanups++;
    this.cleanupStats.totalDeletedFiles += result.deletedFiles;
    this.cleanupStats.totalFreedSpace += result.freedSpace;
    this.cleanupStats.lastCleanup = result;

    // Обновляем среднее время выполнения
    const totalTime =
      this.cleanupStats.averageExecutionTime * (this.cleanupStats.totalCleanups - 1);
    this.cleanupStats.averageExecutionTime =
      (totalTime + result.executionTime) / this.cleanupStats.totalCleanups;
  }

  /**
   * Форматирование размера в байтах в читаемый вид
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
