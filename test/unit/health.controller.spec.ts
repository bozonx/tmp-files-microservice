import { createApp, createDefaultLogger } from '@/app.js'
import { jest } from '@jest/globals'
import { loadAppEnv } from '@/config/env.js'
import type { FileStorageAdapter } from '@/adapters/file-storage.adapter.js'
import type { MetadataAdapter } from '@/adapters/metadata.adapter.js'
import { createFilesRoutesWorkers } from '@/routes/files.route.workers.js'
import { NullDnsResolver } from '@/common/interfaces/dns-resolver.interface.js'

describe('Health route (unit)', () => {
  it('GET /api/v1/health returns ok', async () => {
    const env = loadAppEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })
    const logger = createDefaultLogger(env)

    const storage: FileStorageAdapter = {
      saveFile: jest.fn() as any,
      readFile: jest.fn() as any,
      createReadStream: jest.fn() as any,
      deleteFile: jest.fn() as any,
      listAllKeys: jest.fn() as any,
      isHealthy: jest.fn(async () => true),
    }

    const metadata: MetadataAdapter = {
      initialize: jest.fn(async () => undefined),
      saveFileInfo: jest.fn(async () => undefined),
      getFileInfo: jest.fn(async () => null),
      deleteFileInfo: jest.fn(async () => undefined),
      findFileByHash: jest.fn(async () => null),
      searchFiles: jest.fn(async () => ({ files: [], total: 0, params: {} })),
      getStats: jest.fn(async () => ({
        totalFiles: 0,
        totalSize: 0,
        filesByMimeType: {},
        filesByDate: {},
      })),
      getAllFileIds: jest.fn(async () => []),
      isHealthy: jest.fn(async () => true),
    }

    const app = createApp(
      { env, storage, metadata, logger, dnsResolver: new NullDnsResolver() },
      {
        createFilesRoutes: () => createFilesRoutesWorkers(),
      }
    )
    const res = await app.request('/api/v1/health')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'ok' })
  })
})
