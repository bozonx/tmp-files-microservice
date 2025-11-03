import { Test, TestingModule } from '@nestjs/testing';
import { CleanupService } from '@/modules/cleanup/cleanup.service';
import { StorageService } from '@/modules/storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('CleanupService', () => {
  let service: CleanupService;
  let storage: jest.Mocked<StorageService>;

  beforeEach(async () => {
    storage = {
      searchFiles: jest.fn(),
      deleteFile: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: StorageService, useValue: storage },
        // Disable interval during unit tests
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('0') } },
        { provide: SchedulerRegistry, useValue: { addInterval: jest.fn(), getInterval: jest.fn(), deleteInterval: jest.fn() } },
      ],
    }).compile();

    service = module.get(CleanupService);
  });

  it('handleScheduledCleanup deletes expired files returned by storage', async () => {
    storage.searchFiles.mockResolvedValue({ files: [{ id: '1', size: 10 }, { id: '2', size: 20 }], total: 2, params: {} } as any);
    storage.deleteFile.mockResolvedValue({ success: true, data: { id: '1', size: 10 } } as any);
    await service.handleScheduledCleanup();
    expect(storage.searchFiles).toHaveBeenCalledWith({ expiredOnly: true, limit: 10000 });
    expect(storage.deleteFile).toHaveBeenCalledTimes(2);
  });
});
