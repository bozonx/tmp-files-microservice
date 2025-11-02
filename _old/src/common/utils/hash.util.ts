import { createHash } from 'crypto';
import { readFile } from 'fs-extra';

/**
 * Утилиты для работы с хешированием файлов
 */
export class HashUtil {
  /**
   * Вычисляет SHA-256 хеш для файла по пути
   * @param filePath - путь к файлу
   * @returns Promise с хешем файла
   */
  static async hashFile(filePath: string): Promise<string> {
    try {
      const fileBuffer = await readFile(filePath);
      return this.hashBuffer(fileBuffer);
    } catch (error) {
      throw new Error(`Failed to hash file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Вычисляет SHA-256 хеш для буфера
   * @param buffer - буфер данных
   * @returns хеш буфера
   */
  static hashBuffer(buffer: Buffer): string {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Input must be a Buffer');
    }

    const hash = createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  }

  /**
   * Вычисляет SHA-256 хеш для строки
   * @param data - строка для хеширования
   * @returns хеш строки
   */
  static hashString(data: string): string {
    if (typeof data !== 'string') {
      throw new Error('Input must be a string');
    }

    const hash = createHash('sha256');
    hash.update(data, 'utf8');
    return hash.digest('hex');
  }

  /**
   * Проверяет, является ли строка валидным SHA-256 хешем
   * @param hash - строка для проверки
   * @returns true если строка является валидным SHA-256 хешем
   */
  static isValidHash(hash: string): boolean {
    if (typeof hash !== 'string') {
      return false;
    }

    // SHA-256 хеш должен быть 64 символа длиной и содержать только hex символы
    const sha256Regex = /^[a-f0-9]{64}$/i;
    return sha256Regex.test(hash);
  }

  /**
   * Сравнивает два хеша на равенство
   * @param hash1 - первый хеш
   * @param hash2 - второй хеш
   * @returns true если хеши равны
   */
  static compareHashes(hash1: string, hash2: string): boolean {
    if (!this.isValidHash(hash1) || !this.isValidHash(hash2)) {
      return false;
    }

    return hash1.toLowerCase() === hash2.toLowerCase();
  }

  /**
   * Генерирует короткий хеш для использования в именах файлов
   * @param data - данные для хеширования (строка или буфер)
   * @param length - длина короткого хеша (по умолчанию 8)
   * @returns короткий хеш
   */
  static generateShortHash(data: string | Buffer, length: number = 8): string {
    let hash: string;

    if (Buffer.isBuffer(data)) {
      hash = this.hashBuffer(data);
    } else if (typeof data === 'string') {
      hash = this.hashString(data);
    } else {
      throw new Error('Input must be a string or Buffer');
    }

    if (length < 1 || length > 64) {
      throw new Error('Length must be between 1 and 64');
    }

    return hash.substring(0, length);
  }
}
