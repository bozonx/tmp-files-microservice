/**
 * Shared mock objects for tests
 *
 * This file contains reusable mock factories to avoid duplication across test files.
 * All mocks follow the DRY principle and provide type-safe implementations.
 */

import { jest } from '@jest/globals'
import type { LoggerAdapter } from '@/adapters/logger.adapter.js'

/**
 * Creates a mock LoggerAdapter instance with all required methods
 *
 * @returns Mock LoggerAdapter with jest.fn() for all methods
 */
export const createMockLogger = (): LoggerAdapter => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
})

/**
 * Placeholder for future HTTP-related mocks if needed.
 */

/**
 * Creates a mock env source object with customizable overrides
 *
 * @param overrides - Object with config key-value pairs to override defaults
 * @returns Mock ConfigService that returns overridden values or defaults
 *
 * @example
 * const envSource = createMockEnvSource({
 *   LISTEN_PORT: '8080',
 *   LOG_LEVEL: 'debug'
 * })
 */
export const createMockEnvSource = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  NODE_ENV: 'test',
  LISTEN_HOST: '127.0.0.1',
  LISTEN_PORT: '8080',
  BASE_PATH: '',
  LOG_LEVEL: 'silent',
  DOWNLOAD_BASE_URL: '',
  MAX_FILE_SIZE_MB: '10',
  ALLOWED_MIME_TYPES: '',

  MAX_TTL_MIN: '44640',
  ...overrides,
})
