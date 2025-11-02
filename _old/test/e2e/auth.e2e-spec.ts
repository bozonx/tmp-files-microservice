/**
 * E2E тесты для проверки аутентификации
 * Тестирует различные сценарии аутентификации и авторизации
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, cleanupTestApp, clearTestStorage } from './e2e-test-utils';

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  let config: any;

  beforeAll(async () => {
    const testApp = await createTestApp('auth');
    app = testApp.app;
    config = testApp.config;
  });

  afterAll(async () => {
    await cleanupTestApp(app, config.testStoragePath);
  });

  beforeEach(async () => {
    await clearTestStorage(config.testStoragePath);
  });

  describe('Health Check (No Auth Required)', () => {
    it('should allow access to health endpoint without authentication', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('File Operations (Auth Required)', () => {
    it('should reject file upload without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/files')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(401);
    });

    it('should reject file upload with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', 'Bearer invalid-token')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(401);
    });

    it('should reject file upload with malformed authorization header', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', 'InvalidFormat token')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(401);
    });

    it('should reject file upload without Bearer prefix', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', config.validToken)
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(401);
    });

    it('should allow file upload with valid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(201);

      expect(response.body).toHaveProperty('file');
      expect(response.body.file).toHaveProperty('id');
      expect(response.body.file.originalName).toBe('test.txt');
    });

    it('should reject file list without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/files').expect(401);
    });

    it('should allow file list with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('files');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should reject file stats without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/files/stats').expect(401);
    });

    it('should allow file stats with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/files/stats')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalFiles');
      expect(response.body.stats).toHaveProperty('totalSize');
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should handle empty authorization header', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', '')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(401);
    });

    it('should handle authorization header with only Bearer', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', 'Bearer ')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(401);
    });

    it('should handle authorization header with spaces', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer  ${config.validToken}  `)
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(401); // Пробелы в токене не обрезаются
    });

    it('should handle case-insensitive Bearer prefix', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `bearer ${config.validToken}`)
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(401); // Должно быть чувствительно к регистру
    });
  });

  describe('Error Response Format', () => {
    it('should return proper 401 error format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(401);

      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('message');
      expect(response.body.statusCode).toBe(401);
      expect(response.body.message).toContain('Authorization token is required');
    });
  });
});
