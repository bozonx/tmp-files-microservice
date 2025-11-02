import { v4 as uuidv4 } from 'uuid';

/**
 * Максимальная длина короткого имени файла
 */
const MAX_SHORT_FILENAME_LENGTH = 20;

/**
 * Санитизирует имя файла, заменяя неправильные символы и пробелы на подчеркивания
 * @param filename - оригинальное имя файла
 * @returns санитизированное имя файла
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\p{L}\p{N}._-]/gu, '_') // Заменяем все неправильные символы и пробелы на _ (поддерживает Unicode буквы и цифры)
    .replace(/_{2,}/g, '_') // Заменяем множественные подчеркивания на одно
    .replace(/^_+|_+$/g, ''); // Убираем подчеркивания в начале и конце
}

/**
 * Создает короткое имя файла без расширения (обрезает до 20 символов)
 * @param filename - оригинальное имя файла
 * @returns короткое имя файла без расширения
 */
export function createShortFilename(filename: string): string {
  const sanitized = sanitizeFilename(filename);

  // Удаляем расширение
  const lastDotIndex = sanitized.lastIndexOf('.');
  const nameWithoutExt = lastDotIndex > 0 ? sanitized.substring(0, lastDotIndex) : sanitized;

  // Обрезаем до максимальной длины
  if (nameWithoutExt.length <= MAX_SHORT_FILENAME_LENGTH) {
    return nameWithoutExt;
  }

  return nameWithoutExt.substring(0, MAX_SHORT_FILENAME_LENGTH);
}

/**
 * Создает полное имя файла в новом формате: <SHORT_FILENAME>_<UUID>.<EXT>
 * @param originalFilename - оригинальное имя файла
 * @returns новое имя файла с UUID
 */
export function createStorageFilename(originalFilename: string): string {
  const shortName = createShortFilename(originalFilename);
  const uuid = uuidv4().substring(0, 8); // Используем короткий UUID (8 символов)

  // Извлекаем расширение из оригинального имени
  const lastDotIndex = originalFilename.lastIndexOf('.');
  const extension = lastDotIndex > 0 ? originalFilename.substring(lastDotIndex) : '';

  return `${shortName}_${uuid}${extension}`;
}

/**
 * Создает путь к директории для хранения файла в формате: <YEAR>-<MONTH>
 * @param date - дата создания файла (по умолчанию текущая дата)
 * @returns путь к директории
 */
export function createStorageDirectoryPath(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}
