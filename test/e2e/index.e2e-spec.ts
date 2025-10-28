import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory';

describe('Index (e2e)', () => {
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

  it('GET /api/v1 returns API index with links', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('name', 'micro-stt');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('time');
    expect(body).toHaveProperty('links');
    expect(body.links).toMatchObject({
      self: '/api/v1',
      health: '/api/v1/health',
      transcriptions: '/api/v1/transcriptions',
    });
  });
});
