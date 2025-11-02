/**
 * Утилиты для E2E тестов
 * Общие функции для настройки тестового окружения и вспомогательные методы
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
// import { AppModule } from '../../src/app.module';
import { getConfig } from '../../src/config/app.config';
import { HealthController } from '../../src/common/controllers/health.controller';
import { StorageTestController } from '../../src/common/controllers/storage-test.controller';
import { StorageModule } from '../../src/modules/storage/storage.module';
import { FilesModule } from '../../src/modules/files/files.module';
import { CleanupModule } from '../../src/modules/cleanup/cleanup.module';
import { GlobalValidationPipe } from '../../src/common/pipes/validation.pipe';
import { AuthGuard } from '../../src/common/guards/auth.guard';
import { APP_PIPE, APP_GUARD } from '@nestjs/core';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Интерфейс для конфигурации тестового приложения
 */
export interface TestAppConfig {
  testStoragePath: string;
  validToken: string;
  authEnabled?: boolean;
  apiPaths: ReturnType<typeof createApiPathBuilder>;
}

/**
 * Создает и настраивает тестовое приложение
 * @param testName Название теста для создания уникальной директории
 * @param authEnabled Включить ли аутентификацию (по умолчанию true)
 * @returns Объект с приложением и конфигурацией
 */
export async function createTestApp(
  testName: string,
  authEnabled: boolean = true,
): Promise<{ app: INestApplication; config: TestAppConfig }> {
  // Создаем временную директорию для тестов
  const testStoragePath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'test-data',
    'micro-file-cache',
    `temp-storage-${testName}`,
  );
  await fs.ensureDir(testStoragePath);

  // Переопределяем переменные окружения для тестов ПЕРЕД загрузкой конфигурации
  process.env.STORAGE_DIR = testStoragePath;
  process.env.AUTH_ENABLED = authEnabled.toString();
  process.env.AUTH_TOKEN = 'test-secret-key';

  // Создаем тестовый модуль с правильной конфигурацией
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      // Глобальная конфигурация
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: 'env.test',
        load: [getConfig],
      }),
      // Модуль для cron jobs (автоматическая очистка)
      ScheduleModule.forRoot(),
      // Модуль для работы с файловым хранилищем
      StorageModule,
      // Модуль для работы с файлами (бизнес-логика)
      FilesModule,
      // Модуль для автоматической очистки устаревших файлов
      CleanupModule,
    ],
    controllers: [HealthController, StorageTestController],
    providers: [
      // Глобальный пайп валидации
      {
        provide: APP_PIPE,
        useClass: GlobalValidationPipe,
      },
      // Глобальный guard аутентификации
      {
        provide: APP_GUARD,
        useClass: AuthGuard,
      },
    ],
  })
    .overrideProvider(ConfigService)
    .useValue({
      get: (key: string, defaultValue?: any) => {
        if (key === 'STORAGE_DIR') {
          console.log(`🔧 ConfigService.get('STORAGE_DIR') returning: ${testStoragePath}`);
          return testStoragePath;
        }
        if (key === 'AUTH_ENABLED') {
          return authEnabled.toString();
        }
        if (key === 'AUTH_TOKEN') {
          return 'test-secret-key';
        }
        // Для остальных ключей используем значения из env.test
        const value = process.env[key] || defaultValue;
        if (key === 'STORAGE_DIR') {
          console.log(`🔧 ConfigService.get('${key}') returning: ${value}`);
        }
        return value;
      },
    })
    .compile();

  // Получаем конфигурацию после создания модуля
  const config = getConfig();
  const validToken = config.auth.secretKey || 'test-secret-key';

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  // Регистрируем multipart для загрузки файлов
  await (app as NestFastifyApplication).register(require('@fastify/multipart'), {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB для тестов
    },
  });

  // Настраиваем глобальные пайпы
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Установка глобального префикса для API
  const globalPrefix = config.server.basePath
    ? `${config.server.basePath}/${config.server.apiVersion}`
    : config.server.apiVersion;
  app.setGlobalPrefix(globalPrefix);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    config: {
      testStoragePath,
      validToken,
      authEnabled,
      apiPaths: createApiPathBuilder(config.server.basePath, config.server.apiVersion),
    },
  };
}

