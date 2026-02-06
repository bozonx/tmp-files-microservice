import { Test, type TestingModule } from '@nestjs/testing'
import { jest, describe, beforeEach, it, expect } from '@jest/globals'
import { PayloadTooLargeException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FilesService } from '@/modules/files/files.service'
import { StorageService } from '@/modules/storage/storage.service'
import { Readable } from 'stream'

describe('FilesService', () => {
  let service: FilesService
  let storage: jest.Mocked<StorageService>

  beforeEach(async () => {
    storage = {
      saveFile: jest.fn(),
      getFileInfo: jest.fn(),
      readFile: jest.fn(),
      deleteFile: jest.fn(),
      searchFiles: jest.fn(),
      getFileStats: jest.fn(),
      getStorageHealth: jest.fn(),
      getConfigForTesting: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: StorageService, useValue: storage },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: any) => {
              const cfg: Record<string, any> = {
                app: { basePath: '' },
                storage: { maxTtl: 3600, maxFileSize: 1024, allowedMimeTypes: [] },
              }
              return key in cfg ? cfg[key] : def
            },
          },
        },
      ],
    }).compile()

    service = module.get(FilesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('getFileStats delegates to storage and returns generatedAt', async () => {
    storage.getFileStats.mockResolvedValue({
      totalFiles: 0,
      totalSize: 0,
      filesByMimeType: {},
      filesByDate: {},
    })
    const res = await service.getFileStats()
    expect(res.stats.totalFiles).toBe(0)
    expect(typeof res.generatedAt).toBe('string')
  })

  it('uploadFile throws 413 when file exceeds max size', async () => {
    await expect(
      service.uploadFile({
        file: {
          originalname: 'big.bin',
          mimetype: 'application/octet-stream',
          size: 2048, // > 1024 configured above
          stream: Readable.from(Buffer.alloc(2048)),
        },
        ttl: 60,
      })
    ).rejects.toBeInstanceOf(PayloadTooLargeException)
  })

  it('uploadFile returns downloadPath and full downloadUrl', async () => {
    const fileId = 'test-id'
    storage.saveFile.mockResolvedValue({
      success: true,
      data: {
        id: fileId,
        originalName: 'test.txt',
        mimeType: 'text/plain',
        size: 10,
        uploadedAt: new Date(),
        ttl: 3600,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        hash: 'abc',
      } as any,
    })

    const res = await service.uploadFile({
      file: {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 10,
        stream: Readable.from(Buffer.from('hello')),
      },
      ttl: 3600,
    })

    expect(res.downloadPath).toBe('/api/v1/download/test-id')
    expect(res.downloadUrl).toBe('/api/v1/download/test-id') // base path is empty in mock
  })

  it('getFileInfo returns downloadPath and full downloadUrl with base URL', async () => {
    // Override ConfigService for this test
    const module = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: StorageService, useValue: storage },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'app') return { basePath: '', downloadBaseUrl: 'https://cdn.example.com' }
              if (key === 'storage')
                return { maxTtl: 3600, maxFileSize: 1024, allowedMimeTypes: [] }
            },
          },
        },
      ],
    }).compile()
    const testService = module.get(FilesService)

    storage.getFileInfo.mockResolvedValue({
      success: true,
      data: {
        id: 'test-id',
        originalName: 'test.txt',
        mimeType: 'text/plain',
        size: 10,
        uploadedAt: new Date(),
        ttl: 3600,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        hash: 'abc',
      } as any,
    })

    const res = await testService.getFileInfo({ fileId: 'test-id' })

    expect(res.downloadPath).toBe('/api/v1/download/test-id')
    expect(res.downloadUrl).toBe('https://cdn.example.com/api/v1/download/test-id')
  })
})
