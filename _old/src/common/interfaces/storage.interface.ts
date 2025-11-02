/**
 * Интерфейсы для работы с хранилищем файлов
 */

import { FileInfo } from './file.interface';

/**
 * Конфигурация хранилища
 */
export interface StorageConfig {
  /** Базовый путь к директории хранилища */
  basePath: string;

  /** Максимальный размер файла в байтах */
  maxFileSize: number;

  /** Разрешенные MIME типы */
  allowedMimeTypes: string[];

  /** Включить дедупликацию файлов */
  enableDeduplication: boolean;
}

/**
 * Метаданные хранилища
 */
export interface StorageMetadata {
  /** Версия формата метаданных */
  version: string;

  /** Дата последнего обновления */
  lastUpdated: Date;

  /** Общее количество файлов */
  totalFiles: number;

  /** Общий размер всех файлов */
  totalSize: number;

  /** Список всех файлов с их метаданными */
  files: Record<string, FileInfo>;
}

/**
 * Результат операции с хранилищем
 */
export interface StorageOperationResult<T = any> {
  /** Успешность операции */
  success: boolean;

  /** Сообщение об ошибке (если есть) */
  error?: string;

  /** Данные результата (если операция успешна) */
  data?: T;
}

/**
 * Информация о директории
 */
export interface DirectoryInfo {
  /** Путь к директории */
  path: string;

  /** Количество файлов в директории */
  fileCount: number;

  /** Общий размер файлов в директории */
  totalSize: number;

  /** Дата создания директории */
  createdAt: Date;

  /** Дата последнего изменения */
  modifiedAt: Date;
}

/**
 * Параметры для поиска файлов
 */
export interface FileSearchParams {
  /** Фильтр по MIME типу */
  mimeType?: string;

  /** Фильтр по размеру файла (минимальный) */
  minSize?: number;

  /** Фильтр по размеру файла (максимальный) */
  maxSize?: number;

  /** Фильтр по дате загрузки (от) */
  uploadedAfter?: Date;

  /** Фильтр по дате загрузки (до) */
  uploadedBefore?: Date;

  /** Фильтр по истечению срока (только истекшие) */
  expiredOnly?: boolean;

  /** Лимит количества результатов */
  limit?: number;

  /** Смещение для пагинации */
  offset?: number;
}

/**
 * Результат поиска файлов
 */
export interface FileSearchResult {
  /** Найденные файлы */
  files: FileInfo[];

  /** Общее количество найденных файлов */
  total: number;

  /** Параметры поиска */
  params: FileSearchParams;
}

/**
 * Информация о состоянии хранилища
 */
export interface StorageHealth {
  /** Доступность хранилища */
  isAvailable: boolean;

  /** Свободное место на диске в байтах */
  freeSpace: number;

  /** Общий размер хранилища в байтах */
  totalSpace: number;

  /** Используемое место в байтах */
  usedSpace: number;

  /** Процент использования */
  usagePercentage: number;

  /** Количество файлов */
  fileCount: number;

  /** Последняя проверка */
  lastChecked: Date;
}
