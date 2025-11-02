import { ValidationUtil } from '../../src/common/utils/validation.util';
import { UploadedFile, FileInfo } from '../../src/common/interfaces/file.interface';

describe('ValidationUtil', () => {
  describe('validateUploadedFile', () => {
    const validFile: UploadedFile = {
      originalname: 'test.txt',
      mimetype: 'text/plain',
      size: 1024,
      path: '/tmp/test.txt',
    };

    it('should validate correct file with empty allowed MIME types (allow all)', () => {
      const result = ValidationUtil.validateUploadedFile(validFile, []);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null file', () => {
      const result = ValidationUtil.validateUploadedFile(null as any, []);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is required');
    });

    it('should reject file without originalname', () => {
      const file = { ...validFile, originalname: '' };
      const result = ValidationUtil.validateUploadedFile(file, []);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Original filename is required');
    });

    it('should reject file with invalid size', () => {
      const file = { ...validFile, size: -1 };
      const result = ValidationUtil.validateUploadedFile(file, []);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size must be a positive number');
    });

    it('should reject file exceeding max size', () => {
      const file = { ...validFile, size: 200 * 1024 * 1024 }; // 200MB
      const result = ValidationUtil.validateUploadedFile(file, []);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('File size exceeds maximum allowed size'))).toBe(
        true,
      );
    });

    it('should reject file without mimetype', () => {
      const file = { ...validFile, mimetype: '' };
      const result = ValidationUtil.validateUploadedFile(file, []);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('MIME type is required');
    });

    it('should reject file with not allowed mimetype when restrictions are set', () => {
      const file = { ...validFile, mimetype: 'application/x-executable' };
      const allowedMimeTypes = ['text/plain', 'image/jpeg'];
      const result = ValidationUtil.validateUploadedFile(file, allowedMimeTypes);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("MIME type 'application/x-executable' is not allowed");
    });

    it('should allow any mimetype when no restrictions are set', () => {
      const file = { ...validFile, mimetype: 'application/x-executable' };
      const result = ValidationUtil.validateUploadedFile(file, []);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject file without path or buffer', () => {
      const file = { ...validFile, path: '', buffer: undefined };
      const result = ValidationUtil.validateUploadedFile(file, []);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File must have either path or buffer');
    });

    it('should accept file with buffer instead of path', () => {
      const file = { ...validFile, path: '', buffer: Buffer.from('test') };
      const result = ValidationUtil.validateUploadedFile(file, []);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateTTL', () => {
    const minTtl = 60; // 1 минута в секундах
    const maxTtl = 604800; // 7 дней в секундах

    it('should validate correct TTL', () => {
      const result = ValidationUtil.validateTTL(1800, minTtl, maxTtl); // 30 минут

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-number TTL', () => {
      const result = ValidationUtil.validateTTL('3600' as any, minTtl, maxTtl);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('TTL must be a number');
    });

    it('should reject non-integer TTL', () => {
      const result = ValidationUtil.validateTTL(3600.5, minTtl, maxTtl);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('TTL must be an integer');
    });

    it('should reject TTL below minimum', () => {
      const result = ValidationUtil.validateTTL(30, minTtl, maxTtl); // 30 seconds

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('TTL must be at least 60 seconds');
    });

    it('should reject TTL above maximum', () => {
      const result = ValidationUtil.validateTTL(700000, minTtl, maxTtl); // 8+ days

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'TTL must not exceed 604800 seconds (MAX_TTL_MIN: 10080 minutes)',
      );
    });

    it('should accept minimum TTL', () => {
      const result = ValidationUtil.validateTTL(60, minTtl, maxTtl); // 1 minute

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept maximum TTL', () => {
      const result = ValidationUtil.validateTTL(604800, minTtl, maxTtl); // 7 days

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should use default values when no parameters provided', () => {
      const result = ValidationUtil.validateTTL(3600); // 1 hour

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateFileId', () => {
    it('should validate correct file ID', () => {
      const result = ValidationUtil.validateFileId('test-id-123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null file ID', () => {
      const result = ValidationUtil.validateFileId(null as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File ID is required and must be a string');
    });

    it('should reject empty file ID', () => {
      const result = ValidationUtil.validateFileId('');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject whitespace-only file ID', () => {
      const result = ValidationUtil.validateFileId('   ');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File ID cannot be empty');
    });

    it('should reject too long file ID', () => {
      const longId = 'a'.repeat(256);
      const result = ValidationUtil.validateFileId(longId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File ID is too long');
    });
  });

  describe('validateMetadata', () => {
    it('should validate correct metadata', () => {
      const metadata = {
        author: 'John Doe',
        version: 1,
        isPublic: true,
        tags: null,
      };
      const result = ValidationUtil.validateMetadata(metadata);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept null metadata', () => {
      const result = ValidationUtil.validateMetadata(null as any);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept undefined metadata', () => {
      const result = ValidationUtil.validateMetadata(undefined as any);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object metadata', () => {
      const result = ValidationUtil.validateMetadata('invalid' as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Metadata must be an object');
    });

    it('should reject array metadata', () => {
      const result = ValidationUtil.validateMetadata(['item1', 'item2'] as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Metadata must be an object');
    });

    it('should reject metadata with too many keys', () => {
      const metadata: Record<string, any> = {};
      for (let i = 0; i < 51; i++) {
        metadata[`key${i}`] = `value${i}`;
      }
      const result = ValidationUtil.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Metadata cannot have more than 50 keys');
    });

    it('should reject metadata with invalid keys', () => {
      const metadata = {
        '': 'empty key',
        123: 'numeric key',
      };
      const result = ValidationUtil.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Metadata keys must be non-empty strings');
    });

    it('should reject metadata with too long keys', () => {
      const longKey = 'a'.repeat(101);
      const metadata = {
        [longKey]: 'value',
      };
      const result = ValidationUtil.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Metadata key '${longKey}' is too long`);
    });

    it('should reject metadata with invalid values', () => {
      const metadata = {
        valid: 'string',
        invalid: { object: 'not allowed' },
      };
      const result = ValidationUtil.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Metadata value for key 'invalid' must be a string, number, boolean, or null",
      );
    });

    it('should reject metadata with too long string values', () => {
      const longValue = 'a'.repeat(1001);
      const metadata = {
        key: longValue,
      };
      const result = ValidationUtil.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Metadata value for key 'key' is too long");
    });
  });

  describe('validateFileInfo', () => {
    const validFileInfo: FileInfo = {
      id: 'test-id',
      originalName: 'test.txt',
      storedName: 'test_a665a459.txt',
      mimeType: 'text/plain',
      size: 1024,
      hash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
      uploadedAt: new Date(),
      ttl: 3600,
      expiresAt: new Date(Date.now() + 3600000),
      filePath: '/storage/2024-03/test_a665a459.txt',
    };

    it('should validate correct file info', () => {
      const result = ValidationUtil.validateFileInfo(validFileInfo);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null file info', () => {
      const result = ValidationUtil.validateFileInfo(null as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File info is required and must be an object');
    });

    it('should reject file info with invalid ID', () => {
      const fileInfo = { ...validFileInfo, id: '' };
      const result = ValidationUtil.validateFileInfo(fileInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject file info with invalid size', () => {
      const fileInfo = { ...validFileInfo, size: -1 };
      const result = ValidationUtil.validateFileInfo(fileInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Size must be a positive number');
    });

    it('should reject file info with invalid dates', () => {
      const fileInfo = { ...validFileInfo, uploadedAt: 'invalid' as any };
      const result = ValidationUtil.validateFileInfo(fileInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Uploaded at must be a Date object');
    });

    it('should validate metadata if present', () => {
      const fileInfo = {
        ...validFileInfo,
        metadata: { invalid: { object: 'not allowed' } },
      };
      const result = ValidationUtil.validateFileInfo(fileInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Metadata value for key 'invalid' must be a string, number, boolean, or null",
      );
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
      ];

      validUUIDs.forEach((uuid) => {
        expect(ValidationUtil.isValidUUID(uuid)).toBe(true);
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '550e8400-e29b-41d4-a716',
        '550e8400-e29b-41d4-a716-44665544000g',
        '',
        null,
        undefined,
        123,
      ];

      invalidUUIDs.forEach((uuid) => {
        expect(ValidationUtil.isValidUUID(uuid as any)).toBe(false);
      });
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        '123@test.com',
      ];

      validEmails.forEach((email) => {
        expect(ValidationUtil.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid emails', () => {
      const invalidEmails = ['invalid-email', '@example.com', 'test@', '', null, undefined, 123];

      invalidEmails.forEach((email) => {
        expect(ValidationUtil.isValidEmail(email as any)).toBe(false);
      });
    });
  });

  describe('isValidURL', () => {
    it('should validate correct URLs', () => {
      const validURLs = [
        'https://example.com',
        'http://test.org/path',
        'https://subdomain.example.com:8080/path?query=value',
        'ftp://files.example.com',
      ];

      validURLs.forEach((url) => {
        expect(ValidationUtil.isValidURL(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidURLs = ['not-a-url', 'http://', 'https://', '', null, undefined, 123];

      invalidURLs.forEach((url) => {
        expect(ValidationUtil.isValidURL(url as any)).toBe(false);
      });
    });
  });
});
