import { jest } from '@jest/globals'
import { loadAppEnv } from '@/config/env.js'
import type { FileStorageAdapter } from '@/adapters/file-storage.adapter.js'
import type { MetadataAdapter } from '@/adapters/metadata.adapter.js'
import { StorageService } from '@/services/storage.service.js'
import { createMockEnvSource, createMockLogger } from '@/../test/helpers/mocks.js'

describe('StorageService (basic)', () => {
  let service: StorageService

  let metadata: jest.Mocked<MetadataAdapter>
  let fileStorage: jest.Mocked<FileStorageAdapter>

  beforeEach(() => {
    metadata = {
      initialize: jest.fn().mockResolvedValue(undefined),
      saveFileInfo: jest.fn().mockResolvedValue(undefined),
      getFileInfo: jest.fn().mockResolvedValue(null),
      deleteFileInfo: jest.fn().mockResolvedValue(undefined),
      findFileByHash: jest.fn().mockResolvedValue(null),
      searchFiles: jest.fn() as any,
      getStats: jest.fn().mockResolvedValue({
        totalFiles: 0,
        totalSize: 0,
        filesByMimeType: {},
        filesByDate: {},
      }),
      getAllFileIds: jest.fn().mockResolvedValue([]),
      isHealthy: jest.fn().mockResolvedValue(true),
    }

    fileStorage = {
      saveFile: jest.fn() as any,
      readFile: jest.fn() as any,
      createReadStream: jest.fn() as any,
      deleteFile: jest.fn() as any,
      listAllKeys: jest.fn().mockResolvedValue([]),
      isHealthy: jest.fn().mockResolvedValue(true),
    }

    const env = loadAppEnv(
      createMockEnvSource({
        MAX_FILE_SIZE_MB: '1',
        ENABLE_DEDUPLICATION: 'true',
      })
    )

    service = new StorageService({
      env,
      fileStorage,
      metadata,
      logger: createMockLogger(),
    })
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should initialize storage and return empty stats', async () => {
    const stats = await service.getFileStats()
    expect(stats.totalFiles).toBeDefined()
    expect(stats.totalSize).toBeDefined()
    expect(metadata.initialize).toHaveBeenCalledTimes(1)
    expect(metadata.getStats).toHaveBeenCalledTimes(1)
  })
})
