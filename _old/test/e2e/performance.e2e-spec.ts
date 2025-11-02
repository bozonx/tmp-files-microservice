/**
 * E2E тесты производительности
 * Тестирует производительность системы при различных нагрузках
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
  measureExecutionTime,
  createTestFileArray,
} from './e2e-test-utils';

describe('Performance Tests (e2e)', () => {
  let app: INestApplication;
  let config: any;

  beforeAll(async () => {
    const testApp = await createTestApp('performance');
    app = testApp.app;
    config = testApp.config;
  });

  afterAll(async () => {
    await cleanupTestApp(app, config.testStoragePath);
  });

  beforeEach(async () => {
    await clearTestStorage(config.testStoragePath);
  });

  describe('Upload Performance', () => {
    it('should handle single file upload within acceptable time', async () => {
      const fileContent = createTestFile('Performance test content', 'perf-test.txt');

      const { result, executionTime } = await measureExecutionTime(async () => {
        return request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', fileContent, 'perf-test.txt')
          .expect(201);
      });

      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.body.file.originalName).toBe('perf-test.txt');
    });

    it('should handle large file upload efficiently', async () => {
      const largeFile = createTestBinaryFile(10 * 1024 * 1024, 'large-file.bin'); // 10MB

      const { result, executionTime } = await measureExecutionTime(async () => {
        return request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', largeFile, 'large-file.bin')
          .expect(201);
      });

      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.body.file.size).toBe(10 * 1024 * 1024);

      // Clean up
      await request(app.getHttpServer())
        .delete(`/api/v1/files/${result.body.file.id}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);
    });

    it('should handle multiple concurrent uploads efficiently', async () => {
      const fileCount = 20;
      const testFiles = createTestFileArray(fileCount, 'concurrent-perf');

      const { result, executionTime } = await measureExecutionTime(async () => {
        const uploadPromises = testFiles.map((file) =>
          request(app.getHttpServer())
            .post('/api/v1/files')
            .set('Authorization', `Bearer ${config.validToken}`)
            .attach('file', createTestFile(file.content, file.name), file.name),
        );

        return Promise.all(uploadPromises);
      });

      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.length).toBe(fileCount);

      result.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.file.originalName).toBe(`concurrent-perf-${index}.txt`);
      });

      // Clean up
      const deletePromises = result.map((response) =>
        request(app.getHttpServer())
          .delete(`/api/v1/files/${response.body.file.id}`)
          .set('Authorization', `Bearer ${config.validToken}`),
      );
      await Promise.all(deletePromises);
    });
  });

  describe('Download Performance', () => {
    let uploadedFileId: string;
    let largeFileId: string;

    beforeEach(async () => {
      // Upload a regular file
      const regularResponse = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', createTestFile('Download performance test', 'download-test.txt'))
        .expect(201);
      uploadedFileId = regularResponse.body.file.id;

      // Upload a large file
      const largeFile = createTestBinaryFile(5 * 1024 * 1024, 'large-download.bin'); // 5MB
      const largeResponse = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', largeFile, 'large-download.bin')
        .expect(201);
      largeFileId = largeResponse.body.file.id;
    });

    afterEach(async () => {
      // Clean up uploaded files
      if (uploadedFileId) {
        await request(app.getHttpServer())
          .delete(`/api/v1/files/${uploadedFileId}`)
          .set('Authorization', `Bearer ${config.validToken}`);
      }
      if (largeFileId) {
        await request(app.getHttpServer())
          .delete(`/api/v1/files/${largeFileId}`)
          .set('Authorization', `Bearer ${config.validToken}`);
      }
    });

    it('should download small files quickly', async () => {
      const { result, executionTime } = await measureExecutionTime(async () => {
        return request(app.getHttpServer())
          .get(`/api/v1/files/${uploadedFileId}/download`)
          .set('Authorization', `Bearer ${config.validToken}`)
          .expect(200);
      });

      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.text).toBe('Download performance test');
    });

    it('should download large files efficiently', async () => {
      const { result, executionTime } = await measureExecutionTime(async () => {
        return request(app.getHttpServer())
          .get(`/api/v1/files/${largeFileId}/download`)
          .set('Authorization', `Bearer ${config.validToken}`)
          .expect(200);
      });

      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.body.length).toBe(5 * 1024 * 1024);
    });

    it('should handle multiple concurrent downloads efficiently', async () => {
      const downloadCount = 10;

      const { result, executionTime } = await measureExecutionTime(async () => {
        const downloadPromises = Array.from({ length: downloadCount }, () =>
          request(app.getHttpServer())
            .get(`/api/v1/files/${uploadedFileId}/download`)
            .set('Authorization', `Bearer ${config.validToken}`),
        );

        return Promise.all(downloadPromises);
      });

      expect(executionTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(result.length).toBe(downloadCount);

      result.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.text).toBe('Download performance test');
      });
    });
  });

  describe('List and Query Performance', () => {
    beforeEach(async () => {
      // Upload multiple files for testing
      const fileCount = 100;
      const testFiles = createTestFileArray(fileCount, 'list-perf');

      for (const file of testFiles) {
        await request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', createTestFile(file.content, file.name), file.name)
          .field('metadata', JSON.stringify(file.metadata))
          .expect(201);
      }
    });

    it('should list files efficiently', async () => {
      const { result, executionTime } = await measureExecutionTime(async () => {
        return request(app.getHttpServer())
          .get('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .expect(200);
      });

      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.body.files.length).toBeGreaterThanOrEqual(100);
      expect(result.body.total).toBeGreaterThanOrEqual(100);
    });

    it('should handle pagination efficiently', async () => {
      const { result, executionTime } = await measureExecutionTime(async () => {
        return request(app.getHttpServer())
          .get('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .query({ limit: 10, offset: 0 })
          .expect(200);
      });

      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.body.files.length).toBeLessThanOrEqual(10);
      expect(result.body.pagination.limit).toBe(10);
    });

    it('should filter files efficiently', async () => {
      const { result, executionTime } = await measureExecutionTime(async () => {
        return request(app.getHttpServer())
          .get('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .query({ mimeType: 'text/plain; charset=utf-8' })
          .expect(200);
      });

      expect(executionTime).toBeLessThan(1500); // Should complete within 1.5 seconds
      expect(result.body.files.length).toBeGreaterThanOrEqual(0);
    });

    it('should get statistics efficiently', async () => {
      const { result, executionTime } = await measureExecutionTime(async () => {
        return request(app.getHttpServer())
          .get('/api/v1/files/stats')
          .set('Authorization', `Bearer ${config.validToken}`)
          .expect(200);
      });

      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.body.stats.totalFiles).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Memory Usage', () => {
    it('should handle memory efficiently during bulk operations', async () => {
      const initialMemory = process.memoryUsage();

      // Upload many files
      const fileCount = 50;
      const testFiles = createTestFileArray(fileCount, 'memory-test');

      for (const file of testFiles) {
        await request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', createTestFile(file.content, file.name), file.name)
          .expect(201);
      }

      const afterUploadMemory = process.memoryUsage();
      const memoryIncrease = afterUploadMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB for 50 small files)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      // List all files
      await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      const afterListMemory = process.memoryUsage();
      const listMemoryIncrease = afterListMemory.heapUsed - afterUploadMemory.heapUsed;

      // Listing should not significantly increase memory usage
      expect(listMemoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large file uploads without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage();

      // Upload a large file
      const largeFile = createTestBinaryFile(20 * 1024 * 1024, 'memory-large.bin'); // 20MB
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', largeFile, 'memory-large.bin')
        .expect(201);

      const afterUploadMemory = process.memoryUsage();
      const memoryIncrease = afterUploadMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB for 20MB file)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // Download the file
      await request(app.getHttpServer())
        .get(`/api/v1/files/${response.body.file.id}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      const afterDownloadMemory = process.memoryUsage();
      const downloadMemoryIncrease = afterDownloadMemory.heapUsed - afterUploadMemory.heapUsed;

      // Download should not significantly increase memory usage
      expect(downloadMemoryIncrease).toBeLessThan(30 * 1024 * 1024);

      // Clean up
      await request(app.getHttpServer())
        .delete(`/api/v1/files/${response.body.file.id}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle mixed concurrent operations efficiently', async () => {
      const operationCount = 20;
      const operations: Promise<any>[] = [];

      // Mix of uploads, downloads, and list operations
      for (let i = 0; i < operationCount; i++) {
        if (i % 3 === 0) {
          // Upload operation
          operations.push(
            request(app.getHttpServer())
              .post('/api/v1/files')
              .set('Authorization', `Bearer ${config.validToken}`)
              .attach('file', createTestFile(`Concurrent operation ${i}`, `concurrent-${i}.txt`)),
          );
        } else if (i % 3 === 1) {
          // List operation
          operations.push(
            request(app.getHttpServer())
              .get('/api/v1/files')
              .set('Authorization', `Bearer ${config.validToken}`),
          );
        } else {
          // Stats operation
          operations.push(
            request(app.getHttpServer())
              .get('/api/v1/files/stats')
              .set('Authorization', `Bearer ${config.validToken}`),
          );
        }
      }

      const { result, executionTime } = await measureExecutionTime(async () => {
        return Promise.all(operations);
      });

      expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(result.length).toBe(operationCount);

      // All operations should succeed
      result.forEach((response) => {
        expect([200, 201]).toContain(response.status);
      });
    });

    it('should handle concurrent uploads and downloads efficiently', async () => {
      // First, upload some files
      const uploadCount = 10;
      const uploadPromises = Array.from({ length: uploadCount }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', createTestFile(`Upload ${i}`, `upload-${i}.txt`)),
      );

      const uploadResults = await Promise.all(uploadPromises);
      const fileIds = uploadResults.map((result) => result.body.file.id);

      // Then, perform concurrent downloads
      const downloadCount = 20;
      const { result, executionTime } = await measureExecutionTime(async () => {
        const downloadPromises = Array.from({ length: downloadCount }, (_, i) => {
          const fileId = fileIds[i % fileIds.length];
          return request(app.getHttpServer())
            .get(`/api/v1/files/${fileId}/download`)
            .set('Authorization', `Bearer ${config.validToken}`);
        });

        return Promise.all(downloadPromises);
      });

      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.length).toBe(downloadCount);

      result.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Clean up
      const deletePromises = fileIds.map((fileId) =>
        request(app.getHttpServer())
          .delete(`/api/v1/files/${fileId}`)
          .set('Authorization', `Bearer ${config.validToken}`),
      );
      await Promise.all(deletePromises);
    });
  });

  describe('Stress Testing', () => {
    it('should handle high load of small files', async () => {
      const fileCount = 200;
      const batchSize = 20;
      const batches = Math.ceil(fileCount / batchSize);

      const { executionTime } = await measureExecutionTime(async () => {
        for (let batch = 0; batch < batches; batch++) {
          const batchPromises = [];
          const startIndex = batch * batchSize;
          const endIndex = Math.min(startIndex + batchSize, fileCount);

          for (let i = startIndex; i < endIndex; i++) {
            batchPromises.push(
              request(app.getHttpServer())
                .post('/api/v1/files')
                .set('Authorization', `Bearer ${config.validToken}`)
                .attach('file', createTestFile(`Stress test ${i}`, `stress-${i}.txt`)),
            );
          }

          await Promise.all(batchPromises);
        }
      });

      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Verify all files were uploaded
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(listResponse.body.total).toBeGreaterThanOrEqual(fileCount);
    });

    it('should handle rapid sequential operations', async () => {
      const operationCount = 50;
      const operations: Promise<any>[] = [];

      // Create a chain of operations: upload -> get info -> download -> delete
      for (let i = 0; i < operationCount; i++) {
        const fileContent = `Rapid operation ${i}`;
        const fileName = `rapid-${i}.txt`;

        // Upload
        const uploadPromise = request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', createTestFile(fileContent, fileName));

        operations.push(
          uploadPromise.then(async (uploadResult) => {
            const fileId = uploadResult.body.file.id;

            // Get info
            await request(app.getHttpServer())
              .get(`/api/v1/files/${fileId}`)
              .set('Authorization', `Bearer ${config.validToken}`)
              .expect(200);

            // Download
            await request(app.getHttpServer())
              .get(`/api/v1/files/${fileId}/download`)
              .set('Authorization', `Bearer ${config.validToken}`)
              .expect(200);

            // Delete
            await request(app.getHttpServer())
              .delete(`/api/v1/files/${fileId}`)
              .set('Authorization', `Bearer ${config.validToken}`)
              .expect(200);

            return uploadResult;
          }),
        );
      }

      const { result, executionTime } = await measureExecutionTime(async () => {
        return Promise.all(operations);
      });

      expect(executionTime).toBeLessThan(20000); // Should complete within 20 seconds
      expect(result.length).toBe(operationCount);

      result.forEach((response) => {
        expect(response.status).toBe(201);
      });
    });
  });
});
