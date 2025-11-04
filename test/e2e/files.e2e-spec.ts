import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory';
import { withEnvVars } from './env-helper';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

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

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (cleanupEnv) cleanupEnv();
    if (await fs.pathExists(tmpDir)) await fs.remove(tmpDir);
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
});
