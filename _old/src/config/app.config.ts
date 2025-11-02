/**
 * Конфигурация приложения
 */

/**
 * Константы для хранилища
 */
export const STORAGE_CONSTANTS = {
  /** Формат организации файлов по датам */
  DATE_FORMAT: 'YYYY-MM',
} as const;

/**
 * Конфигурация timezone
 */
export interface TimezoneConfig {
  /** Часовой пояс по умолчанию */
  default: string;
}

/**
 * Парсинг разрешенных MIME типов из переменной окружения
 * @param allowedMimeTypesStr - строка с MIME типами в формате JSON массива или пустая строка
 * @returns массив разрешенных MIME типов или пустой массив (разрешены все типы)
 */
function parseAllowedMimeTypes(allowedMimeTypesStr?: string): string[] {
  if (!allowedMimeTypesStr || allowedMimeTypesStr.trim() === '') {
    return []; // Пустой массив = разрешены все типы
  }

  try {
    // Пытаемся распарсить как JSON массив
    const parsed = JSON.parse(allowedMimeTypesStr);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => typeof item === 'string' && item.trim() !== '')
        .map((item) => item.trim());
    }
  } catch (error) {
    // Если не удалось распарсить как JSON, игнорируем ошибку
  }

  return []; // По умолчанию разрешены все типы
}

/**
 * Основная конфигурация приложения
 */
export interface AppConfig {
  /** Настройки сервера */
  server: ServerConfig;

  /** Настройки хранилища */
  storage: StorageConfig;

  /** Настройки аутентификации */
  auth: AuthConfig;

  /** Настройки очистки */
  cleanup: CleanupConfig;

  /** Настройки логирования */
  logging: LoggingConfig;

  /** Настройки CORS */
  cors: CorsConfig;

  /** Настройки timezone */
  timezone: TimezoneConfig;
}

/**
 * Конфигурация сервера
 */
export interface ServerConfig {
  /** Порт для прослушивания */
  port: number;

  /** Хост для прослушивания */
  host: string;

  /** Базовый путь для API (может быть пустым для работы от корня) */
  basePath: string;

  /** Версия API */
  apiVersion: string;

  /** Включить Swagger документацию */
  enableSwagger: boolean;

  /** Включить глобальную валидацию */
  enableGlobalValidation: boolean;
}

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

  /** Максимальное время жизни файла в секундах */
  maxTtl: number;
}

/**
 * Конфигурация аутентификации
 */
export interface AuthConfig {
  /** Включить аутентификацию */
  enabled: boolean;

  /** Секретный ключ для JWT токенов */
  secretKey: string;

  /** Время жизни токена в секундах */
  tokenExpiration: number;

  /** Алгоритм подписи токена */
  algorithm: string;

  /** Исключения из аутентификации (пути) */
  excludePaths: string[];
}

/**
 * Конфигурация очистки
 */
export interface CleanupConfig {
  /** Включить автоматическую очистку */
  enabled: boolean;

  /** Cron выражение для расписания очистки */
  cronExpression: string;

  /** Включить логирование операций очистки */
  enableLogging: boolean;

  /** Максимальное количество файлов для удаления за раз */
  maxFilesPerBatch: number;
}

/**
 * Конфигурация логирования
 */
export interface LoggingConfig {
  /** Уровень логирования */
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';

  /** Включить логирование в файл */
  enableFileLogging: boolean;

  /** Путь к файлу логов */
  logFilePath: string;

  /** Максимальный размер файла лога в байтах */
  maxLogFileSize: number;

  /** Максимальное количество файлов логов */
  maxLogFiles: number;

  /** Включить логирование запросов */
  enableRequestLogging: boolean;

  /** Включить логирование ошибок */
  enableErrorLogging: boolean;
}

/**
 * Конфигурация CORS
 */
export interface CorsConfig {
  /** Включить CORS */
  enabled: boolean;

  /** Разрешенные источники */
  origin: string | string[] | boolean;

  /** Разрешить учетные данные */
  credentials: boolean;

  /** Разрешенные методы */
  methods: string[];

  /** Разрешенные заголовки */
  allowedHeaders: string[];

  /** Заголовки для экспозиции */
  exposedHeaders: string[];

  /** Максимальный возраст preflight запроса */
  maxAge: number;
}