/**
 * Очищает тестовое приложение и временные файлы
 * @param app Приложение для закрытия
 * @param testStoragePath Путь к временной директории для удаления
 */
export async function cleanupTestApp(
  app: INestApplication,
  testStoragePath: string,
): Promise<void> {
  // Очищаем временную директорию
  if (await fs.pathExists(testStoragePath)) {
    await fs.remove(testStoragePath);
  }
  await app.close();
}

/**
 * Очищает хранилище перед тестом
 * @param testStoragePath Путь к тестовому хранилищу
 */
export async function clearTestStorage(testStoragePath: string): Promise<void> {
  if (await fs.pathExists(testStoragePath)) {
    await fs.remove(testStoragePath);
    await fs.ensureDir(testStoragePath);
  }
}

/**
 * Создает тестовый файл с заданным содержимым
 * @param content Содержимое файла
 * @param filename Имя файла
 * @returns Buffer с содержимым файла
 */
export function createTestFile(content: string, filename: string): Buffer {
  return Buffer.from(content);
}

/**
 * Создает тестовый файл с бинарным содержимым
 * @param size Размер файла в байтах
 * @param filename Имя файла
 * @returns Buffer с содержимым файла
 */
export function createTestBinaryFile(size: number, filename: string): Buffer {
  return Buffer.alloc(size, 'A');
}

/**
 * Создает PNG файл с минимальным заголовком
 * @param filename Имя файла
 * @returns Buffer с PNG заголовком
 */
export function createTestPngFile(filename: string): Buffer {
  return Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01, // 1x1 pixel
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
    0x90,
    0x77,
    0x53,
    0xde,
  ]);
}

/**
 * Создает JSON файл с заданными данными
 * @param data Данные для сериализации в JSON
 * @param filename Имя файла
 * @returns Buffer с JSON содержимым
 */
export function createTestJsonFile(data: any, filename: string): Buffer {
  return Buffer.from(JSON.stringify(data, null, 2));
}

/**
 * Создает HTML файл с заданным содержимым
 * @param content HTML содержимое
 * @param filename Имя файла
 * @returns Buffer с HTML содержимым
 */
