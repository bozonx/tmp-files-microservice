import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory';

describe('Health (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    // Create fresh app instance for each test for better isolation
    app = await createTestApp();
  });

  afterEach(async () => {
    // Clean up app instance after each test
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/v1/health', () => {
    it('returns health check with status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('info');
      expect(body).toHaveProperty('details');
    });

    it('includes service health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.details).toHaveProperty('service');
      expect(body.details.service).toHaveProperty('status', 'up');
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('returns readiness probe status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body.details).toHaveProperty('ready');
    });
  });

  describe('GET /api/v1/health/live', () => {
    it('returns liveness probe with uptime', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body.details).toHaveProperty('uptime');
      expect(body.details.uptime).toHaveProperty('uptime');
      expect(typeof body.details.uptime.uptime).toBe('number');
    });
  });
});
