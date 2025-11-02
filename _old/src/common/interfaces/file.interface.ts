/**
 * Интерфейсы для работы с файлами и их метаданными
 */

/**
 * Основная информация о файле
 */
export interface FileInfo {
  /** Уникальный идентификатор файла */
  id: string;

  /** Оригинальное имя файла */
  originalName: string;

  /** Имя файла в хранилище */
  storedName: string;

  /** MIME тип файла */
  mimeType: string;

  /** Размер файла в байтах */
  size: number;

  /** SHA-256 хеш файла для дедупликации */
  hash: string;

  /** Дата и время загрузки */
  uploadedAt: Date;

  /** Время жизни файла в секундах */
  ttl: number;

  /** Дата истечения срока жизни */
  expiresAt: Date;

  /** Путь к файлу в хранилище */
  filePath: string;

  /** Дополнительные метаданные */
  metadata?: Record<string, any>;
}

/**
 * Информация о файле для API ответов
 */
export interface FileResponse {
  /** Уникальный идентификатор файла */
  id: string;

  /** Оригинальное имя файла */
  originalName: string;

  /** MIME тип файла */
  mimeType: string;

  /** Размер файла в байтах */
  size: number;

  /** Дата и время загрузки */
  uploadedAt: string; // ISO string

  /** Время жизни файла в секундах */
  ttl: number;

  /** Дата истечения срока жизни */
  expiresAt: string; // ISO string

  /** Дополнительные метаданные */
  metadata?: Record<string, any>;
}

/**
 * Информация о загружаемом файле
 */
export interface UploadedFile {
  /** Оригинальное имя файла */
  originalname: string;

  /** MIME тип файла */
  mimetype: string;

  /** Размер файла в байтах */
  size: number;

  /** Путь к временному файлу */
  path: string;

  /** Буфер файла */
  buffer?: Buffer;
}

/**
 * Параметры для создания файла
 */
export interface CreateFileParams {
  /** Загруженный файл */
  file: UploadedFile;

  /** Время жизни файла в секундах (обязательный параметр) */
  ttl: number;

  /** Дополнительные метаданные */
  metadata?: Record<string, any>;

  /** Разрешить дубликаты файлов */
  allowDuplicate?: boolean;
}

/**
 * Результат операции с файлом
 */
export interface FileOperationResult {
  /** Успешность операции */
  success: boolean;

  /** Сообщение об ошибке (если есть) */
  error?: string;

  /** Данные файла (если операция успешна) */
  data?: FileInfo | FileResponse;
}

/**
 * Статистика файлов
 */
export interface FileStats {
  /** Общее количество файлов */
  totalFiles: number;

  /** Общий размер всех файлов в байтах */
  totalSize: number;

  /** Количество файлов по MIME типам */
  filesByMimeType: Record<string, number>;

  /** Количество файлов по датам загрузки */
  filesByDate: Record<string, number>;
}
