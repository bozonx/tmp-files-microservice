import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory';
import { withEnvVars } from './env-helper';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';

describe('Files (e2e)', () => {
  let app: NestFastifyApplication;
  let tmpDir: string;
  let cleanupEnv: () => void;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), 'tmp-files-e2e', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await fs.ensureDir(tmpDir);
    cleanupEnv = withEnvVars({ STORAGE_DIR: tmpDir });
    app = await createTestApp();
  });

  it('POST /api/v1/files (multipart) - honors provided ttlMins (e.g., 5)', async () => {
    const boundary = '----CascadeBoundary5';
    const parts: Buffer[] = [];
    const push = (s: string | Buffer) => parts.push(Buffer.isBuffer(s) ? s : Buffer.from(s));
    push(`--${boundary}\r\n`);
    push('Content-Disposition: form-data; name="ttlMins"\r\n\r\n');
    push('5\r\n');
    push(`--${boundary}\r\n`);
    push('Content-Disposition: form-data; name="file"; filename="a.txt"\r\n');
    push('Content-Type: text/plain\r\n\r\n');
    push('hello');
    push(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat(parts);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/files`,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data?.file?.ttlMins).toBe(5);
  });

  it('POST /api/v1/files (multipart) - ttlMins=0 is treated as present and coerced to minimum 1', async () => {
    const boundary = '----CascadeBoundary0';
    const parts: Buffer[] = [];
    const push = (s: string | Buffer) => parts.push(Buffer.isBuffer(s) ? s : Buffer.from(s));
    push(`--${boundary}\r\n`);
    push('Content-Disposition: form-data; name="ttlMins"\r\n\r\n');
    push('0\r\n');
    push(`--${boundary}\r\n`);
    push('Content-Disposition: form-data; name="file"; filename="a.txt"\r\n');
    push('Content-Type: text/plain\r\n\r\n');
    push('hello');
    push(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat(parts);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/files`,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data?.file?.ttlMins).toBe(1);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (cleanupEnv) cleanupEnv();
    if (await fs.pathExists(tmpDir)) await fs.remove(tmpDir);
  });

  it('POST /api/v1/files/url - honors provided ttlMins (e.g., 5)', async () => {
    const server = http.createServer((req, res) => {
      if (req.url === '/file.bin') {
        const data = Buffer.from('hello');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', data.length);
        res.end(data);
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const fileUrl = `http://127.0.0.1:${port}/file.bin`;

    try {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/files/url`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ url: fileUrl, ttlMins: 5 }),
      });
      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data?.file?.ttlMins).toBe(5);
    } finally {
      server.close();
    }
  });

  it('POST /api/v1/files/url - ttlMins=0 is treated as present and coerced to minimum 1', async () => {
    const server = http.createServer((req, res) => {
      if (req.url === '/file.bin') {
        const data = Buffer.from('hello');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', data.length);
        res.end(data);
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const fileUrl = `http://127.0.0.1:${port}/file.bin`;

    try {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/files/url`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ url: fileUrl, ttlMins: 0 }),
      });
      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data?.file?.ttlMins).toBe(1);
    } finally {
      server.close();
    }
  });

  it('GET /api/v1/files - lists files', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/files` });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('files');
    expect(Array.isArray(data.files)).toBe(true);
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('pagination');
  });

  it('GET /api/v1/files/stats - returns stats', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/files/stats` });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('generatedAt');
  });

  it('GET /api/v1/files/:id - returns 404 for non-existing file', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/files/non-existing-id` });
    expect([404, 400]).toContain(res.statusCode);
  });

  it('GET /api/v1/files/:id/exists - returns exists=false for non-existing', async () => {
    const id = 'non-existing-id';
    const res = await app.inject({ method: 'GET', url: `/api/v1/files/${id}/exists` });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('exists', false);
    expect(data).toHaveProperty('fileId', id);
    expect(data).toHaveProperty('isExpired');
    expect(typeof data.isExpired).toBe('boolean');
  });

  it('GET /api/v1/files/:id/exists - returns 400 for invalid id', async () => {
    const badId = 'bad id!';
    const res = await app.inject({ method: 'GET', url: `/api/v1/files/${badId}/exists` });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /api/v1/files/:id - returns 404 for non-existing file', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/files/non-existing-id` });
    expect([404, 400]).toContain(res.statusCode);
  });

  it('POST /api/v1/files/url - uploads file by URL', async () => {
    // Start a tiny local HTTP server to serve a small payload
    const server = http.createServer((req, res) => {
      if (req.url === '/file.bin') {
        const data = Buffer.from('hello');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', data.length);
        res.end(data);
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const fileUrl = `http://127.0.0.1:${port}/file.bin`;

    try {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/files/url`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ url: fileUrl, ttlMins: 1440, metadata: '{"source":"e2e"}' }),
      });
      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty('file');
      expect(data.file).toHaveProperty('id');
      expect(data).toHaveProperty('downloadUrl');
      expect(data).toHaveProperty('infoUrl');
      expect(data).toHaveProperty('deleteUrl');

      // Verify the download endpoint responds and returns the expected content
      const downloadRes = await app.inject({ method: 'GET', url: data.downloadUrl });
      expect(downloadRes.statusCode).toBe(200);
      expect(downloadRes.body).toBe('hello');
    } finally {
      server.close();
    }
  });

  it('POST /api/v1/files/url - returns 400 when url is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/files/url`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ ttlMins: 1440 }),
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/files/url - returns 400 when metadata is invalid JSON string', async () => {
    const server = http.createServer((req, res) => {
      if (req.url === '/file.bin') {
        const data = Buffer.from('hello');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', data.length);
        res.end(data);
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const fileUrl = `http://127.0.0.1:${port}/file.bin`;

    try {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/files/url`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ url: fileUrl, ttlMins: 1440, metadata: 'not json' }),
      });
      expect(res.statusCode).toBe(400);
    } finally {
      server.close();
    }
  });
});
