import { jest } from '@jest/globals'
import { loadAppEnv } from '@/config/env.js'
import { FilesService } from '@/services/files.service.js'
import type { StorageService } from '@/services/storage.service.js'
import { createMockEnvSource, createMockLogger } from '@/../test/helpers/mocks.js'

describe('FilesService', () => {
  let service: FilesService
  let storage: jest.Mocked<StorageService>

  beforeEach(() => {
    storage = {
      saveFile: jest.fn(),
      getFileInfo: jest.fn(),
      readFile: jest.fn(),
      deleteFile: jest.fn(),
      searchFiles: jest.fn(),
      getFileStats: jest.fn(),
      getStorageHealth: jest.fn(),
    } as any

    const env = loadAppEnv(
      createMockEnvSource({
        MAX_FILE_SIZE_MB: '1',
        ALLOWED_MIME_TYPES: '',
        BASE_PATH: '',
        DOWNLOAD_BASE_URL: '',
      })
    )

    service = new FilesService({
      env,
      storage,
      logger: createMockLogger(),
    })
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
    expect((res.stats as any).totalFiles).toBe(0)
    expect(typeof res.generatedAt).toBe('string')
  })

  it('uploadFile throws 413 when file exceeds max size', async () => {
    await expect(
      service.uploadFile({
        file: {
          originalname: 'big.bin',
          mimetype: 'application/octet-stream',
          size: 2 * 1024 * 1024, // 2MB > 1MB configured above
          stream: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array([1, 2, 3]))
              controller.close()
            },
          }),
        },
        ttl: 60,
      })
    ).rejects.toMatchObject({ status: 413 })
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
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([104, 101, 108, 108, 111]))
            controller.close()
          },
        }),
      },
      ttl: 3600,
    })

    expect(res.downloadPath).toBe('/api/v1/download/test-id')
    expect(res.downloadUrl).toBe('/api/v1/download/test-id') // base path is empty in mock
  })

  it('getFileInfo returns downloadPath and full downloadUrl with base URL', async () => {
    const env = loadAppEnv(
      createMockEnvSource({
        BASE_PATH: '',
        DOWNLOAD_BASE_URL: 'https://cdn.example.com',
      })
    )
    const testService = new FilesService({
      env,
      storage,
      logger: createMockLogger(),
    })

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
