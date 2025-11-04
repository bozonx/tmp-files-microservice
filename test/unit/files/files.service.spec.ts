import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FilesService } from '@/modules/files/files.service';
import { StorageService } from '@/modules/storage/storage.service';

describe('FilesService', () => {
  let service: FilesService;
  let storage: jest.Mocked<StorageService>;

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
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: StorageService, useValue: storage },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: any) => {
              const cfg: Record<string, any> = {
                app: { apiBasePath: 'api' },
                MAX_FILE_SIZE_MB: 100,
                ALLOWED_MIME_TYPES: [],
                storage: { maxTtl: 3600 },
              };
              return key in cfg ? cfg[key] : def;
            },
          },
        },
      ],
    }).compile();

    service = module.get(FilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getFileStats delegates to storage and returns generatedAt', async () => {
    storage.getFileStats.mockResolvedValue({ totalFiles: 0, totalSize: 0, filesByMimeType: {}, filesByDate: {} });
    const res = await service.getFileStats();
    expect(res.stats.totalFiles).toBe(0);
    expect(typeof res.generatedAt).toBe('string');
  });
});
