/**
 * Простой E2E тест для проверки базовой функциональности
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, cleanupTestApp, clearTestStorage } from './e2e-test-utils';

describe('Simple E2E Test', () => {
  let app: INestApplication;
  let config: any;

  beforeAll(async () => {
    const testApp = await createTestApp('simple', true); // Включаем аутентификацию для консистентности
    app = testApp.app;
    config = testApp.config;
  });

  afterAll(async () => {
    await cleanupTestApp(app, config.testStoragePath);
  });

  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  it('should have HTTP server', () => {
    expect(app.getHttpServer()).toBeDefined();
  });

  it('should respond to health check', async () => {
    const response = await request(app.getHttpServer()).get(config.apiPaths.health()).expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('version');
  });

  it('should require authentication for files endpoint', async () => {
    await request(app.getHttpServer()).get(config.apiPaths.files()).expect(401);
  });

  it('should allow access with valid token', async () => {
    const response = await request(app.getHttpServer())
      .get(config.apiPaths.files())
      .set('Authorization', `Bearer ${config.validToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('files');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('pagination');
  });
});
