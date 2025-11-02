/**
 * Unit тесты для CleanupService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// Мокаем file-type для тестов
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn().mockResolvedValue({ mime: 'text/plain' }),
}));

import {
  CleanupService,
  CleanupResult,
  CleanupStats,
} from '../../src/modules/cleanup/cleanup.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { FileInfo } from '../../src/common/interfaces/file.interface';
import { FileSearchResult } from '../../src/common/interfaces/storage.interface';

describe('CleanupService', () => {
  let service: CleanupService;
  let storageService: jest.Mocked<StorageService>;
  let configService: jest.Mocked<ConfigService>;

  const mockFileInfo: FileInfo = {
    id: 'test-file-id',
    originalName: 'test-file.txt',
    storedName: 'test-file-id_test-file.txt',
    mimeType: 'text/plain',
    size: 1024,
    hash: 'test-hash',
    uploadedAt: new Date('2023-01-01T00:00:00Z'),
    ttl: 3600,
    expiresAt: new Date('2023-01-01T01:00:00Z'),
    filePath: '/storage/2023-01/test-file-id_test-file.txt',
    metadata: {},
  };

  const mockExpiredFileInfo: FileInfo = {
    ...mockFileInfo,
    id: 'expired-file-id',
    expiresAt: new Date('2022-01-01T00:00:00Z'), // Истекший файл
  };

  beforeEach(async () => {
    const mockStorageService = {
      searchFiles: jest.fn(),
      deleteFile: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    // Настройка моков по умолчанию
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        CLEANUP_CRON: '0 */10 * * * *', // каждые 10 минут
        CLEANUP_BATCH_SIZE: 100,
        CLEANUP_DRY_RUN: false,
      };
      return config[key] || defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);
    storageService = module.get(StorageService);
    configService = module.get(ConfigService);

    // Отключаем логирование для тестов
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanupExpiredFiles', () => {
    it('should successfully clean up expired files', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [mockExpiredFileInfo],
        total: 1,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(1);
      expect(result.freedSpace).toBe(mockExpiredFileInfo.size);
      expect(result.errors).toBe(0);
      expect(result.errorMessages).toHaveLength(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.executedAt).toBeInstanceOf(Date);

      expect(storageService.searchFiles).toHaveBeenCalledWith({
        expiredOnly: true,
        limit: 10000,
      });
      expect(storageService.deleteFile).toHaveBeenCalledWith(mockExpiredFileInfo.id);
    });

    it('should handle no expired files', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [],
        total: 0,
        params: { expiredOnly: true },
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(0);
      expect(result.freedSpace).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.errorMessages).toHaveLength(0);

      expect(storageService.searchFiles).toHaveBeenCalledWith({
        expiredOnly: true,
        limit: 10000,
      });
      expect(storageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [mockExpiredFileInfo],
        total: 1,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: false,
        error: 'File not found',
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(false);
      expect(result.deletedFiles).toBe(0);
      expect(result.freedSpace).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain('Failed to delete file expired-file-id');

      expect(storageService.deleteFile).toHaveBeenCalledWith(mockExpiredFileInfo.id);
    });

    it('should handle search errors', async () => {
      // Arrange
      storageService.searchFiles.mockRejectedValue(new Error('Search failed'));

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(false);
      expect(result.deletedFiles).toBe(0);
      expect(result.freedSpace).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain(
        'Cleanup failed: Failed to get expired files: Search failed',
      );
    });

    it('should process files in batches', async () => {
      // Arrange
      const batchSize = 2;
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          CLEANUP_CRON: '0 */10 * * * *',
          CLEANUP_BATCH_SIZE: batchSize,
          CLEANUP_DRY_RUN: false,
        };
        return config[key] || defaultValue;
      });

      const expiredFiles = [
        { ...mockExpiredFileInfo, id: 'file1' },
        { ...mockExpiredFileInfo, id: 'file2' },
        { ...mockExpiredFileInfo, id: 'file3' },
      ];

      const mockSearchResult: FileSearchResult = {
        files: expiredFiles,
        total: 3,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(3);
      expect(result.freedSpace).toBe(3 * mockExpiredFileInfo.size);
      expect(result.errors).toBe(0);

      expect(storageService.deleteFile).toHaveBeenCalledTimes(3);
      expect(storageService.deleteFile).toHaveBeenCalledWith('file1');
      expect(storageService.deleteFile).toHaveBeenCalledWith('file2');
      expect(storageService.deleteFile).toHaveBeenCalledWith('file3');
    });
  });

  describe('manualCleanup', () => {
    it('should perform manual cleanup with default options', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [mockExpiredFileInfo],
        total: 1,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.manualCleanup();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(1);
      expect(result.freedSpace).toBe(mockExpiredFileInfo.size);
      expect(result.errors).toBe(0);

      expect(storageService.searchFiles).toHaveBeenCalledWith({
        expiredOnly: true,
        limit: 10000,
      });
      expect(storageService.deleteFile).toHaveBeenCalledWith(mockExpiredFileInfo.id);
    });

    it('should perform dry run cleanup', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [mockExpiredFileInfo],
        total: 1,
        params: { expiredOnly: true },
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);

      // Act
      const result = await service.manualCleanup({ dryRun: true });

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(1);
      expect(result.freedSpace).toBe(mockExpiredFileInfo.size);
      expect(result.errors).toBe(0);

      expect(storageService.searchFiles).toHaveBeenCalledWith({
        expiredOnly: true,
        limit: 10000,
      });
      expect(storageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should cleanup files older than specified date', async () => {
      // Arrange
      const olderDate = new Date('2022-01-01T00:00:00Z');
      const mockSearchResult: FileSearchResult = {
        files: [mockFileInfo],
        total: 1,
        params: { uploadedBefore: olderDate },
      };

      const mockDeleteResult = {
        success: true,
        data: mockFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.manualCleanup({ olderThan: olderDate });

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(1);
      expect(result.freedSpace).toBe(mockFileInfo.size);

      expect(storageService.searchFiles).toHaveBeenCalledWith({
        uploadedBefore: olderDate,
        limit: 10000,
      });
      expect(storageService.deleteFile).toHaveBeenCalledWith(mockFileInfo.id);
    });

    it('should use custom batch size', async () => {
      // Arrange
      const customBatchSize = 5;
      const mockSearchResult: FileSearchResult = {
        files: [mockExpiredFileInfo],
        total: 1,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.manualCleanup({ batchSize: customBatchSize });

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(1);

      expect(storageService.searchFiles).toHaveBeenCalledWith({
        expiredOnly: true,
        limit: 10000,
      });
    });
  });

  describe('getCleanupStats', () => {
    it('should return initial stats', () => {
      // Act
      const stats = service.getCleanupStats();

      // Assert
      expect(stats.totalCleanups).toBe(0);
      expect(stats.totalDeletedFiles).toBe(0);
      expect(stats.totalFreedSpace).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
      expect(stats.lastCleanup).toBeUndefined();
    });

    it('should return updated stats after cleanup', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [mockExpiredFileInfo],
        total: 1,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      await service.cleanupExpiredFiles();
      const stats = service.getCleanupStats();

      // Assert
      expect(stats.totalCleanups).toBe(1);
      expect(stats.totalDeletedFiles).toBe(1);
      expect(stats.totalFreedSpace).toBe(mockExpiredFileInfo.size);
      expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(stats.lastCleanup).toBeDefined();
      expect(stats.lastCleanup?.deletedFiles).toBe(1);
    });
  });

  describe('resetCleanupStats', () => {
    it('should reset stats to initial values', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [mockExpiredFileInfo],
        total: 1,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      await service.cleanupExpiredFiles();

      // Act
      service.resetCleanupStats();
      const stats = service.getCleanupStats();

      // Assert
      expect(stats.totalCleanups).toBe(0);
      expect(stats.totalDeletedFiles).toBe(0);
      expect(stats.totalFreedSpace).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
      expect(stats.lastCleanup).toBeUndefined();
    });
  });

  describe('configuration', () => {
    it('should use default configuration values', () => {
      // Act & Assert
      expect(configService.get).toHaveBeenCalledWith('CLEANUP_CRON', '0 */10 * * * *');
      expect(configService.get).toHaveBeenCalledWith('CLEANUP_BATCH_SIZE', 100);
      expect(configService.get).toHaveBeenCalledWith('CLEANUP_DRY_RUN', false);
    });

    it('should always run cleanup (cleanup is always enabled)', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [],
        total: 0,
        params: { expiredOnly: true },
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);

      // Act
      await service.handleScheduledCleanup();

      // Assert
      // Проверяем, что searchFiles вызывался, так как очистка всегда включена
      expect(storageService.searchFiles).toHaveBeenCalledWith({
        expiredOnly: true,
        limit: 10000,
      });
    });
  });

  describe('handleScheduledCleanup', () => {
    it('should call cleanupExpiredFiles (cleanup is always enabled)', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [mockExpiredFileInfo],
        total: 1,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      await service.handleScheduledCleanup();

      // Assert
      expect(storageService.searchFiles).toHaveBeenCalledWith({
        expiredOnly: true,
        limit: 10000,
      });
      expect(storageService.deleteFile).toHaveBeenCalledWith(mockExpiredFileInfo.id);
    });

    it('should always run cleanup (cleanup cannot be disabled)', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [],
        total: 0,
        params: { expiredOnly: true },
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);

      // Act
      await service.handleScheduledCleanup();

      // Assert
      // Проверяем, что searchFiles всегда вызывается, так как очистка всегда включена
      expect(storageService.searchFiles).toHaveBeenCalledWith({
        expiredOnly: true,
        limit: 10000,
      });
    });
  });

  describe('getFilesOlderThan', () => {
    it('should get files older than specified date', async () => {
      // Arrange
      const olderDate = new Date('2022-01-01T00:00:00Z');
      const mockSearchResult: FileSearchResult = {
        files: [mockFileInfo],
        total: 1,
        params: { uploadedBefore: olderDate },
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);

      // Act
      const result = await service['getFilesOlderThan'](olderDate);

      // Assert
      expect(storageService.searchFiles).toHaveBeenCalledWith({
        uploadedBefore: olderDate,
        limit: 10000,
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });
  });

  describe('createBatches', () => {
    it('should create correct batches', async () => {
      // Arrange
      const files = [
        { ...mockExpiredFileInfo, id: 'file1' },
        { ...mockExpiredFileInfo, id: 'file2' },
        { ...mockExpiredFileInfo, id: 'file3' },
        { ...mockExpiredFileInfo, id: 'file4' },
        { ...mockExpiredFileInfo, id: 'file5' },
      ];

      const mockSearchResult: FileSearchResult = {
        files,
        total: 5,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.manualCleanup({ batchSize: 2 });

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(5);
      expect(storageService.deleteFile).toHaveBeenCalledTimes(5);
    });
  });

  describe('processBatch', () => {
    it('should process batch with dry run', async () => {
      // Arrange
      const files = [mockExpiredFileInfo];
      const mockSearchResult: FileSearchResult = {
        files,
        total: 1,
        params: { expiredOnly: true },
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);

      // Act
      const result = await service.manualCleanup({ dryRun: true });

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(1);
      expect(result.freedSpace).toBe(mockExpiredFileInfo.size);
      expect(storageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle batch processing errors', async () => {
      // Arrange
      const files = [mockExpiredFileInfo];
      const mockSearchResult: FileSearchResult = {
        files,
        total: 1,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: false,
        error: 'Delete failed',
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(false);
      expect(result.deletedFiles).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain('Failed to delete file');
    });

    it('should handle batch processing exceptions', async () => {
      // Arrange
      const files = [mockExpiredFileInfo];
      const mockSearchResult: FileSearchResult = {
        files,
        total: 1,
        params: { expiredOnly: true },
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockRejectedValue(new Error('Unexpected error'));

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(false);
      expect(result.deletedFiles).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain('Error deleting file');
    });
  });

  describe('updateStats', () => {
    it('should update statistics correctly', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [mockExpiredFileInfo],
        total: 1,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      await service.cleanupExpiredFiles();
      const stats = service.getCleanupStats();

      // Assert
      expect(stats.totalCleanups).toBe(1);
      expect(stats.totalDeletedFiles).toBe(1);
      expect(stats.totalFreedSpace).toBe(mockExpiredFileInfo.size);
      expect(stats.lastCleanup).toBeDefined();
      expect(stats.lastCleanup?.deletedFiles).toBe(1);
    });

    it('should calculate average execution time correctly', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [],
        total: 0,
        params: { expiredOnly: true },
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);

      // Act - выполняем несколько очисток
      await service.cleanupExpiredFiles();
      await service.cleanupExpiredFiles();
      await service.cleanupExpiredFiles();

      const stats = service.getCleanupStats();

      // Assert
      expect(stats.totalCleanups).toBe(0); // Нет файлов для удаления, поэтому totalCleanups не увеличивается
      expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [
          { ...mockExpiredFileInfo, size: 1024 }, // 1KB
          { ...mockExpiredFileInfo, size: 1024 * 1024 }, // 1MB
          { ...mockExpiredFileInfo, size: 1024 * 1024 * 1024 }, // 1GB
        ],
        total: 3,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(true);
      expect(result.freedSpace).toBe(1024 + 1024 * 1024 + 1024 * 1024 * 1024);
    });
  });

  describe('error handling', () => {
    it('should handle getExpiredFiles errors', async () => {
      // Arrange
      storageService.searchFiles.mockRejectedValue(new Error('Search failed'));

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain('Cleanup failed: Failed to get expired files');
    });

    it('should handle getFilesOlderThan errors', async () => {
      // Arrange
      const olderDate = new Date('2022-01-01T00:00:00Z');
      storageService.searchFiles.mockRejectedValue(new Error('Search failed'));

      // Act
      const result = await service.manualCleanup({ olderThan: olderDate });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain(
        'Manual cleanup failed: Failed to get files older than date',
      );
    });

    it('should handle unexpected errors in cleanupExpiredFiles', async () => {
      // Arrange
      storageService.searchFiles.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain(
        'Cleanup failed: Failed to get expired files: Unexpected error',
      );
    });

    it('should handle unexpected errors in manualCleanup', async () => {
      // Arrange
      storageService.searchFiles.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      const result = await service.manualCleanup();

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorMessages).toHaveLength(1);
      expect(result.errorMessages[0]).toContain(
        'Manual cleanup failed: Failed to get expired files: Unexpected error',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty file list', async () => {
      // Arrange
      const mockSearchResult: FileSearchResult = {
        files: [],
        total: 0,
        params: { expiredOnly: true },
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);

      // Act
      const result = await service.cleanupExpiredFiles();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(0);
      expect(result.freedSpace).toBe(0);
      expect(result.errors).toBe(0);
      expect(storageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle very large batch size', async () => {
      // Arrange
      const files = Array.from({ length: 1000 }, (_, i) => ({
        ...mockExpiredFileInfo,
        id: `file${i}`,
      }));

      const mockSearchResult: FileSearchResult = {
        files,
        total: 1000,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.manualCleanup({ batchSize: 10000 });

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(1000);
      expect(storageService.deleteFile).toHaveBeenCalledTimes(1000);
    });

    it('should handle zero batch size gracefully', async () => {
      // Arrange
      const files = [mockExpiredFileInfo];
      const mockSearchResult: FileSearchResult = {
        files,
        total: 1,
        params: { expiredOnly: true },
      };

      const mockDeleteResult = {
        success: true,
        data: mockExpiredFileInfo,
      };

      storageService.searchFiles.mockResolvedValue(mockSearchResult);
      storageService.deleteFile.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await service.manualCleanup({ batchSize: 0 });

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(1);
    });
  });
});
