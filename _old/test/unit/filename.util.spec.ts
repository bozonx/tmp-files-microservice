/// <reference types="jest" />
import { FilenameUtil } from '../../src/common/utils/filename.util';

describe('FilenameUtil', () => {
  const validHash = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';

  describe('generateSafeFilename', () => {
    it('should generate safe filename with short UUID in format filename_uuid.ext', () => {
      const originalName = 'test-file.txt';
      const safeName = FilenameUtil.generateSafeFilename(originalName, validHash);

      expect(safeName).toBeDefined();
      expect(safeName).toMatch(/^test-file_[a-f0-9]{8}\.txt$/);
      expect(safeName).toContain('.txt');
    });

    it('should sanitize forbidden characters and spaces', () => {
      const originalName = 'test<file>:"name with spaces".txt';
      const safeName = FilenameUtil.generateSafeFilename(originalName, validHash);

      expect(safeName).not.toContain('<');
      expect(safeName).not.toContain('>');
      expect(safeName).not.toContain(':');
      expect(safeName).not.toContain('"');
      expect(safeName).not.toContain(' ');
      expect(safeName).toContain('_');
      expect(safeName).toMatch(/^test_file_name_with__[a-f0-9]{8}\.txt$/);
    });

    it('should truncate filename to 20 characters before UUID', () => {
      const longName = 'a'.repeat(30) + '.txt';
      const safeName = FilenameUtil.generateSafeFilename(longName, validHash);

      // Должно быть: 20 символов + _ + короткий UUID + .txt
      expect(safeName).toMatch(/^a{20}_[a-f0-9]{8}\.txt$/);
    });

    it('should handle files without extension', () => {
      const originalName = 'testfile';
      const safeName = FilenameUtil.generateSafeFilename(originalName, validHash);

      expect(safeName).toMatch(/^testfile_[a-f0-9]{8}$/);
    });

    it('should throw error for empty filename', () => {
      const originalName = '';

      expect(() => FilenameUtil.generateSafeFilename(originalName, validHash)).toThrow(
        'Original filename must be a non-empty string',
      );
    });

    it('should throw error for invalid inputs', () => {
      expect(() => FilenameUtil.generateSafeFilename(null as any, validHash)).toThrow(
        'Original filename must be a non-empty string',
      );

      expect(() => FilenameUtil.generateSafeFilename('test.txt', 'invalid-hash')).toThrow(
        'Hash must be a valid SHA-256 hash',
      );
    });

    it('should handle Cyrillic filenames', () => {
      const originalName = 'документ с пробелами.pdf';
      const safeName = FilenameUtil.generateSafeFilename(originalName, validHash);

      expect(safeName).toMatch(/^документ_с_пробелами_[a-f0-9]{8}\.pdf$/);
    });

    it('should handle Chinese filenames', () => {
      const originalName = '文档文件.jpg';
      const safeName = FilenameUtil.generateSafeFilename(originalName, validHash);

      expect(safeName).toMatch(/^文档文件_[a-f0-9]{8}\.jpg$/);
    });

    it('should handle mixed language filenames', () => {
      const originalName = 'document документ 文档.txt';
      const safeName = FilenameUtil.generateSafeFilename(originalName, validHash);

      expect(safeName).toMatch(/^document_документ_文档_[a-f0-9]{8}\.txt$/);
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      expect(FilenameUtil.getFileExtension('test.txt')).toBe('.txt');
      expect(FilenameUtil.getFileExtension('image.jpg')).toBe('.jpg');
      expect(FilenameUtil.getFileExtension('document.pdf')).toBe('.pdf');
    });

    it('should return empty string for files without extension', () => {
      expect(FilenameUtil.getFileExtension('testfile')).toBe('');
      expect(FilenameUtil.getFileExtension('test.')).toBe('.');
    });

    it('should handle empty or invalid input', () => {
      expect(FilenameUtil.getFileExtension('')).toBe('');
      expect(FilenameUtil.getFileExtension(null as any)).toBe('');
      expect(FilenameUtil.getFileExtension(undefined as any)).toBe('');
    });

    it('should return lowercase extension', () => {
      expect(FilenameUtil.getFileExtension('test.TXT')).toBe('.txt');
      expect(FilenameUtil.getFileExtension('image.JPG')).toBe('.jpg');
    });
  });

  describe('removeExtension', () => {
    it('should remove file extension', () => {
      expect(FilenameUtil.removeExtension('test.txt')).toBe('test');
      expect(FilenameUtil.removeExtension('image.jpg')).toBe('image');
      expect(FilenameUtil.removeExtension('document.pdf')).toBe('document');
    });

    it('should handle files without extension', () => {
      expect(FilenameUtil.removeExtension('testfile')).toBe('testfile');
      expect(FilenameUtil.removeExtension('test.')).toBe('test');
    });

    it('should handle empty or invalid input', () => {
      expect(FilenameUtil.removeExtension('')).toBe('');
      expect(FilenameUtil.removeExtension(null as any)).toBe('');
      expect(FilenameUtil.removeExtension(undefined as any)).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    it('should replace forbidden characters and spaces with underscores', () => {
      const filename = 'test<file>:"name with spaces".txt';
      const sanitized = FilenameUtil.sanitizeFilename(filename);

      expect(sanitized).toBe('test_file_name_with_spaces_.txt');
    });

    it('should remove multiple consecutive underscores', () => {
      const filename = 'test___file____name.txt';
      const sanitized = FilenameUtil.sanitizeFilename(filename);

      expect(sanitized).toBe('test_file_name.txt');
    });

    it('should remove leading and trailing underscores', () => {
      const filename = '_test_file_';
      const sanitized = FilenameUtil.sanitizeFilename(filename);

      expect(sanitized).toBe('test_file');
    });

    it('should return "file" for empty result', () => {
      const filename = '<>:"/\\|?*';
      const sanitized = FilenameUtil.sanitizeFilename(filename);

      expect(sanitized).toBe('file');
    });

    it('should support Cyrillic characters', () => {
      const filename = 'документ с пробелами.txt';
      const sanitized = FilenameUtil.sanitizeFilename(filename);

      expect(sanitized).toBe('документ_с_пробелами.txt');
    });

    it('should support Chinese characters', () => {
      const filename = '文档 文件.pdf';
      const sanitized = FilenameUtil.sanitizeFilename(filename);

      expect(sanitized).toBe('文档_文件.pdf');
    });

    it('should support mixed languages', () => {
      const filename = 'document документ 文档.txt';
      const sanitized = FilenameUtil.sanitizeFilename(filename);

      expect(sanitized).toBe('document_документ_文档.txt');
    });

    it('should handle empty or invalid input', () => {
      expect(FilenameUtil.sanitizeFilename('')).toBe('');
      expect(FilenameUtil.sanitizeFilename(null as any)).toBe('');
      expect(FilenameUtil.sanitizeFilename(undefined as any)).toBe('');
    });
  });

  describe('isSafeFilename', () => {
    it('should return true for safe filenames', () => {
      expect(FilenameUtil.isSafeFilename('test.txt')).toBe(true);
      expect(FilenameUtil.isSafeFilename('image-file.jpg')).toBe(true);
      expect(FilenameUtil.isSafeFilename('document_123.pdf')).toBe(true);
    });

    it('should return false for filenames with forbidden characters', () => {
      expect(FilenameUtil.isSafeFilename('test<file>.txt')).toBe(false);
      expect(FilenameUtil.isSafeFilename('file|name.txt')).toBe(false);
      expect(FilenameUtil.isSafeFilename('file"name.txt')).toBe(false);
    });

    it('should return false for too long filenames', () => {
      const longName = 'a'.repeat(256) + '.txt';
      expect(FilenameUtil.isSafeFilename(longName)).toBe(false);
    });

    it('should return false for empty or invalid input', () => {
      expect(FilenameUtil.isSafeFilename('')).toBe(false);
      expect(FilenameUtil.isSafeFilename('   ')).toBe(false);
      expect(FilenameUtil.isSafeFilename(null as any)).toBe(false);
      expect(FilenameUtil.isSafeFilename(undefined as any)).toBe(false);
    });
  });

  describe('generateDatePath', () => {
    it('should generate date path in YYYY-MM format', () => {
      const date = new Date('2024-03-15T10:30:00Z');
      const datePath = FilenameUtil.generateDatePath(date);

      expect(datePath).toBe('2024-03');
    });

    it('should use current date if no date provided', () => {
      const datePath = FilenameUtil.generateDatePath();
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      expect(datePath).toBe(expected);
    });

    it('should handle single digit months', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const datePath = FilenameUtil.generateDatePath(date);

      expect(datePath).toBe('2024-01');
    });

    it('should throw error for invalid date', () => {
      expect(() => FilenameUtil.generateDatePath(new Date('invalid'))).toThrow(
        'Invalid date provided',
      );

      expect(() => FilenameUtil.generateDatePath(null as any)).toThrow('Invalid date provided');
    });
  });

  describe('createFilePath', () => {
    it('should create correct file path', () => {
      const basePath = '/storage';
      const datePath = '2024-03';
      const filename = 'test.txt';

      const filePath = FilenameUtil.createFilePath(basePath, datePath, filename);

      expect(filePath).toBe('/storage/2024-03/test.txt');
    });

    it('should normalize paths with multiple slashes', () => {
      const basePath = '/storage///';
      const datePath = '//2024-03//';
      const filename = '/test.txt';

      const filePath = FilenameUtil.createFilePath(basePath, datePath, filename);

      expect(filePath).toBe('/storage/2024-03/test.txt');
    });

    it('should throw error for missing components', () => {
      expect(() => FilenameUtil.createFilePath('', '2024-03', 'test.txt')).toThrow(
        'All path components must be provided',
      );

      expect(() => FilenameUtil.createFilePath('/storage', '', 'test.txt')).toThrow(
        'All path components must be provided',
      );

      expect(() => FilenameUtil.createFilePath('/storage', '2024-03', '')).toThrow(
        'All path components must be provided',
      );
    });
  });

  describe('parseFilePath', () => {
    it('should parse file path correctly', () => {
      const filePath = '/storage/2024-03/test-file.txt';
      const parsed = FilenameUtil.parseFilePath(filePath);

      expect(parsed.directory).toBe('/storage/2024-03');
      expect(parsed.filename).toBe('test-file.txt');
      expect(parsed.basename).toBe('test-file');
      expect(parsed.extension).toBe('.txt');
    });

    it('should handle files without extension', () => {
      const filePath = '/storage/2024-03/testfile';
      const parsed = FilenameUtil.parseFilePath(filePath);

      expect(parsed.directory).toBe('/storage/2024-03');
      expect(parsed.filename).toBe('testfile');
      expect(parsed.basename).toBe('testfile');
      expect(parsed.extension).toBe('');
    });

    it('should throw error for invalid input', () => {
      expect(() => FilenameUtil.parseFilePath('')).toThrow('File path must be a non-empty string');

      expect(() => FilenameUtil.parseFilePath(null as any)).toThrow(
        'File path must be a non-empty string',
      );
    });
  });

  describe('isAllowedExtension', () => {
    it('should return true for allowed extensions', () => {
      const allowedExtensions = ['txt', 'jpg', 'pdf'];

      expect(FilenameUtil.isAllowedExtension('test.txt', allowedExtensions)).toBe(true);
      expect(FilenameUtil.isAllowedExtension('image.jpg', allowedExtensions)).toBe(true);
      expect(FilenameUtil.isAllowedExtension('document.pdf', allowedExtensions)).toBe(true);
    });

    it('should return false for not allowed extensions', () => {
      const allowedExtensions = ['txt', 'jpg', 'pdf'];

      expect(FilenameUtil.isAllowedExtension('test.doc', allowedExtensions)).toBe(false);
      expect(FilenameUtil.isAllowedExtension('image.png', allowedExtensions)).toBe(false);
    });

    it('should handle extensions with dots', () => {
      const allowedExtensions = ['.txt', '.jpg', '.pdf'];

      expect(FilenameUtil.isAllowedExtension('test.txt', allowedExtensions)).toBe(true);
      expect(FilenameUtil.isAllowedExtension('image.jpg', allowedExtensions)).toBe(true);
    });

    it('should be case insensitive', () => {
      const allowedExtensions = ['txt', 'jpg', 'pdf'];

      expect(FilenameUtil.isAllowedExtension('test.TXT', allowedExtensions)).toBe(true);
      expect(FilenameUtil.isAllowedExtension('image.JPG', allowedExtensions)).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(FilenameUtil.isAllowedExtension('', ['txt'])).toBe(false);
      expect(FilenameUtil.isAllowedExtension('test.txt', [])).toBe(false);
      expect(FilenameUtil.isAllowedExtension(null as any, ['txt'])).toBe(false);
    });
  });
});
