import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Readable } from 'stream'
import { jest } from '@jest/globals'
import { createTestApp } from './test-app.factory'
import { CleanupService } from '@/modules/cleanup/cleanup.service'
import { StorageService } from '@/modules/storage/storage.service'
import { APP_CLOSE_TIMEOUT_MS } from '@/common/constants/app.constants'
import { withEnvVars } from './env-helper'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'

describe('Graceful Shutdown (e2e)', () => {
  let app: NestFastifyApplication
  let cleanupService: CleanupService
  let storageService: StorageService
  let tmpDir: string
  let cleanupEnv: () => void

  beforeEach(async () => {
    tmpDir = path.join(
      os.tmpdir(),
      'tmp-files-shutdown-e2e',
      `${Date.now()}-${Math.random().toString(16).slice(2)}`
    )
    await fs.ensureDir(tmpDir)
    cleanupEnv = withEnvVars({ STORAGE_DIR: tmpDir })
    app = await createTestApp()

    cleanupService = app.get(CleanupService)
    storageService = app.get(StorageService)
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
    if (cleanupEnv) cleanupEnv()
    if (await fs.pathExists(tmpDir)) await fs.remove(tmpDir)
  })

  describe('CleanupService shutdown behavior', () => {
    it('should prevent new cleanup tasks when shutting down', async () => {
      cleanupService.markAsShuttingDown()

      // Create some expired files
      await storageService.saveFile({
        file: {
          stream: Readable.from(Buffer.from('test')),
          originalname: 'test.txt',
          mimetype: 'text/plain',
          size: 4,
        },
        ttl: -1, // Already expired
      })

      const searchSpy = jest.spyOn(storageService, 'searchFiles')

      // Try to run cleanup
      await cleanupService.handleScheduledCleanup()

      // Should not search for files
      expect(searchSpy).not.toHaveBeenCalled()
    })

    it('should wait for active cleanup to complete during shutdown', async () => {
      // Create some expired files
      const file1Result = await storageService.saveFile({
        file: {
          stream: Readable.from(Buffer.from('test1')),
          originalname: 'test1.txt',
          mimetype: 'text/plain',
          size: 5,
        },
        ttl: -1, // Already expired
      })

      const file2Result = await storageService.saveFile({
        file: {
          stream: Readable.from(Buffer.from('test2')),
          originalname: 'test2.txt',
          mimetype: 'text/plain',
          size: 5,
        },
        ttl: -1, // Already expired
      })

      expect(file1Result.success).toBe(true)
      expect(file2Result.success).toBe(true)

      const file1Id = file1Result.data!.id
      const file2Id = file2Result.data!.id

      // Start cleanup (don't await)
      const cleanupPromise = cleanupService.handleScheduledCleanup()

      // Give cleanup a moment to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Mark as shutting down while cleanup is running
      cleanupService.markAsShuttingDown()

      // Wait for cleanup to complete
      await cleanupPromise

      // Verify files were processed before shutdown
      const file1Info = await storageService.getFileInfo(file1Id)
      const file2Info = await storageService.getFileInfo(file2Id)

      // Files should be deleted
      expect(file1Info.success).toBe(false)
      expect(file2Info.success).toBe(false)
    })

    it('should log warning when cleanup is already in progress', async () => {
      // Create a long-running cleanup by mocking searchFiles
      const originalSearchFiles = storageService.searchFiles.bind(storageService)
      const searchSpy = jest
        .spyOn(storageService, 'searchFiles')
        .mockImplementation(async (params) => {
          await new Promise((resolve) => setTimeout(resolve, 500))
          return originalSearchFiles(params)
        })

      // Start first cleanup (don't await)
      const cleanup1 = cleanupService.handleScheduledCleanup()

      // Give it time to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Try to start second cleanup
      const loggerSpy = jest.spyOn(cleanupService['logger'], 'warn')
      await cleanupService.handleScheduledCleanup()

      // Should log warning
      expect(loggerSpy).toHaveBeenCalledWith(
        'Cleanup already in progress, skipping concurrent execution'
      )

      // Wait for first cleanup to finish
      await cleanup1

      searchSpy.mockRestore()
    })

    it('should interrupt cleanup loop when shutdown is triggered', async () => {
      // Create multiple expired files
      const fileResults = await Promise.all(
        Array.from({ length: 10 }, async (_, i) => {
          return storageService.saveFile({
            file: {
              stream: Readable.from(Buffer.from(`test${i}`)),
              originalname: `test${i}.txt`,
              mimetype: 'text/plain',
              size: 5,
            },
            ttl: -1, // Already expired
          })
        })
      )

      // Verify all files were created
      fileResults.forEach((result) => {
        expect(result.success).toBe(true)
      })

      // Mock deleteFile to be slow
      const originalDeleteFile = storageService.deleteFile.bind(storageService)
      let deleteCount = 0
      const deleteSpy = jest.spyOn(storageService, 'deleteFile').mockImplementation(async (id) => {
        deleteCount++
        await new Promise((resolve) => setTimeout(resolve, 100))
        return originalDeleteFile(id)
      })

      // Start cleanup
      const cleanupPromise = cleanupService.handleScheduledCleanup()

      // Wait for a few deletions to start
      await new Promise((resolve) => setTimeout(resolve, 250))

      // Trigger shutdown
      cleanupService.markAsShuttingDown()

      // Wait for cleanup to complete
      await cleanupPromise

      // Should have processed some but not all files (interrupted by shutdown)
      expect(deleteCount).toBeGreaterThan(0)
      expect(deleteCount).toBeLessThan(fileResults.length)

      deleteSpy.mockRestore()
    })
  })

  describe('Application shutdown', () => {
    it('should close application successfully', async () => {
      const closePromise = app.close()
      await expect(closePromise).resolves.not.toThrow()
    })

    it('should close application within timeout', async () => {
      const startTime = Date.now()
      await app.close()
      const duration = Date.now() - startTime

      // Should close much faster than the timeout
      expect(duration).toBeLessThan(APP_CLOSE_TIMEOUT_MS)
    })

    it('should close HTTP server before closing application', async () => {
      const fastifyInstance = app.getHttpAdapter().getInstance()
      const closeSpy = jest.spyOn(fastifyInstance, 'close')

      await app.close()

      // Fastify close should have been called
      expect(closeSpy).toHaveBeenCalled()
    })
  })

  describe('Error handling during shutdown', () => {
    it('should handle cleanup errors gracefully', async () => {
      // Mock searchFiles to throw an error
      const searchSpy = jest
        .spyOn(storageService, 'searchFiles')
        .mockRejectedValue(new Error('Database error'))

      const loggerSpy = jest.spyOn(cleanupService['logger'], 'error')

      // Should not throw
      await expect(cleanupService.handleScheduledCleanup()).resolves.not.toThrow()

      // Should log error with stack trace
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scheduled cleanup failed: Database error'),
        expect.any(String)
      )

      searchSpy.mockRestore()
    })

    it('should handle individual file deletion errors', async () => {
      // Create expired files
      const file1Result = await storageService.saveFile({
        file: {
          stream: Readable.from(Buffer.from('test1')),
          originalname: 'test1.txt',
          mimetype: 'text/plain',
          size: 5,
        },
        ttl: -1,
      })

      const file2Result = await storageService.saveFile({
        file: {
          stream: Readable.from(Buffer.from('test2')),
          originalname: 'test2.txt',
          mimetype: 'text/plain',
          size: 5,
        },
        ttl: -1,
      })

      expect(file1Result.success).toBe(true)
      expect(file2Result.success).toBe(true)

      const file2Id = file2Result.data!.id

      // Mock deleteFile to fail for first file
      const originalDeleteFile = storageService.deleteFile.bind(storageService)
      let callCount = 0
      const deleteSpy = jest.spyOn(storageService, 'deleteFile').mockImplementation(async (id) => {
        callCount++
        if (callCount === 1) {
          return { success: false, error: 'Deletion failed' }
        }
        return originalDeleteFile(id)
      })

      // Should complete without throwing
      await expect(cleanupService.handleScheduledCleanup()).resolves.not.toThrow()

      // Second file should still be deleted
      const file2Info = await storageService.getFileInfo(file2Id)
      expect(file2Info.success).toBe(false)

      deleteSpy.mockRestore()
    })
  })

  describe('Concurrent cleanup prevention', () => {
    it('should not allow concurrent cleanup executions', async () => {
      // Mock searchFiles to be slow
      const searchSpy = jest.spyOn(storageService, 'searchFiles').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return { files: [], total: 0, params: {} }
      })

      // Start multiple cleanups
      const cleanup1 = cleanupService.handleScheduledCleanup()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const cleanup2 = cleanupService.handleScheduledCleanup()
      const cleanup3 = cleanupService.handleScheduledCleanup()

      await Promise.all([cleanup1, cleanup2, cleanup3])

      // searchFiles should only be called once
      expect(storageService.searchFiles).toHaveBeenCalledTimes(1)

      searchSpy.mockRestore()
    })
  })
})
