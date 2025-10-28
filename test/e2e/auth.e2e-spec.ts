import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory';
import { saveEnvVars, restoreEnvVars } from './env-helper';

describe('Authorization E2E Tests', () => {
  let app: NestFastifyApplication;
  const validToken = 'test-token-1';
  const invalidToken = 'invalid-token';
  let envSnapshot: ReturnType<typeof saveEnvVars>;

  beforeAll(() => {
    // Save current environment state before any modifications
    envSnapshot = saveEnvVars('AUTH_ENABLED', 'AUTH_TOKENS', 'ASSEMBLYAI_API_KEY');
  });

  beforeEach(async () => {
    // Set environment variables for each test
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_TOKENS = `${validToken},test-token-2,test-token-3`;
    process.env.ASSEMBLYAI_API_KEY = 'test-key';

    // Create fresh app instance for each test for better isolation
    app = await createTestApp();
  });

  afterEach(async () => {
    // Clean up app instance after each test
    if (app) {
      await app.close();
    }
  });

  afterAll(() => {
    // Restore original environment state
    restoreEnvVars(envSnapshot);
  });

  describe('POST /api/v1/transcriptions/file', () => {
    const validPayload = {
      audioUrl: 'https://example.com/audio.mp3',
      provider: 'assemblyai',
    };

    it('should return 401 when Authorization header is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcriptions/file',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Missing Authorization header');
    });

    it('should return 401 when Authorization header format is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcriptions/file',
        headers: {
          authorization: 'InvalidFormat token',
        },
        payload: validPayload,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Invalid Authorization header format. Expected: Bearer <token>');
    });

    it('should return 401 when Bearer token is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcriptions/file',
        headers: {
          authorization: `Bearer ${invalidToken}`,
        },
        payload: validPayload,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Invalid authorization token');
    });

    it('should return 401 when Bearer keyword is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcriptions/file',
        headers: {
          authorization: validToken,
        },
        payload: validPayload,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should allow access with valid Bearer token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcriptions/file',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        payload: validPayload,
      });

      // Should not return 401 (authorization passed)
      // Will return 503 due to AssemblyAI API call failure in test environment
      // but not due to authorization
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(503); // Expect 503 when external API fails
    });

    it('should reject when Bearer is lowercase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcriptions/file',
        headers: {
          authorization: `bearer ${validToken}`,
        },
        payload: validPayload,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Health endpoints should remain public', () => {
    it('GET /api/v1/health should work without authorization', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /api/v1/health/ready should work without authorization', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health/ready',
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /api/v1/health/live should work without authorization', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health/live',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Index endpoint should remain public', () => {
    it('GET /api/v1 should work without authorization', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('micro-stt');
    });
  });
});