/**
 * Конфигурация по умолчанию
 * @deprecated Используйте createConfig() для динамического создания конфигурации
 */
export const defaultConfig: AppConfig = createConfig();

/**
 * Валидация конфигурации
 */
export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];

  // Валидация сервера
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Server port must be between 1 and 65535');
  }

  if (!config.server.host || config.server.host.trim() === '') {
    errors.push('Server host cannot be empty');
  }

  // Валидация хранилища
  if (!config.storage.basePath || config.storage.basePath.trim() === '') {
    errors.push('STORAGE_DIR environment variable is required');
  }

  if (config.storage.maxFileSize < 1) {
    errors.push('Max file size must be greater than 0');
  }

  if (config.storage.maxTtl < 60) {
    errors.push('Max TTL must be at least 60 seconds (1 minute)');
  }

  // Валидация аутентификации
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  if (config.auth.enabled) {
    if (!config.auth.secretKey) {
      errors.push('AUTH_TOKEN environment variable is required when AUTH_ENABLED is true');
    } else if (isProduction && config.auth.secretKey.length < 32) {
      errors.push('AUTH_TOKEN must be at least 32 characters long in production environment');
    }
  }

  if (config.auth.tokenExpiration < 60) {
    errors.push('Token expiration must be at least 60 seconds');
  }

  // Валидация очистки
  if (config.cleanup.maxFilesPerBatch < 1) {
    errors.push('Max files per batch must be greater than 0');
  }

  return errors;
}

/**
 * Создание конфигурации из переменных окружения
 */
export function createConfig(): AppConfig {
  return {
    server: {
      port: parseInt(process.env.LISTEN_PORT || '3000', 10),
      host: process.env.LISTEN_HOST || 'localhost',
      basePath: process.env.API_BASE_PATH || 'api',
      apiVersion: process.env.API_VERSION || 'v1',
      enableSwagger: (process.env.NODE_ENV || 'development') !== 'production',
      enableGlobalValidation: true,
    },

    storage: {
      basePath: process.env.STORAGE_DIR!,
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) * 1024 * 1024, // Конвертируем MB в байты
      allowedMimeTypes: parseAllowedMimeTypes(process.env.ALLOWED_MIME_TYPES),
      enableDeduplication: process.env.ENABLE_DEDUPLICATION !== 'false',
      maxTtl: parseInt(process.env.MAX_TTL_MIN || '10080', 10) * 60, // Конвертируем минуты в секунды
    },

    auth: {
      enabled: process.env.AUTH_ENABLED !== 'false',
      secretKey: process.env.AUTH_TOKEN!,
      tokenExpiration: parseInt(process.env.AUTH_TOKEN_EXPIRATION || '3600', 10), // 1 час
      algorithm: 'HS256',
      excludePaths: [], // Будет заполнено динамически в getConfig()
    },

    cleanup: {
      enabled: true, // Очистка всегда включена - это основная функция микросервиса
      cronExpression: process.env.CLEANUP_CRON || '0 */10 * * * *', // каждые 10 минут
      enableLogging: true,
      maxFilesPerBatch: parseInt(process.env.CLEANUP_BATCH_SIZE || '100', 10),
    },

    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      enableFileLogging: (process.env.NODE_ENV || 'development') === 'production',
      logFilePath: process.env.LOG_FILE_PATH || './logs/app.log',
      maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE || '10485760', 10), // 10MB
      maxLogFiles: parseInt(process.env.MAX_LOG_FILES || '5', 10),
      enableRequestLogging: true,
      enableErrorLogging: true,
    },

    cors: {
      enabled: true,
      origin: process.env.CORS_ORIGIN || true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400, // 24 часа
    },

    timezone: {
      default: process.env.TZ || 'UTC',
    },
  };
}

/**
 * Получение конфигурации с валидацией
 */
export function getConfig(): AppConfig {
  const config = createConfig();

  // Динамически формируем excludePaths для аутентификации
  const basePath = config.server.basePath;
  const apiVersion = config.server.apiVersion;
  const healthPath = basePath ? `/${basePath}/${apiVersion}/health` : `/${apiVersion}/health`;

  config.auth.excludePaths = [healthPath];

  const errors = validateConfig(config);

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }

  return config;
}
