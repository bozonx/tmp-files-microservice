/**
 * Интеграционные E2E тесты
 * Тестирует сложные сценарии использования и интеграцию между модулями
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, cleanupTestApp, clearTestStorage } from './e2e-test-utils';

describe('Integration Tests (e2e)', () => {
  let app: INestApplication;
  let config: any;

  beforeAll(async () => {
    const testApp = await createTestApp('integration');
    app = testApp.app;
    config = testApp.config;
  });

  afterAll(async () => {
    await cleanupTestApp(app, config.testStoragePath);
  });

  beforeEach(async () => {
    await clearTestStorage(config.testStoragePath);
  });

  describe('File Lifecycle Management', () => {
    it('should handle complete file lifecycle: upload -> info -> download -> delete', async () => {
      const fileContent = 'Complete lifecycle test content';
      const fileName = 'lifecycle-test.txt';
      const metadata = { description: 'Lifecycle test file', category: 'integration' };

      // 1. Upload file
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from(fileContent), fileName)
        .field('metadata', JSON.stringify(metadata))
        .field('ttl', '7200') // 2 hours
        .expect(201);

      const fileId = uploadResponse.body.file.id;
      expect(uploadResponse.body.file.originalName).toBe(fileName);
      expect(uploadResponse.body.file.metadata).toEqual(metadata);
      expect(uploadResponse.body.file.ttl).toBe(7200);

      // 2. Get file info
      const infoResponse = await request(app.getHttpServer())
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(infoResponse.body.file.id).toBe(fileId);
      expect(infoResponse.body.file.originalName).toBe(fileName);
      expect(infoResponse.body.file.size).toBe(fileContent.length);
      expect(infoResponse.body.file.isExpired).toBe(false);

      // 3. Download file
      const downloadResponse = await request(app.getHttpServer())
        .get(`/api/v1/files/${fileId}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(downloadResponse.text).toBe(fileContent);
      expect(downloadResponse.headers['content-type']).toBe('text/plain');

      // 4. Check file exists
      const existsResponse = await request(app.getHttpServer())
        .get(`/api/v1/files/${fileId}/exists`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(existsResponse.body.exists).toBe(true);
      expect(existsResponse.body.fileId).toBe(fileId);

      // 5. Delete file
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(deleteResponse.body.fileId).toBe(fileId);
      expect(deleteResponse.body.message).toBe('File deleted successfully');

      // 6. Verify file is deleted
      await request(app.getHttpServer())
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/v1/files/${fileId}/exists`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.exists).toBe(false);
        });
    });

    it('should handle file deduplication correctly', async () => {
      const content = 'Duplicate content for deduplication test';

      // Upload first file
      const response1 = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from(content), 'file1.txt')
        .field('allowDuplicate', 'true')
        .expect(201);

      const fileId1 = response1.body.file.id;
      const hash1 = response1.body.file.hash;

      // Upload second file with same content
      const response2 = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', Buffer.from(content), 'file2.txt')
        .field('allowDuplicate', 'true')
        .expect(201);

      const fileId2 = response2.body.file.id;
      const hash2 = response2.body.file.hash;

      // Files should have different IDs but same hash
      expect(fileId1).not.toBe(fileId2);
      expect(hash1).toBe(hash2);

      // Both files should be downloadable
      const download1 = await request(app.getHttpServer())
        .get(`/api/v1/files/${fileId1}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      const download2 = await request(app.getHttpServer())
        .get(`/api/v1/files/${fileId2}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(download1.text).toBe(content);
      expect(download2.text).toBe(content);

      // Delete one file, the other should still exist
      await request(app.getHttpServer())
        .delete(`/api/v1/files/${fileId1}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      // Second file should still be accessible
      await request(app.getHttpServer())
        .get(`/api/v1/files/${fileId2}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle multiple file uploads and list them correctly', async () => {
      const files = [
        { content: 'Bulk test file 1', name: 'bulk1.txt', metadata: { category: 'bulk' } },
        { content: 'Bulk test file 2', name: 'bulk2.txt', metadata: { category: 'bulk' } },
        { content: 'Bulk test file 3', name: 'bulk3.txt', metadata: { category: 'bulk' } },
        { content: 'Bulk test file 4', name: 'bulk4.txt', metadata: { category: 'bulk' } },
        { content: 'Bulk test file 5', name: 'bulk5.txt', metadata: { category: 'bulk' } },
      ];

      const uploadedFiles: string[] = [];

      // Upload all files
      for (const file of files) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', Buffer.from(file.content), file.name)
          .field('metadata', JSON.stringify(file.metadata))
          .expect(201);

        uploadedFiles.push(response.body.file.id);
        expect(response.body.file.originalName).toBe(file.name);
      }

      // List all files
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(listResponse.body.files.length).toBeGreaterThanOrEqual(files.length);
      expect(listResponse.body.total).toBeGreaterThanOrEqual(files.length);

      // Test pagination
      const paginatedResponse = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .query({ limit: 3, offset: 0 })
        .expect(200);

      expect(paginatedResponse.body.files.length).toBeLessThanOrEqual(3);
      expect(paginatedResponse.body.pagination.limit).toBe(3);

      // Get statistics
      const statsResponse = await request(app.getHttpServer())
        .get('/api/v1/files/stats')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(statsResponse.body.stats.totalFiles).toBeGreaterThanOrEqual(files.length);
      expect(statsResponse.body.stats.totalSize).toBeGreaterThan(0);

      // Delete all files
      for (const fileId of uploadedFiles) {
        await request(app.getHttpServer())
          .delete(`/api/v1/files/${fileId}`)
          .set('Authorization', `Bearer ${config.validToken}`)
          .expect(200);
      }

      // Verify all files are deleted
      const finalListResponse = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(finalListResponse.body.total).toBe(0);
    });

    it('should handle concurrent file operations', async () => {
      const concurrentOperations = Array.from({ length: 10 }, (_, i) => ({
        content: `Concurrent test file ${i}`,
        name: `concurrent-${i}.txt`,
      }));

      // Concurrent uploads
      const uploadPromises = concurrentOperations.map((file) =>
        request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', Buffer.from(file.content), file.name),
      );

      const uploadResults = await Promise.all(uploadPromises);

      // All uploads should succeed
      uploadResults.forEach((result, index) => {
        expect(result.status).toBe(201);
        expect(result.body.file.originalName).toBe(`concurrent-${index}.txt`);
      });

      // Get list of uploaded files
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(listResponse.body.files.length).toBeGreaterThanOrEqual(concurrentOperations.length);

      // Concurrent downloads
      const downloadPromises = uploadResults.map((result) =>
        request(app.getHttpServer())
          .get(`/api/v1/files/${result.body.file.id}/download`)
          .set('Authorization', `Bearer ${config.validToken}`),
      );

      const downloadResults = await Promise.all(downloadPromises);

      // All downloads should succeed
      downloadResults.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.text).toBe(`Concurrent test file ${index}`);
      });

      // Concurrent deletions
      const deletePromises = uploadResults.map((result) =>
        request(app.getHttpServer())
          .delete(`/api/v1/files/${result.body.file.id}`)
          .set('Authorization', `Bearer ${config.validToken}`),
      );

      const deleteResults = await Promise.all(deletePromises);

      // All deletions should succeed
      deleteResults.forEach((result) => {
        expect(result.status).toBe(200);
        expect(result.body.message).toBe('File deleted successfully');
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle invalid operations gracefully', async () => {
      const invalidId = 'invalid-file-id-format';

      // Try to get info for invalid ID
      await request(app.getHttpServer())
        .get(`/api/v1/files/${invalidId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(400);

      // Try to download invalid ID
      await request(app.getHttpServer())
        .get(`/api/v1/files/${invalidId}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(400);

      // Try to delete invalid ID
      await request(app.getHttpServer())
        .delete(`/api/v1/files/${invalidId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(400);

      // Try to check existence of invalid ID
      await request(app.getHttpServer())
        .get(`/api/v1/files/${invalidId}/exists`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(400);
    });

    it('should handle non-existent file operations', async () => {
      const nonExistentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      // Try to get info for non-existent file
      await request(app.getHttpServer())
        .get(`/api/v1/files/${nonExistentId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(404);

      // Try to download non-existent file
      await request(app.getHttpServer())
        .get(`/api/v1/files/${nonExistentId}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(404);

      // Try to delete non-existent file
      await request(app.getHttpServer())
        .delete(`/api/v1/files/${nonExistentId}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(404);

      // Check existence should return false
      const existsResponse = await request(app.getHttpServer())
        .get(`/api/v1/files/${nonExistentId}/exists`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(existsResponse.body.exists).toBe(false);
    });

    it('should handle authentication errors consistently', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/files' },
        { method: 'post', path: '/api/v1/files' },
        { method: 'get', path: '/api/v1/files/stats' },
      ];

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())
          [endpoint.method as keyof typeof request](endpoint.path)
          .expect(401);
      }
    });
  });

  describe('File Type and Content Handling', () => {
    it('should handle different file types correctly', async () => {
      const testFiles = [
        {
          content: 'Plain text content',
          name: 'test.txt',
          expectedMime: 'text/plain',
        },
        { content: '{"json": "content"}', name: 'test.json', expectedMime: 'application/json' },
        {
          content: '<html><body>HTML content</body></html>',
          name: 'test.html',
          expectedMime: 'text/html',
        },
        {
          content: 'CSS content { color: red; }',
          name: 'test.css',
          expectedMime: 'text/css',
        },
        { content: 'JavaScript content', name: 'test.js', expectedMime: 'application/javascript' },
      ];

      for (const testFile of testFiles) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', Buffer.from(testFile.content), testFile.name)
          .expect(201);

        expect(response.body.file.originalName).toBe(testFile.name);
        expect(response.body.file.mimeType).toBe(testFile.expectedMime);
        expect(response.body.file.size).toBe(testFile.content.length);

        // Download and verify content
        const downloadResponse = await request(app.getHttpServer())
          .get(`/api/v1/files/${response.body.file.id}/download`)
          .set('Authorization', `Bearer ${config.validToken}`)
          .expect(200);

        expect(downloadResponse.text).toBe(testFile.content);
        expect(downloadResponse.headers['content-type']).toBe(testFile.expectedMime);
      }
    });

    it('should handle binary files correctly', async () => {
      // Create a simple binary file (PNG header)
      const pngHeader = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d,
        0x49,
        0x48,
        0x44,
        0x52, // IHDR chunk
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x01, // 1x1 pixel
        0x08,
        0x02,
        0x00,
        0x00,
        0x00,
        0x90,
        0x77,
        0x53,
        0xde,
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', pngHeader, 'test.png')
        .expect(201);

      expect(response.body.file.originalName).toBe('test.png');
      expect(response.body.file.size).toBe(pngHeader.length);

      // Download and verify binary content
      const downloadResponse = await request(app.getHttpServer())
        .get(`/api/v1/files/${response.body.file.id}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      expect(Buffer.from(downloadResponse.body)).toEqual(pngHeader);
    });
  });

  describe('Performance and Limits', () => {
    it('should handle large number of files efficiently', async () => {
      const fileCount = 50;
      const files: string[] = [];

      // Upload many files
      for (let i = 0; i < fileCount; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/files')
          .set('Authorization', `Bearer ${config.validToken}`)
          .attach('file', Buffer.from(`Performance test file ${i}`), `perf-${i}.txt`)
          .expect(201);

        files.push(response.body.file.id);
      }

      // List all files should be fast
      const startTime = Date.now();
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      const listTime = Date.now() - startTime;
      expect(listTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(listResponse.body.files.length).toBeGreaterThanOrEqual(fileCount);

      // Get statistics should be fast
      const statsStartTime = Date.now();
      const statsResponse = await request(app.getHttpServer())
        .get('/api/v1/files/stats')
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      const statsTime = Date.now() - statsStartTime;
      expect(statsTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(statsResponse.body.stats.totalFiles).toBeGreaterThanOrEqual(fileCount);

      // Clean up
      for (const fileId of files) {
        await request(app.getHttpServer())
          .delete(`/api/v1/files/${fileId}`)
          .set('Authorization', `Bearer ${config.validToken}`)
          .expect(200);
      }
    });

    it('should handle large files efficiently', async () => {
      // Create a 5MB file
      const largeContent = Buffer.alloc(5 * 1024 * 1024, 'A');

      const uploadStartTime = Date.now();
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${config.validToken}`)
        .attach('file', largeContent, 'large-file.txt')
        .expect(201);

      const uploadTime = Date.now() - uploadStartTime;
      expect(uploadTime).toBeLessThan(30000); // Should upload within 30 seconds
      expect(response.body.file.size).toBe(5 * 1024 * 1024);

      // Download should be fast
      const downloadStartTime = Date.now();
      const downloadResponse = await request(app.getHttpServer())
        .get(`/api/v1/files/${response.body.file.id}/download`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);

      const downloadTime = Date.now() - downloadStartTime;
      expect(downloadTime).toBeLessThan(10000); // Should download within 10 seconds
      expect(downloadResponse.body.length).toBe(5 * 1024 * 1024);

      // Clean up
      await request(app.getHttpServer())
        .delete(`/api/v1/files/${response.body.file.id}`)
        .set('Authorization', `Bearer ${config.validToken}`)
        .expect(200);
    });
  });
});
