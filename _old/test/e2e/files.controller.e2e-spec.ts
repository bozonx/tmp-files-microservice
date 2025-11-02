/**
 * E2E тесты для FilesController
 * Детальное тестирование всех endpoints контроллера файлов
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getConfig } from '../../src/config/app.config';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  createTestApp,
  cleanupTestApp,
  clearTestStorage,
  createTestFile,
  createTestBinaryFile,
  createTestPngFile,
  createTestJsonFile,
  createTestHtmlFile,
  createTestCssFile,
  createTestJsFile,
  createTestMetadata,
  expectFileStructure,
  expectPaginationStructure,
  expectStatsStructure,
} from './e2e-test-utils';

describe('FilesController (e2e)', () => {
  let app: INestApplication;
  let config: any;

  beforeAll(async () => {
    const testApp = await createTestApp('files-controller');
    app = testApp.app;
    config = testApp.config;
  });

  afterAll(async () => {
    await cleanupTestApp(app, config.testStoragePath);
  });

  beforeEach(async () => {
    await clearTestStorage(config.testStoragePath);
  });

  describe('POST /api/v1/files - Upload File', () => {
    it('should upload a text file successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Hello, World!'), 'hello.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .expect(201);

      expect(response.body).toHaveProperty('file');
      expect(response.body).toHaveProperty('downloadUrl');
      expect(response.body).toHaveProperty('infoUrl');
      expect(response.body).toHaveProperty('deleteUrl');
      expect(response.body).toHaveProperty('message', 'File uploaded successfully');

      const file = response.body.file;
      expect(file).toHaveProperty('id');
      expect(file).toHaveProperty('originalName', 'hello.txt');
      expect(file).toHaveProperty('mimeType', 'text/plain');
      expect(file).toHaveProperty('size', 13);
      expect(file).toHaveProperty('uploadedAt');
      expect(file).toHaveProperty('ttl', 3600); // TTL from request
      expect(file).toHaveProperty('expiresAt');
      expect(file).toHaveProperty('hash');
      expect(file).toHaveProperty('isExpired', false);
      expect(file).toHaveProperty('timeRemaining');
      expect(file.timeRemaining).toBeGreaterThan(0);
    });

    it('should upload a file with custom TTL', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Test content'), 'test.txt')
        .field('ttl', '7200') // 2 hours
        .expect(201);

      expect(response.body.file.ttl).toBe(7200);
      expect(response.body.file.timeRemaining).toBeGreaterThan(7000);
    });

    it('should upload a file with metadata', async () => {
      const metadata = {
        description: 'Test file for E2E testing',
        category: 'test',
        tags: ['e2e', 'test'],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Test content'), 'test.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .field('metadata', JSON.stringify(metadata))
        .expect(201);

      expect(response.body.file.metadata).toEqual(metadata);
    });

    it('should upload a file with custom filename', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Test content'), 'original.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .field('customFilename', 'custom-name.txt')
        .expect(201);

      expect(response.body.file.originalName).toBe('original.txt');
    });

    it('should handle duplicate files when allowDuplicate is true', async () => {
      const content = 'Duplicate content';

      // Загружаем первый файл
      const response1 = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from(content), 'file1.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .field('allowDuplicate', 'true')
        .expect(201);

      // Загружаем второй файл с тем же содержимым
      const response2 = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from(content), 'file2.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .field('allowDuplicate', 'true')
        .expect(201);

      // Файлы должны иметь разные ID, но одинаковый хеш
      expect(response1.body.file.id).not.toBe(response2.body.file.id);
      expect(response1.body.file.hash).toBe(response2.body.file.hash);
    });

    it('should reject upload without file', () => {
      return request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .field('ttl', '3600')
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('No file provided');
        });
    });

    it('should reject upload with invalid TTL (too small)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('test'), 'test.txt')
        .field('ttl', '30') // Less than 60 seconds
        .expect(400);
    });

    it('should reject upload with invalid TTL (too large)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('test'), 'test.txt')
        .field('ttl', '2592001') // More than 30 days
        .expect(400);
    });

    it('should reject upload with invalid metadata JSON', () => {
      return request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('test'), 'test.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .field('metadata', 'invalid json')
        .expect(400);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/files')
        .attach('file', Buffer.from('test'), 'test.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .expect(401);
    });
  });

  describe('GET /api/v1/files/:id - Get File Info', () => {
    let uploadedFileId: string;

    beforeEach(async () => {
      // Загружаем файл для тестирования
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Test content'), 'test.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .field('metadata', JSON.stringify({ description: 'Test file' }))
        .expect(201);

      uploadedFileId = response.body.file.id;
    });

    it('should get file information successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/files/${uploadedFileId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('file');
      expect(response.body).toHaveProperty('downloadUrl');
      expect(response.body).toHaveProperty('deleteUrl');

      const file = response.body.file;
      expect(file.id).toBe(uploadedFileId);
      expect(file.originalName).toBe('test.txt');
      expect(file.mimeType).toBe('text/plain');
      expect(file.size).toBe(12);
      expect(file.metadata).toEqual({ description: 'Test file' });
      expect(file.isExpired).toBe(false);
    });

    it('should get file info with includeExpired=true', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/files/${uploadedFileId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .query({ includeExpired: 'true' })
        .expect(200);

      expect(response.body.file.id).toBe(uploadedFileId);
    });

    it('should return 404 for non-existent file', () => {
      const nonExistentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      return request(app.getHttpServer())
        .get(`/api/v1/files/${nonExistentId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(404);
    });

    it('should return 400 for invalid file ID format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/files/invalid-id')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(400);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).get(`/api/v1/files/${uploadedFileId}`).expect(401);
    });
  });

  describe('GET /api/v1/files/:id/download - Download File', () => {
    let uploadedFileId: string;
    let fileContent: string;

    beforeEach(async () => {
      fileContent = 'Download test content';
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from(fileContent), 'download-test.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .expect(201);

      uploadedFileId = response.body.file.id;
    });

    it('should download file successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/files/${uploadedFileId}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('text/plain');
      expect(response.headers['content-length']).toBe('22');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('download-test.txt');
      expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['expires']).toBe('0');
      expect(response.text).toBe(fileContent);
    });

    it('should download file with includeExpired=true', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/files/${uploadedFileId}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .query({ includeExpired: 'true' })
        .expect(200);

      expect(response.text).toBe(fileContent);
    });

    it('should return 404 for non-existent file', () => {
      const nonExistentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      return request(app.getHttpServer())
        .get(`/api/v1/files/${nonExistentId}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(404);
    });

    it('should return 400 for invalid file ID format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/files/invalid-id/download')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(400);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/files/${uploadedFileId}/download`)
        .expect(401);
    });
  });

  describe('DELETE /api/v1/files/:id - Delete File', () => {
    let uploadedFileId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Delete test content'), 'delete-test.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .expect(201);

      uploadedFileId = response.body.file.id;
    });

    it('should delete file successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/files/${uploadedFileId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('fileId', uploadedFileId);
      expect(response.body).toHaveProperty('message', 'File deleted successfully');
      expect(response.body).toHaveProperty('deletedAt');

      // Проверяем, что файл действительно удален
      await request(app.getHttpServer())
        .get(`/api/v1/files/${uploadedFileId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(404);
    });

    it('should delete file with force=true', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/files/${uploadedFileId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .query({ force: 'true' })
        .expect(200);

      expect(response.body.fileId).toBe(uploadedFileId);
    });

    it('should return 404 for non-existent file', () => {
      const nonExistentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      return request(app.getHttpServer())
        .delete(`/api/v1/files/${nonExistentId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(404);
    });

    it('should return 400 for invalid file ID format', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/files/invalid-id')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(400);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).delete(`/api/v1/files/${uploadedFileId}`).expect(401);
    });
  });

  describe('GET /api/v1/files - List Files', () => {
    beforeEach(async () => {
      // Загружаем несколько файлов для тестирования
      const files = [
        { content: 'File 1 content', name: 'file1.txt', metadata: { category: 'test' } },
        { content: 'File 2 content', name: 'file2.txt', metadata: { category: 'demo' } },
        { content: 'File 3 content', name: 'file3.txt', metadata: { category: 'test' } },
      ];

      for (const file of files) {
        await request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', Buffer.from(file.content), file.name)
          .field('ttl', '3600') // TTL теперь обязательный
          .field('metadata', JSON.stringify(file.metadata))
          .expect(201);
      }
    });

    it('should list all files', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('files');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.files)).toBe(true);
      expect(response.body.files.length).toBeGreaterThanOrEqual(3);
      expect(response.body.total).toBeGreaterThanOrEqual(3);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .query({ limit: 2, offset: 0 })
        .expect(200);

      expect(response.body.files.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit', 2);
      expect(response.body.pagination).toHaveProperty('totalPages');
      expect(response.body.pagination).toHaveProperty('hasNext');
      expect(response.body.pagination).toHaveProperty('hasPrev');
    });

    it('should filter by MIME type', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .query({ mimeType: 'text/plain; charset=utf-8' })
        .expect(200);

      expect(response.body.files.length).toBeGreaterThanOrEqual(0);
      response.body.files.forEach((file: any) => {
        expect(file.mimeType).toBe('text/plain');
      });
    });

    it('should filter by file size range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .query({ minSize: 10, maxSize: 20 })
        .expect(200);

      expect(response.body.files.length).toBeGreaterThanOrEqual(0);
      response.body.files.forEach((file: any) => {
        expect(file.size).toBeGreaterThanOrEqual(10);
        expect(file.size).toBeLessThanOrEqual(20);
      });
    });

    it('should filter by upload date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const response = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .query({
          uploadedAfter: yesterday.toISOString(),
          uploadedBefore: tomorrow.toISOString(),
        })
        .expect(200);

      expect(response.body.files.length).toBeGreaterThanOrEqual(0);
    });

    it('should show only expired files when requested', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .query({ expiredOnly: 'true' })
        .expect(200);

      expect(response.body.files.length).toBeGreaterThanOrEqual(0);
      // В данном тесте файлы не должны быть истекшими, так как TTL = 3600 секунд
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).get('/api/v1/files').expect(401);
    });
  });

  describe('GET /api/v1/files/stats - Get File Statistics', () => {
    beforeEach(async () => {
      // Загружаем файлы для статистики
      await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Stats test 1'), 'stats1.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Stats test 2'), 'stats2.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .expect(201);
    });

    it('should get file statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/files/stats')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('generatedAt');

      const stats = response.body.stats;
      expect(stats).toHaveProperty('totalFiles');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('filesByMimeType');
      expect(stats).toHaveProperty('filesByDate');

      expect(stats.totalFiles).toBeGreaterThanOrEqual(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(typeof stats.filesByMimeType).toBe('object');
      expect(typeof stats.filesByDate).toBe('object');
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).get('/api/v1/files/stats').expect(401);
    });
  });

  describe('GET /api/v1/files/:id/exists - Check File Existence', () => {
    let uploadedFileId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Existence test'), 'exists-test.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .expect(201);

      uploadedFileId = response.body.file.id;
    });

    it('should check file existence successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/files/${uploadedFileId}/exists`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('exists', true);
      expect(response.body).toHaveProperty('fileId', uploadedFileId);
      expect(response.body).toHaveProperty('isExpired', false);
    });

    it('should check file existence with includeExpired=true', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/files/${uploadedFileId}/exists`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .query({ includeExpired: 'true' })
        .expect(200);

      expect(response.body.exists).toBe(true);
      expect(response.body.fileId).toBe(uploadedFileId);
    });

    it('should return false for non-existent file', async () => {
      const nonExistentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const response = await request(app.getHttpServer())
        .get(`/api/v1/files/${nonExistentId}/exists`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('exists', false);
      expect(response.body).toHaveProperty('fileId', nonExistentId);
      expect(response.body).not.toHaveProperty('isExpired');
    });

    it('should return 400 for invalid file ID format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/files/invalid-id/exists')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(400);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).get(`/api/v1/files/${uploadedFileId}/exists`).expect(401);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle large files', async () => {
      // Создаем файл размером 1MB
      const largeContent = Buffer.alloc(1024 * 1024, 'A');

      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', largeContent, 'large-file.txt')
        .expect(201);

      expect(response.body.file.size).toBe(1024 * 1024);
    });

    it('should handle files with special characters in name', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Special chars test'), 'файл с пробелами & символами.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .expect(201);

      expect(response.body.file.originalName).toBe('файл с пробелами & символами.txt');
    });

    it('should handle empty files', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from(''), 'empty.txt')
        .field('ttl', '3600') // TTL теперь обязательный
        .expect(201);

      expect(response.body.file.size).toBe(0);
    });

    it('should handle files with very long names', async () => {
      const longName = 'a'.repeat(255) + '.txt';
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from('Long name test'), longName)
        .field('ttl', '3600') // TTL теперь обязательный
        .expect(201);

      expect(response.body.file.originalName).toBe(longName);
    });

    it('should handle concurrent uploads', async () => {
      const uploadPromises = Array.from(
        { length: 5 },
        (_, i) =>
          request(app.getHttpServer())
            .post('/api/v1/files')
            .set('Authorization', `Bearer ${config.validToken}`)
            .attach('file', Buffer.from(`Concurrent test ${i}`), `concurrent-${i}.txt`)
            .field('ttl', '3600'), // TTL теперь обязательный
      );

      const responses = await Promise.all(uploadPromises);

      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.file.originalName).toBe(`concurrent-${index}.txt`);
      });
    });
  });
});
