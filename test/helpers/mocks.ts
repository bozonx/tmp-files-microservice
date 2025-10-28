/**
 * Shared mock objects for tests
 *
 * This file contains reusable mock factories to avoid duplication across test files.
 * All mocks follow the DRY principle and provide type-safe implementations.
 */

import type { PinoLogger } from 'nestjs-pino';
import type { ConfigService } from '@nestjs/config';
import type { HttpService } from '@nestjs/axios';

/**
 * Creates a mock PinoLogger instance with all required methods
 *
 * @returns Mock PinoLogger with jest.fn() for all methods
 */
export const createMockLogger = (): PinoLogger =>
  ({
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
  }) as unknown as PinoLogger;

/**
 * Creates a mock HttpService instance with common HTTP methods
 *
 * @returns Mock HttpService with jest.fn() for all methods
 */
export const createMockHttpService = () =>
  ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    head: jest.fn(),
    request: jest.fn(),
  }) as unknown as HttpService;

/**
 * Creates a mock ConfigService instance with customizable configuration
 *
 * @param overrides - Object with config key-value pairs to override defaults
 * @returns Mock ConfigService that returns overridden values or defaults
 *
 * @example
 * const mockConfig = createMockConfigService({
 *   'app.authEnabled': true,
 *   'app.authTokens': ['token1', 'token2']
 * });
 */
export const createMockConfigService = (overrides: Record<string, any> = {}) =>
  ({
    get: jest.fn((key: string, defaultValue?: any) => {
      return overrides[key] ?? defaultValue;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (!(key in overrides)) {
        throw new Error(`Configuration key "${key}" not found`);
      }
      return overrides[key];
    }),
  }) as unknown as ConfigService;
