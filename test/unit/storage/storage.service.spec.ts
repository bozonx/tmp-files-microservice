import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '@/modules/storage/storage.service';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('StorageService (basic)', () => {
  let service: StorageService;
  let testStoragePath: string;

  beforeAll(async () => {
    testStoragePath = path.join(__dirname, '..', '..', '.tmp-storage');
    await fs.ensureDir(testStoragePath);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
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
                };
              }
              const legacyEnvLike: Record<string, any> = {
                STORAGE_DIR: testStoragePath,
                MAX_FILE_SIZE_MB: 1,
                ALLOWED_MIME_TYPES: [],
                ENABLE_DEDUPLICATION: true,
              };
              return key in legacyEnvLike ? legacyEnvLike[key] : def;
            },
          },
        },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  afterAll(async () => {
    if (await fs.pathExists(testStoragePath)) {
      await fs.remove(testStoragePath);
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize storage and return empty stats', async () => {
    const stats = await service.getFileStats();
    expect(stats.totalFiles).toBeDefined();
    expect(stats.totalSize).toBeDefined();
  });
});