export function createTestHtmlFile(content: string, filename: string): Buffer {
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Test HTML</title>
</head>
<body>
    ${content}
</body>
</html>`;
  return Buffer.from(html);
}

/**
 * Создает CSS файл с заданными стилями
 * @param styles CSS стили
 * @param filename Имя файла
 * @returns Buffer с CSS содержимым
 */
export function createTestCssFile(styles: string, filename: string): Buffer {
  return Buffer.from(styles);
}

/**
 * Создает JavaScript файл с заданным кодом
 * @param code JavaScript код
 * @param filename Имя файла
 * @returns Buffer с JavaScript содержимым
 */
export function createTestJsFile(code: string, filename: string): Buffer {
  return Buffer.from(code);
}

/**
 * Генерирует случайный UUID для тестирования
 * @returns Строка с UUID
 */
export function generateTestUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Создает тестовые метаданные
 * @param overrides Дополнительные поля для метаданных
 * @returns Объект с метаданными
 */
export function createTestMetadata(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    description: 'Test file for E2E testing',
    category: 'test',
    tags: ['e2e', 'test'],
    createdBy: 'e2e-test-suite',
    ...overrides,
  };
}

/**
 * Ожидает выполнения условия с таймаутом
 * @param condition Функция, возвращающая true когда условие выполнено
 * @param timeout Таймаут в миллисекундах (по умолчанию 5000)
 * @param interval Интервал проверки в миллисекундах (по умолчанию 100)
 * @returns Promise, который разрешается когда условие выполнено
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Измеряет время выполнения функции
 * @param fn Функция для измерения
 * @returns Объект с результатом и временем выполнения
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T> | T,
): Promise<{ result: T; executionTime: number }> {
  const startTime = Date.now();
  const result = await fn();
  const executionTime = Date.now() - startTime;

  return { result, executionTime };
}

/**
 * Создает массив тестовых файлов
 * @param count Количество файлов
 * @param prefix Префикс для имен файлов
 * @returns Массив объектов с данными файлов
 */
export function createTestFileArray(
  count: number,
  prefix: string = 'test',
): Array<{ content: string; name: string; metadata: Record<string, any> }> {
  return Array.from({ length: count }, (_, i) => ({
    content: `${prefix} file ${i} content`,
    name: `${prefix}-${i}.txt`,
    metadata: createTestMetadata({ index: i, prefix }),
  }));
}

/**
 * Проверяет, что ответ содержит ожидаемую структуру файла
 * @param fileData Данные файла из ответа API
 * @param expectedName Ожидаемое имя файла
 * @param expectedSize Ожидаемый размер файла
 */
export function expectFileStructure(
  fileData: any,
  expectedName: string,
  expectedSize: number,
): void {
  expect(fileData).toHaveProperty('id');
  expect(fileData).toHaveProperty('originalName', expectedName);
  expect(fileData).toHaveProperty('mimeType');
  expect(fileData).toHaveProperty('size', expectedSize);
  expect(fileData).toHaveProperty('uploadedAt');
  expect(fileData).toHaveProperty('ttl');
  expect(fileData).toHaveProperty('expiresAt');
  expect(fileData).toHaveProperty('hash');
  expect(fileData).toHaveProperty('isExpired', false);
  expect(fileData).toHaveProperty('timeRemaining');
  expect(fileData.timeRemaining).toBeGreaterThan(0);
}

/**
 * Проверяет, что ответ содержит ожидаемую структуру пагинации
 * @param paginationData Данные пагинации из ответа API
 * @param expectedLimit Ожидаемый лимит
 */
export function expectPaginationStructure(paginationData: any, expectedLimit?: number): void {
  expect(paginationData).toHaveProperty('page');
  expect(paginationData).toHaveProperty('limit');
  expect(paginationData).toHaveProperty('totalPages');
  expect(paginationData).toHaveProperty('hasNext');
  expect(paginationData).toHaveProperty('hasPrev');

  if (expectedLimit !== undefined) {
    expect(paginationData.limit).toBe(expectedLimit);
  }
}

/**
 * Проверяет, что ответ содержит ожидаемую структуру статистики
 * @param statsData Данные статистики из ответа API
 */
export function expectStatsStructure(statsData: any): void {
  expect(statsData).toHaveProperty('totalFiles');
  expect(statsData).toHaveProperty('totalSize');
  expect(statsData).toHaveProperty('filesByMimeType');
  expect(statsData).toHaveProperty('filesByDate');
  expect(typeof statsData.totalFiles).toBe('number');
  expect(typeof statsData.totalSize).toBe('number');
  expect(typeof statsData.filesByMimeType).toBe('object');
  expect(typeof statsData.filesByDate).toBe('object');
}

/**
 * Генерирует API пути на основе конфигурации
 * @param basePath Базовый путь API (может быть пустым)
 * @param apiVersion Версия API
 * @returns Объект с функциями для генерации путей
 */
export function createApiPathBuilder(basePath: string = 'api', apiVersion: string = 'v1') {
  const prefix = basePath ? `${basePath}/${apiVersion}` : apiVersion;

  return {
    /**
     * Генерирует путь для health check
     */
    health: () => `/${prefix}/health`,

    /**
     * Генерирует путь для списка файлов
     */
    files: () => `/${prefix}/files`,

    /**
     * Генерирует путь для статистики файлов
     */
    filesStats: () => `/${prefix}/files/stats`,

    /**
     * Генерирует путь для загрузки файла
     */
    uploadFile: () => `/${prefix}/files`,

    /**
     * Генерирует путь для получения информации о файле
     * @param fileId ID файла
     */
    getFile: (fileId: string) => `/${prefix}/files/${fileId}`,

    /**
     * Генерирует путь для скачивания файла
     * @param fileId ID файла
     */
    downloadFile: (fileId: string) => `/${prefix}/files/${fileId}/download`,

    /**
     * Генерирует путь для удаления файла
     * @param fileId ID файла
     */
    deleteFile: (fileId: string) => `/${prefix}/files/${fileId}`,

    /**
     * Генерирует путь для проверки существования файла
     * @param fileId ID файла
     */
    fileExists: (fileId: string) => `/${prefix}/files/${fileId}/exists`,

    /**
     * Генерирует путь для документации Swagger
     */
    swagger: () => `/${basePath || ''}/docs`,
  };
}
