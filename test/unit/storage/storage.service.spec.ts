import { Test, type TestingModule } from '@nestjs/testing'
import { jest, describe, beforeAll, afterAll, it, expect } from '@jest/globals'
import { ConfigService } from '@nestjs/config'
import { StorageService } from '@/modules/storage/storage.service'
import { METADATA_PROVIDER } from '@/modules/storage/metadata.provider'
import fs from 'fs-extra'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { FileInfo } from '@/common/interfaces/file.interface'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('StorageService (basic)', () => {
  let service: StorageService
  let testStoragePath: string

  beforeAll(async () => {
    testStoragePath = path.join(__dirname, '..', '..', '.tmp-storage')
    await fs.ensureDir(testStoragePath)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: METADATA_PROVIDER,
          useValue: {
            initialize: jest.fn().mockResolvedValue(undefined),
            getStats: jest.fn().mockResolvedValue({
              totalFiles: 0,
              totalSize: 0,
              filesByMimeType: {},
              filesByDate: {},
            }),
            getFileInfo: jest.fn(),
            saveFileInfo: jest.fn(),
            deleteFileInfo: jest.fn(),
            searchFiles: jest.fn(),
            findFileByHash: jest.fn(),
            getAllFileIds: jest.fn().mockResolvedValue([]),
            isHealthy: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: any) => {
              if (key === 'storage') {
                return {
                  basePath: testStoragePath,
                  maxFileSize: 1 * 1024 * 1024,
                  allowedMimeTypes: [],
                  enableDeduplication: true,
                  maxTtl: 3600,
                }
              }
              const legacyEnvLike: Record<string, any> = {
                STORAGE_DIR: testStoragePath,
                MAX_FILE_SIZE_MB: 1,
                ALLOWED_MIME_TYPES: [],
                ENABLE_DEDUPLICATION: true,
              }
              return key in legacyEnvLike ? legacyEnvLike[key] : def
            },
          },
        },
      ],
    }).compile()

    service = module.get(StorageService)
  })

  afterAll(async () => {
    if (await fs.pathExists(testStoragePath)) {
      await fs.remove(testStoragePath)
    }
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should initialize storage and return empty stats', async () => {
    const stats = await service.getFileStats()
    expect(stats.totalFiles).toBeDefined()
    expect(stats.totalSize).toBeDefined()
  })
})
