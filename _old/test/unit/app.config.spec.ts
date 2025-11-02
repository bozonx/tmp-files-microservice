/**
 * Тесты для конфигурации приложения
 * Проверяют правильность работы с переменными окружения и их значениями по умолчанию
 */

import { createConfig, validateConfig, getConfig } from '../../src/config/app.config';

describe('AppConfig', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Сохраняем оригинальные переменные окружения
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Восстанавливаем оригинальные переменные окружения
    process.env = originalEnv;
  });

  describe('createConfig', () => {
    it('should use default values when environment variables are not set', () => {
      // Очищаем все переменные окружения
      delete process.env.NODE_ENV;
      delete process.env.LISTEN_HOST;
      delete process.env.LISTEN_PORT;
      delete process.env.AUTH_ENABLED;
      delete process.env.ENABLE_DEDUPLICATION;

      const config = createConfig();

      // Проверяем значения по умолчанию
      expect(config.server.host).toBe('localhost');
      expect(config.server.port).toBe(3000);
      expect(config.server.enableSwagger).toBe(true); // NODE_ENV по умолчанию development
      expect(config.auth.enabled).toBe(true); // AUTH_ENABLED по умолчанию включена
      expect(config.storage.enableDeduplication).toBe(true); // ENABLE_DEDUPLICATION по умолчанию включена
      expect(config.logging.enableFileLogging).toBe(false); // NODE_ENV по умолчанию development
    });

    it('should use environment variable values when set', () => {
      process.env.NODE_ENV = 'production';
      process.env.LISTEN_HOST = '0.0.0.0';
      process.env.LISTEN_PORT = '8080';
      process.env.AUTH_ENABLED = 'false';
      process.env.ENABLE_DEDUPLICATION = 'false';

      const config = createConfig();

      expect(config.server.host).toBe('0.0.0.0');
      expect(config.server.port).toBe(8080);
      expect(config.server.enableSwagger).toBe(false); // NODE_ENV = production
      expect(config.auth.enabled).toBe(false);
      expect(config.storage.enableDeduplication).toBe(false);
      expect(config.logging.enableFileLogging).toBe(true); // NODE_ENV = production
    });

    it('should handle AUTH_ENABLED edge cases correctly', () => {
      // Тест 1: AUTH_ENABLED не задана (должна быть включена по умолчанию)
      delete process.env.AUTH_ENABLED;
      let config = createConfig();
      expect(config.auth.enabled).toBe(true);

      // Тест 2: AUTH_ENABLED = 'false' (должна быть выключена)
      process.env.AUTH_ENABLED = 'false';
      config = createConfig();
      expect(config.auth.enabled).toBe(false);

      // Тест 3: AUTH_ENABLED = 'true' (должна быть включена)
      process.env.AUTH_ENABLED = 'true';
      config = createConfig();
      expect(config.auth.enabled).toBe(true);

      // Тест 4: AUTH_ENABLED = 'anything_else' (должна быть включена)
      process.env.AUTH_ENABLED = 'anything_else';
      config = createConfig();
      expect(config.auth.enabled).toBe(true);
    });

    it('should handle ENABLE_DEDUPLICATION edge cases correctly', () => {
      // Тест 1: ENABLE_DEDUPLICATION не задана (должна быть включена по умолчанию)
      delete process.env.ENABLE_DEDUPLICATION;
      let config = createConfig();
      expect(config.storage.enableDeduplication).toBe(true);

      // Тест 2: ENABLE_DEDUPLICATION = 'false' (должна быть выключена)
      process.env.ENABLE_DEDUPLICATION = 'false';
      config = createConfig();
      expect(config.storage.enableDeduplication).toBe(false);

      // Тест 3: ENABLE_DEDUPLICATION = 'true' (должна быть включена)
      process.env.ENABLE_DEDUPLICATION = 'true';
      config = createConfig();
      expect(config.storage.enableDeduplication).toBe(true);

      // Тест 4: ENABLE_DEDUPLICATION = 'anything_else' (должна быть включена)
      process.env.ENABLE_DEDUPLICATION = 'anything_else';
      config = createConfig();
      expect(config.storage.enableDeduplication).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate STORAGE_DIR as required', () => {
      process.env.STORAGE_DIR = '';
      const config = createConfig();
      const errors = validateConfig(config);

      expect(errors).toContain('STORAGE_DIR environment variable is required');
    });

    it('should validate AUTH_TOKEN when AUTH_ENABLED is true and NODE_ENV is production', () => {
      process.env.STORAGE_DIR = '/test/storage';
      process.env.AUTH_ENABLED = 'true';
      process.env.NODE_ENV = 'production';
      process.env.AUTH_TOKEN = 'short'; // Слишком короткий ключ для production

      const config = createConfig();
      const errors = validateConfig(config);

      expect(errors).toContain(
        'AUTH_TOKEN must be at least 32 characters long in production environment',
      );
    });

    it('should not validate AUTH_TOKEN length when NODE_ENV is not production', () => {
      process.env.STORAGE_DIR = '/test/storage';
      process.env.AUTH_ENABLED = 'true';
      process.env.NODE_ENV = 'development';
      process.env.AUTH_TOKEN = 'short'; // Короткий ключ, но не production

      const config = createConfig();
      const errors = validateConfig(config);

      expect(errors).not.toContain(
        'AUTH_TOKEN must be at least 32 characters long in production environment',
      );
    });

    it('should validate AUTH_TOKEN is required when AUTH_ENABLED is true', () => {
      process.env.STORAGE_DIR = '/test/storage';
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = ''; // Пустой ключ

      const config = createConfig();
      const errors = validateConfig(config);

      expect(errors).toContain(
        'AUTH_TOKEN environment variable is required when AUTH_ENABLED is true',
      );
    });

    it('should not validate AUTH_TOKEN when AUTH_ENABLED is false', () => {
      process.env.STORAGE_DIR = '/test/storage';
      process.env.AUTH_ENABLED = 'false';
      process.env.AUTH_TOKEN = 'short'; // Короткий ключ, но auth выключена

      const config = createConfig();
      const errors = validateConfig(config);

      expect(errors).not.toContain(
        'AUTH_TOKEN environment variable is required when AUTH_ENABLED is true',
      );
      expect(errors).not.toContain(
        'AUTH_TOKEN must be at least 32 characters long in production environment',
      );
    });

    it('should pass validation with valid configuration', () => {
      process.env.STORAGE_DIR = '/test/storage';
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = 'valid-secret-key-that-is-long-enough-12345678901234567890';

      const config = createConfig();
      const errors = validateConfig(config);

      expect(errors).toHaveLength(0);
    });

    it('should validate server port range', () => {
      process.env.STORAGE_DIR = '/test/storage';
      process.env.LISTEN_PORT = '0'; // Невалидный порт

      const config = createConfig();
      const errors = validateConfig(config);

      expect(errors).toContain('Server port must be between 1 and 65535');
    });

    it('should validate server host is not empty', () => {
      process.env.STORAGE_DIR = '/test/storage';
      process.env.LISTEN_HOST = '   '; // Пробелы - невалидное значение

      const config = createConfig();
      const errors = validateConfig(config);

      expect(errors).toContain('Server host cannot be empty');
    });
  });

  describe('getConfig', () => {
    it('should throw error when validation fails', () => {
      process.env.STORAGE_DIR = ''; // Невалидная конфигурация

      expect(() => getConfig()).toThrow('Configuration validation failed');
    });

    it('should return valid configuration when validation passes', () => {
      process.env.STORAGE_DIR = '/test/storage';
      process.env.AUTH_ENABLED = 'true';
      process.env.AUTH_TOKEN = 'valid-secret-key-that-is-long-enough-12345678901234567890';

      const config = getConfig();

      expect(config).toBeDefined();
      expect(config.storage.basePath).toBe('/test/storage');
      expect(config.auth.enabled).toBe(true);
    });
  });

  describe('NODE_ENV default behavior', () => {
    it('should default to development when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;

      const config = createConfig();

      expect(config.server.enableSwagger).toBe(true); // development mode
      expect(config.logging.enableFileLogging).toBe(false); // development mode
    });

    it('should use production mode when NODE_ENV is set to production', () => {
      process.env.NODE_ENV = 'production';

      const config = createConfig();

      expect(config.server.enableSwagger).toBe(false); // production mode
      expect(config.logging.enableFileLogging).toBe(true); // production mode
    });
  });
});
