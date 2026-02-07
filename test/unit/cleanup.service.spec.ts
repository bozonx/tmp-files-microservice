import { jest } from '@jest/globals'
import { CleanupService } from '@/services/cleanup.service.js'
import { createMockLogger } from '@/../test/helpers/mocks.js'

describe('CleanupService', () => {
  it('runCleanup deletes expired files and then deletes orphaned files', async () => {
    const storage = {
      searchFiles: (jest.fn() as any).mockResolvedValue({
        files: [{ id: '1' }, { id: '2' }],
        total: 2,
        params: {},
      }),
      deleteFile: (jest.fn() as any).mockResolvedValue({ success: true }),
      deleteOrphanedFiles: (jest.fn() as any).mockResolvedValue({ deleted: 0, freed: 0 }),
    } as any

    const service = new CleanupService({
      env: {} as any,
      storage,
      logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    })

    await service.runCleanup()

    expect(storage.searchFiles).toHaveBeenCalledWith({ expiredOnly: true, limit: 1000 })
    expect(storage.deleteFile).toHaveBeenCalledTimes(2)
    expect(storage.deleteOrphanedFiles).toHaveBeenCalledTimes(1)
  })
})
