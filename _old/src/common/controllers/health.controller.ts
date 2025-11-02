import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HealthResponse, HealthCheck } from '../interfaces/api.interface';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Контроллер для проверки состояния приложения
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Проверка состояния приложения
   */
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Проверка состояния приложения и его компонентов',
  })
  @ApiResponse({
    status: 200,
    description: 'Состояние приложения',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
        uptime: { type: 'number', description: 'Время работы в миллисекундах' },
        version: { type: 'string', description: 'Версия приложения' },
        storage: { type: 'object', description: 'Информация о хранилище' },
        timestamp: { type: 'string', description: 'Время проверки' },
        checks: { type: 'object', description: 'Дополнительные проверки' },
      },
    },
  })
  async getHealth(): Promise<HealthResponse> {
    const now = new Date();

    try {
      // Проверяем состояние хранилища
      const storageHealth = await this.checkStorageHealth();

      // Проверяем файловую систему
      const filesystemCheck = await this.checkFilesystem();

      // Проверяем память
      const memoryCheck = this.checkMemory();

      // Определяем общий статус
      const status = this.determineOverallStatus(storageHealth, filesystemCheck, memoryCheck);

      return {
        status,
        uptime: Date.now() - this.startTime,
        version: '1.0.0',
        storage: storageHealth,
        timestamp: now.toISOString(),
        checks: {
          filesystem: filesystemCheck,
          memory: memoryCheck,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        uptime: Date.now() - this.startTime,
        version: '1.0.0',
        storage: {
          isAvailable: false,
          freeSpace: 0,
          totalSpace: 0,
          usedSpace: 0,
          usagePercentage: 100,
          fileCount: 0,
          lastChecked: now,
        },
        timestamp: now.toISOString(),
        checks: {
          filesystem: {
            status: 'unhealthy',
            message: `Filesystem check failed: ${error.message}`,
            lastChecked: now.toISOString(),
          },
          memory: {
            status: 'unhealthy',
            message: `Memory check failed: ${error.message}`,
            lastChecked: now.toISOString(),
          },
        },
      };
    }
  }

  /**
   * Проверка состояния хранилища
   */
  private async checkStorageHealth() {
    const storagePath = this.configService.get<string>('STORAGE_DIR', './storage');

    try {
      // Проверяем доступность директории хранилища (не создаем её)
      await fs.access(storagePath);

      // Получаем статистику диска
      const stats = await fs.stat(storagePath);

      // Получаем информацию о свободном месте
      const diskUsage = await this.getDiskUsage(storagePath);

      // Подсчитываем количество файлов
      const fileCount = await this.countFiles(storagePath);

      return {
        isAvailable: true,
        freeSpace: diskUsage.free,
        totalSpace: diskUsage.total,
        usedSpace: diskUsage.used,
        usagePercentage: diskUsage.percentage,
        fileCount,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        isAvailable: false,
        freeSpace: 0,
        totalSpace: 0,
        usedSpace: 0,
        usagePercentage: 100,
        fileCount: 0,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Проверка файловой системы
   */
  private async checkFilesystem(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Простая проверка записи и чтения
      const testFile = path.join(os.tmpdir(), `health-check-${Date.now()}.tmp`);

      await fs.writeFile(testFile, 'health check test');
      await fs.readFile(testFile);
      await fs.unlink(testFile);

      return {
        status: 'healthy',
        message: 'Filesystem is accessible',
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Filesystem check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Проверка памяти
   */
  private checkMemory(): HealthCheck {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercentage = (usedMem / totalMem) * 100;

    // Считаем память здоровой, если используется менее 90%
    const status: 'healthy' | 'unhealthy' | 'degraded' =
      usagePercentage < 90 ? 'healthy' : usagePercentage < 95 ? 'degraded' : 'unhealthy';

    return {
      status,
      message: `Memory usage: ${usagePercentage.toFixed(2)}%`,
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Определение общего статуса приложения
   */
  private determineOverallStatus(
    storage: any,
    filesystem: any,
    memory: any,
  ): 'healthy' | 'unhealthy' | 'degraded' {
    const statuses = [
      storage.isAvailable ? 'healthy' : 'unhealthy',
      filesystem.status,
      memory.status,
    ];

    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }

    if (statuses.includes('degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Получение информации об использовании диска
   */
  private async getDiskUsage(path: string) {
    try {
      // Простая реализация для Linux/Unix систем
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(`df -k "${path}" | tail -1`);
      const parts = stdout.trim().split(/\s+/);

      const total = parseInt(parts[1]) * 1024; // в байтах
      const used = parseInt(parts[2]) * 1024; // в байтах
      const free = parseInt(parts[3]) * 1024; // в байтах
      const percentage = (used / total) * 100;

      return { total, used, free, percentage };
    } catch (error) {
      // Fallback: используем системную информацию
      const total = os.totalmem();
      const free = os.freemem();
      const used = total - free;
      const percentage = (used / total) * 100;

      return { total, used, free, percentage };
    }
  }

  /**
   * Подсчет количества файлов в директории
   */
  private async countFiles(dirPath: string): Promise<number> {
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      let count = 0;

      for (const file of files) {
        if (file.isFile()) {
          count++;
        } else if (file.isDirectory()) {
          const subDirPath = path.join(dirPath, file.name);
          count += await this.countFiles(subDirPath);
        }
      }

      return count;
    } catch (error) {
      return 0;
    }
  }
}
