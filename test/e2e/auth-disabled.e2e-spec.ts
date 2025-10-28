import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory';
import { saveEnvVars, restoreEnvVars } from './env-helper';

describe('Authorization Disabled E2E Tests', () => {
  let app: NestFastifyApplication;
  let envSnapshot: ReturnType<typeof saveEnvVars>;

  beforeAll(() => {
    // Save current environment state before any modifications
    envSnapshot = saveEnvVars('AUTH_ENABLED', 'AUTH_TOKENS', 'ASSEMBLYAI_API_KEY');
  });

  beforeEach(async () => {
    // Set environment variables for each test
    process.env.AUTH_ENABLED = 'false';
    // AUTH_TOKENS not required when auth is disabled
    delete process.env.AUTH_TOKENS;
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

  describe('POST /api/v1/transcriptions/file with AUTH_ENABLED=false', () => {
    const validPayload = {
      audioUrl: 'https://example.com/audio.mp3',
      provider: 'assemblyai',
    };

    it('should allow access without Authorization header when auth is disabled', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcriptions/file',
        payload: validPayload,
      });

      // Should not return 401 (authorization is disabled)
      // Will return 503 due to AssemblyAI API call failure in test environment
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(503); // Expect 503 when external API fails
    });

    it('should allow access with any invalid token when auth is disabled', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcriptions/file',
        headers: {
          authorization: 'Bearer any-random-invalid-token',
        },
        payload: validPayload,
      });

      // Should not return 401 (authorization is disabled)
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(503); // Expect 503 when external API fails
    });

    it('should allow access with malformed Authorization header when auth is disabled', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcriptions/file',
        headers: {
          authorization: 'NotBearer token',
        },
        payload: validPayload,
      });

      // Should not return 401 (authorization is disabled)
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(503); // Expect 503 when external API fails
    });

    it('should allow access with empty Authorization header when auth is disabled', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcriptions/file',
        headers: {
          authorization: '',
        },
        payload: validPayload,
      });

      // Should not return 401 (authorization is disabled)
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(503); // Expect 503 when external API fails
    });
  });

  describe('Public endpoints should still work', () => {
    it('GET /api/v1/health should work without authorization', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
    });

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
