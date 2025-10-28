import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AuthGuard } from '@common/guards/auth.guard';
import type { FastifyRequest } from 'fastify';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let configService: ConfigService;
  let mockLogger: PinoLogger;

  const mockTokens = ['valid-token-1', 'valid-token-2', 'valid-token-3'];

  beforeEach(() => {
    mockLogger = {
      setContext: jest.fn(),
      warn: jest.fn(),
    } as unknown as PinoLogger;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'app.authEnabled') return true;
        if (key === 'app.authTokens') return mockTokens;
        return undefined;
      }),
    } as unknown as ConfigService;

    guard = new AuthGuard(configService, mockLogger);
  });

  describe('constructor', () => {
    it('should throw error if AUTH_TOKENS is empty when auth is enabled', () => {
      const emptyConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'app.authEnabled') return true;
          if (key === 'app.authTokens') return [];
          return undefined;
        }),
      } as unknown as ConfigService;

      expect(() => new AuthGuard(emptyConfigService, mockLogger)).toThrow(
        'AUTH_TOKENS configuration is missing or empty when AUTH_ENABLED is true',
      );
    });

    it('should not throw error if AUTH_TOKENS is empty when auth is disabled', () => {
      const disabledAuthConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'app.authEnabled') return false;
          if (key === 'app.authTokens') return [];
          return undefined;
        }),
      } as unknown as ConfigService;

      expect(() => new AuthGuard(disabledAuthConfigService, mockLogger)).not.toThrow();
    });

    it('should initialize with valid tokens when auth is enabled', () => {
      expect(guard).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('app.authEnabled', false);
      expect(configService.get).toHaveBeenCalledWith('app.authTokens', []);
    });
  });

  describe('canActivate', () => {
    const createMockContext = (authHeader?: string): ExecutionContext => {
      const mockRequest = {
        headers: {
          authorization: authHeader,
        },
      } as FastifyRequest;

      return {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;
    };

    it('should allow access with valid Bearer token', () => {
      const context = createMockContext('Bearer valid-token-1');
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access with any valid token from the list', () => {
      mockTokens.forEach(token => {
        const context = createMockContext(`Bearer ${token}`);
        expect(guard.canActivate(context)).toBe(true);
      });
    });

    it('should throw UnauthorizedException when Authorization header is missing', () => {
      const context = createMockContext();
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing Authorization header');
    });

    it('should throw UnauthorizedException when Authorization header format is invalid', () => {
      const context = createMockContext('InvalidFormat token');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid Authorization header format. Expected: Bearer <token>',
      );
    });

    it('should throw UnauthorizedException when Bearer keyword is missing', () => {
      const context = createMockContext('valid-token-1');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is missing after Bearer', () => {
      const context = createMockContext('Bearer ');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid Authorization header format. Expected: Bearer <token>',
      );
    });

    it('should throw UnauthorizedException when token is invalid', () => {
      const context = createMockContext('Bearer invalid-token');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid authorization token');
    });

    it('should be case-sensitive for Bearer scheme', () => {
      const context = createMockContext('bearer valid-token-1');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should be case-sensitive for token', () => {
      const context = createMockContext('Bearer VALID-TOKEN-1');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('canActivate with AUTH_ENABLED=false', () => {
    beforeEach(() => {
      const disabledAuthConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'app.authEnabled') return false;
          if (key === 'app.authTokens') return [];
          return undefined;
        }),
      } as unknown as ConfigService;

      guard = new AuthGuard(disabledAuthConfigService, mockLogger);
    });

    const createMockContext = (authHeader?: string): ExecutionContext => {
      const mockRequest = {
        headers: {
          authorization: authHeader,
        },
      } as FastifyRequest;

      return {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;
    };

    it('should allow access without Authorization header when auth is disabled', () => {
      const context = createMockContext();
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access with any token when auth is disabled', () => {
      const context = createMockContext('Bearer any-random-token');
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access without Bearer format when auth is disabled', () => {
      const context = createMockContext('InvalidFormat token');
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access with empty Authorization header when auth is disabled', () => {
      const context = createMockContext('');
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
