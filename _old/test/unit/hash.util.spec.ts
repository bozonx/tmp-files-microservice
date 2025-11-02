import { HashUtil } from '../../src/common/utils/hash.util';
import { writeFile, unlink } from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

describe('HashUtil', () => {
  let tempFile: string;

  beforeEach(() => {
    tempFile = join(tmpdir(), `test-file-${Date.now()}.txt`);
  });

  afterEach(async () => {
    try {
      await unlink(tempFile);
    } catch {
      // Игнорируем ошибки удаления
    }
  });

  describe('hashFile', () => {
    it('should hash a file correctly', async () => {
      const content = 'Hello, World!';
      await writeFile(tempFile, content);

      const hash = await HashUtil.hashFile(tempFile);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64); // SHA-256 hash length
    });

    it('should throw error for non-existent file', async () => {
      const nonExistentFile = join(tmpdir(), 'non-existent-file.txt');

      await expect(HashUtil.hashFile(nonExistentFile)).rejects.toThrow('Failed to hash file');
    });

    it('should produce same hash for same content', async () => {
      const content = 'Test content';
      await writeFile(tempFile, content);

      const hash1 = await HashUtil.hashFile(tempFile);
      const hash2 = await HashUtil.hashFile(tempFile);

      expect(hash1).toBe(hash2);
    });
  });

  describe('hashBuffer', () => {
    it('should hash a buffer correctly', () => {
      const buffer = Buffer.from('Hello, World!');
      const hash = HashUtil.hashBuffer(buffer);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64);
    });

    it('should throw error for non-buffer input', () => {
      expect(() => HashUtil.hashBuffer('not a buffer' as any)).toThrow('Input must be a Buffer');
    });

    it('should produce same hash for same buffer', () => {
      const buffer = Buffer.from('Test content');
      const hash1 = HashUtil.hashBuffer(buffer);
      const hash2 = HashUtil.hashBuffer(buffer);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const buffer1 = Buffer.from('Content 1');
      const buffer2 = Buffer.from('Content 2');

      const hash1 = HashUtil.hashBuffer(buffer1);
      const hash2 = HashUtil.hashBuffer(buffer2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashString', () => {
    it('should hash a string correctly', () => {
      const text = 'Hello, World!';
      const hash = HashUtil.hashString(text);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64);
    });

    it('should throw error for non-string input', () => {
      expect(() => HashUtil.hashString(123 as any)).toThrow('Input must be a string');
    });

    it('should produce same hash for same string', () => {
      const text = 'Test string';
      const hash1 = HashUtil.hashString(text);
      const hash2 = HashUtil.hashString(text);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different strings', () => {
      const text1 = 'String 1';
      const text2 = 'String 2';

      const hash1 = HashUtil.hashString(text1);
      const hash2 = HashUtil.hashString(text2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isValidHash', () => {
    it('should return true for valid SHA-256 hash', () => {
      const validHash = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
      expect(HashUtil.isValidHash(validHash)).toBe(true);
    });

    it('should return false for invalid hash', () => {
      const invalidHashes = [
        'invalid-hash',
        'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae', // too short
        'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3x', // too long
        'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ag', // invalid character
        '',
        null,
        undefined,
        123,
      ];

      invalidHashes.forEach((hash) => {
        expect(HashUtil.isValidHash(hash as any)).toBe(false);
      });
    });
  });

  describe('compareHashes', () => {
    it('should return true for identical hashes', () => {
      const hash = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
      expect(HashUtil.compareHashes(hash, hash)).toBe(true);
    });

    it('should return true for hashes with different case', () => {
      const hash1 = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
      const hash2 = 'A665A45920422F9D417E4867EFDC4FB8A04A1F3FFF1FA07E998E86F7F7A27AE3';
      expect(HashUtil.compareHashes(hash1, hash2)).toBe(true);
    });

    it('should return false for different hashes', () => {
      const hash1 = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
      const hash2 = 'b665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
      expect(HashUtil.compareHashes(hash1, hash2)).toBe(false);
    });

    it('should return false for invalid hashes', () => {
      const validHash = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
      const invalidHash = 'invalid-hash';

      expect(HashUtil.compareHashes(validHash, invalidHash)).toBe(false);
      expect(HashUtil.compareHashes(invalidHash, validHash)).toBe(false);
      expect(HashUtil.compareHashes(invalidHash, invalidHash)).toBe(false);
    });
  });

  describe('generateShortHash', () => {
    it('should generate short hash from string', () => {
      const text = 'Hello, World!';
      const shortHash = HashUtil.generateShortHash(text, 8);

      expect(shortHash).toBeDefined();
      expect(typeof shortHash).toBe('string');
      expect(shortHash).toHaveLength(8);
    });

    it('should generate short hash from buffer', () => {
      const buffer = Buffer.from('Hello, World!');
      const shortHash = HashUtil.generateShortHash(buffer, 12);

      expect(shortHash).toBeDefined();
      expect(typeof shortHash).toBe('string');
      expect(shortHash).toHaveLength(12);
    });

    it('should use default length of 8', () => {
      const text = 'Test';
      const shortHash = HashUtil.generateShortHash(text);

      expect(shortHash).toHaveLength(8);
    });

    it('should throw error for invalid length', () => {
      const text = 'Test';

      expect(() => HashUtil.generateShortHash(text, 0)).toThrow('Length must be between 1 and 64');

      expect(() => HashUtil.generateShortHash(text, 65)).toThrow('Length must be between 1 and 64');
    });

    it('should throw error for invalid input', () => {
      expect(() => HashUtil.generateShortHash(123 as any)).toThrow(
        'Input must be a string or Buffer',
      );
    });

    it('should produce same short hash for same input', () => {
      const text = 'Test content';
      const shortHash1 = HashUtil.generateShortHash(text, 8);
      const shortHash2 = HashUtil.generateShortHash(text, 8);

      expect(shortHash1).toBe(shortHash2);
    });
  });
});
