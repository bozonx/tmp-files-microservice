/**
 * Интерфейсы для API ответов и запросов
 */

import { FileResponse, FileStats } from './file.interface';
import { StorageHealth } from './storage.interface';

/**
 * Базовый интерфейс для API ответов
 */
export interface ApiResponse<T = any> {
  /** Успешность операции */
  success: boolean;

  /** Данные ответа */
  data?: T;

  /** Сообщение об ошибке */
  error?: string;

  /** Код ошибки */
  errorCode?: string;

  /** Время выполнения запроса в миллисекундах */
  executionTime?: number;

  /** Метаданные запроса */
  metadata?: {
    /** Время запроса */
    timestamp: string;

    /** Версия API */
    version: string;

    /** ID запроса для трекинга */
    requestId?: string;
  };
}

/**
 * Ответ для health check
 */
export interface HealthResponse {
  /** Статус приложения */
  status: 'healthy' | 'unhealthy' | 'degraded';

  /** Время запуска приложения */
  uptime: number;

  /** Версия приложения */
  version: string;

  /** Информация о хранилище */
  storage: StorageHealth;

  /** Время проверки */
  timestamp: string;

  /** Дополнительные проверки */
  checks?: {
    /** Проверка базы данных */
    database?: HealthCheck;

    /** Проверка файловой системы */
    filesystem?: HealthCheck;

    /** Проверка памяти */
    memory?: HealthCheck;
  };
}

/**
 * Результат проверки здоровья компонента
 */
export interface HealthCheck {
  /** Статус компонента */
  status: 'healthy' | 'unhealthy' | 'degraded';

  /** Сообщение о состоянии */
  message?: string;

  /** Время последней проверки */
  lastChecked: string;

  /** Время ответа в миллисекундах */
  responseTime?: number;
}

/**
 * Ответ для загрузки файла
 */
export interface UploadFileResponse {
  /** Информация о загруженном файле */
  file: FileResponse;

  /** URL для скачивания файла */
  downloadUrl: string;

  /** URL для получения информации о файле */
  infoUrl: string;

  /** URL для удаления файла */
  deleteUrl: string;
}

/**
 * Ответ для получения информации о файле
 */
export interface GetFileInfoResponse {
  /** Информация о файле */
  file: FileResponse;

  /** URL для скачивания файла */
  downloadUrl: string;

  /** URL для удаления файла */
  deleteUrl: string;
}

/**
 * Ответ для скачивания файла
 */
export interface DownloadFileResponse {
  /** Буфер файла */
  buffer: Buffer;

  /** MIME тип файла */
  mimeType: string;

  /** Имя файла для скачивания */
  filename: string;

  /** Размер файла */
  size: number;
}

/**
 * Ответ для удаления файла
 */
export interface DeleteFileResponse {
  /** ID удаленного файла */
  fileId: string;

  /** Сообщение об успешном удалении */
  message: string;
}

/**
 * Ответ для получения списка файлов
 */
export interface ListFilesResponse {
  /** Список файлов */
  files: FileResponse[];

  /** Общее количество файлов */
  total: number;

  /** Параметры пагинации */
  pagination: {
    /** Текущая страница */
    page: number;

    /** Размер страницы */
    limit: number;

    /** Общее количество страниц */
    totalPages: number;

    /** Есть ли следующая страница */
    hasNext: boolean;

    /** Есть ли предыдущая страница */
    hasPrev: boolean;
  };
}

/**
 * Ответ для получения статистики
 */
export interface GetStatsResponse {
  /** Статистика файлов */
  stats: FileStats;

  /** Информация о хранилище */
  storage: StorageHealth;

  /** Время генерации статистики */
  generatedAt: string;
}

/**
 * Ошибка валидации
 */
export interface ValidationError {
  /** Поле с ошибкой */
  field: string;

  /** Сообщение об ошибке */
  message: string;

  /** Значение, которое вызвало ошибку */
  value?: any;

  /** Ограничения валидации */
  constraints?: Record<string, string>;
}

/**
 * Ответ с ошибкой валидации
 */
export interface ValidationErrorResponse {
  /** Успешность операции (всегда false) */
  success: false;

  /** Сообщение об ошибке */
  error: string;

  /** Код ошибки */
  errorCode: 'VALIDATION_ERROR';

  /** Детали ошибок валидации */
  validationErrors: ValidationError[];
}

/**
 * Ответ с ошибкой аутентификации
 */
export interface AuthErrorResponse {
  /** Успешность операции (всегда false) */
  success: false;

  /** Сообщение об ошибке */
  error: string;

  /** Код ошибки */
  errorCode: 'AUTH_ERROR' | 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_MISSING';

  /** Время истечения токена (если применимо) */
  expiresAt?: string;
}

/**
 * Ответ с ошибкой файла
 */
export interface FileErrorResponse {
  /** Успешность операции (всегда false) */
  success: false;

  /** Сообщение об ошибке */
  error: string;

  /** Код ошибки */
  errorCode:
    | 'FILE_NOT_FOUND'
    | 'FILE_TOO_LARGE'
    | 'INVALID_FILE_TYPE'
    | 'FILE_EXPIRED'
    | 'STORAGE_ERROR';

  /** ID файла (если применимо) */
  fileId?: string;
}

/**
 * Параметры пагинации
 */
export interface PaginationParams {
  /** Номер страницы (начиная с 1) */
  page?: number;

  /** Размер страницы */
  limit?: number;

  /** Поле для сортировки */
  sortBy?: string;

  /** Направление сортировки */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Параметры фильтрации файлов
 */
export interface FileFilterParams extends PaginationParams {
  /** Фильтр по MIME типу */
  mimeType?: string;

  /** Фильтр по размеру файла (минимальный) */
  minSize?: number;

  /** Фильтр по размеру файла (максимальный) */
  maxSize?: number;

  /** Фильтр по дате загрузки (от) */
  uploadedAfter?: string; // ISO date string

  /** Фильтр по дате загрузки (до) */
  uploadedBefore?: string; // ISO date string

  /** Фильтр по истечению срока */
  expiredOnly?: boolean;
}
