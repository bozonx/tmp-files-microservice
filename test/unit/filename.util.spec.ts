import { FilenameUtil } from '@/common/utils/filename.util';
import { HashUtil } from '@/common/utils/hash.util';

describe('FilenameUtil', () => {
  it('generateSafeFilename preserves extension and adds suffix', () => {
    const hash = HashUtil.hashString('x');
    const name = FilenameUtil.generateSafeFilename('report.pdf', hash);
    expect(name.endsWith('.pdf')).toBe(true);
    expect(name.includes('_')).toBe(true);
  });

  it('sanitize and parse helpers work', () => {
    const sanitized = FilenameUtil.sanitizeFilename('my report: 2025?.txt');
    expect(sanitized).toContain('my');
    const ext = FilenameUtil.getFileExtension('a.TXT');
    expect(ext).toBe('.txt');
    const base = FilenameUtil.removeExtension('a.txt');
    expect(base).toBe('a');
  });

  it('isAllowedExtension validates against allowed list', () => {
    expect(FilenameUtil.isAllowedExtension('a.jpg', ['jpg', '.png'])).toBe(true);
    expect(FilenameUtil.isAllowedExtension('a.gif', ['jpg', '.png'])).toBe(false);
  });

  it('createFilePath composes path', () => {
    const p = FilenameUtil.createFilePath('/base/', '/2025-11/', '/a.txt');
    expect(p).toBe('/base/2025-11/a.txt');
  });
});
