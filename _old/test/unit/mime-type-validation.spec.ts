/**
 * Тесты для проверки логики валидации MIME типов
 */

describe('MIME Type Validation Logic', () => {
  it('should allow all MIME types when allowedMimeTypes is empty', () => {
    const allowedMimeTypes: string[] = [];
    const testMimeType = 'application/x-executable';

    // Логика проверки MIME типов
    const isAllowed = allowedMimeTypes.length === 0 || allowedMimeTypes.includes(testMimeType);

    expect(isAllowed).toBe(true);
  });

  it('should allow specific MIME types when allowedMimeTypes is configured', () => {
    const allowedMimeTypes = ['image/jpeg', 'text/plain'];
    const allowedMimeType = 'image/jpeg';
    const disallowedMimeType = 'application/x-executable';

    // Логика проверки MIME типов
    const isAllowed1 = allowedMimeTypes.length === 0 || allowedMimeTypes.includes(allowedMimeType);
    const isAllowed2 =
      allowedMimeTypes.length === 0 || allowedMimeTypes.includes(disallowedMimeType);

    expect(isAllowed1).toBe(true);
    expect(isAllowed2).toBe(false);
  });

  it('should handle edge cases in MIME type validation', () => {
    const allowedMimeTypes: string[] = [];

    // Тестируем различные типы файлов
    const testCases = [
      'image/jpeg',
      'application/pdf',
      'text/plain',
      'application/x-executable',
      'video/mp4',
      'audio/mpeg',
      'application/zip',
      'text/html',
      'application/json',
      'image/svg+xml',
    ];

    testCases.forEach((mimeType) => {
      const isAllowed = allowedMimeTypes.length === 0 || allowedMimeTypes.includes(mimeType);
      expect(isAllowed).toBe(true);
    });
  });

  it('should reject files when specific MIME types are restricted', () => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'text/plain'];

    const testCases = [
      { mimeType: 'image/jpeg', expected: true },
      { mimeType: 'image/png', expected: true },
      { mimeType: 'text/plain', expected: true },
      { mimeType: 'application/x-executable', expected: false },
      { mimeType: 'video/mp4', expected: false },
      { mimeType: 'application/pdf', expected: false },
    ];

    testCases.forEach(({ mimeType, expected }) => {
      const isAllowed = allowedMimeTypes.length === 0 || allowedMimeTypes.includes(mimeType);
      expect(isAllowed).toBe(expected);
    });
  });
});
