import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  UploadFileDto,
  FileValidationDto,
  UpdateFileMetadataDto,
} from '../../src/modules/files/dto/upload-file.dto';
import {
  FileResponseDto,
  UploadFileResponseDto,
} from '../../src/modules/files/dto/file-response.dto';
import { HealthResponseDto, HealthStatus } from '../../src/modules/files/dto/health-response.dto';

describe('DTO Validation Tests', () => {
  describe('UploadFileDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToClass(UploadFileDto, {
        ttl: 3600,
        metadata: { description: 'Test file' },
        allowDuplicate: true,
        customFilename: 'test.pdf',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid TTL', async () => {
      const dto = plainToClass(UploadFileDto, {
        ttl: 30, // Too small
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('ttl');
      expect(errors[0].constraints?.min).toBeDefined();
    });

    it('should fail validation with TTL exceeding maximum', async () => {
      const dto = plainToClass(UploadFileDto, {
        ttl: 86400 * 31, // Exceeds 30 days
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('ttl');
      expect(errors[0].constraints?.max).toBeDefined();
    });

    it('should fail validation with invalid metadata', async () => {
      expect(() => {
        plainToClass(UploadFileDto, {
          metadata: 'invalid-json-string',
        });
      }).toThrow('Invalid JSON format for metadata');
    });

    it('should require TTL parameter', async () => {
      const dto = plainToClass(UploadFileDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('ttl');
      expect(dto.allowDuplicate).toBe(true);
    });
  });

  describe('FileResponseDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToClass(FileResponseDto, {
        id: 'test-id',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        uploadedAt: '2024-01-15T10:30:00.000Z',
        ttl: 3600,
        expiresAt: '2024-01-15T11:30:00.000Z',
        hash: 'test-hash',
        metadata: { description: 'Test file' },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with missing required fields', async () => {
      const dto = plainToClass(FileResponseDto, {
        id: 'test-id',
        // Missing other required fields
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation with invalid date format', async () => {
      const dto = plainToClass(FileResponseDto, {
        id: 'test-id',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        uploadedAt: 'invalid-date',
        ttl: 3600,
        expiresAt: '2024-01-15T11:30:00.000Z',
        hash: 'test-hash',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('uploadedAt');
    });
  });

  describe('HealthResponseDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToClass(HealthResponseDto, {
        status: HealthStatus.HEALTHY,
        uptime: 3600,
        version: '1.0.0',
        storage: {
          status: HealthStatus.HEALTHY,
          totalSpace: 1000000000,
          usedSpace: 500000000,
          fileCount: 100,
        },
        timestamp: '2024-01-15T10:30:00.000Z',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid status', async () => {
      const dto = plainToClass(HealthResponseDto, {
        status: 'invalid-status',
        uptime: 3600,
        version: '1.0.0',
        storage: {
          status: HealthStatus.HEALTHY,
          totalSpace: 1000000000,
          usedSpace: 500000000,
          fileCount: 100,
        },
        timestamp: '2024-01-15T10:30:00.000Z',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('status');
    });

    it('should fail validation with missing required fields', async () => {
      const dto = plainToClass(HealthResponseDto, {
        status: HealthStatus.HEALTHY,
        // Missing other required fields
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UpdateFileMetadataDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToClass(UpdateFileMetadataDto, {
        metadata: { description: 'Updated file' },
        ttl: 7200,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with empty object', async () => {
      const dto = plainToClass(UpdateFileMetadataDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid TTL', async () => {
      const dto = plainToClass(UpdateFileMetadataDto, {
        ttl: 30, // Too small
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('ttl');
    });
  });
});
