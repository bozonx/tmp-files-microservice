import { extname, basename, dirname } from 'path'
import { randomUUID } from 'node:crypto'
import { HashUtil } from './hash.util'

export class FilenameUtil {
  private static readonly MAX_FILENAME_LENGTH = 255
  private static readonly FORBIDDEN_CHARS_REPLACE = /[<>:"/\\|?*\x00-\x1f]/g
  private static readonly FORBIDDEN_CHARS_TEST = /[<>:"/\\|?*\x00-\x1f]/

  static generateSafeFilename(originalName: string, hash: string): string {
    if (!originalName || typeof originalName !== 'string' || originalName.trim() === '') {
      throw new Error('Original filename must be a non-empty string')
    }
    if (!HashUtil.isValidHash(hash)) {
      throw new Error('Hash must be a valid SHA-256 hash')
    }

    const extension = this.getFileExtension(originalName)
    const cleanName = this.sanitizeFilename(originalName)
    const baseName = this.removeExtension(cleanName)
    const shortName = baseName.length > 20 ? baseName.substring(0, 20) : baseName
    const uuid = randomUUID().replace(/-/g, '').substring(0, 8)
    return `${shortName}_${uuid}${extension}`
  }

  static getFileExtension(filename: string): string {
    if (!filename || typeof filename !== 'string') return ''
    const extension = extname(filename)
    return extension.toLowerCase()
  }

  static removeExtension(filename: string): string {
    if (!filename || typeof filename !== 'string') return ''
    const baseName = basename(filename, extname(filename))
    return baseName
  }

  static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') return ''

    let sanitized = filename.replace(/[^\p{L}\p{N}._-]/gu, '_')
    sanitized = sanitized.replace(/_+/g, '_')
    sanitized = sanitized.replace(/^_+|_+$/g, '')
    if (!sanitized) sanitized = 'file'
    return sanitized
  }

  static isSafeFilename(filename: string): boolean {
    if (!filename || typeof filename !== 'string') return false
    if (filename.length > this.MAX_FILENAME_LENGTH) return false
    if (this.FORBIDDEN_CHARS_TEST.test(filename)) return false
    if (filename.trim().length === 0) return false
    return true
  }

  static generateDatePath(date: Date = new Date()): string {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid date provided')
    }
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  static createFilePath(basePath: string, datePath: string, filename: string): string {
    if (!basePath || !datePath || !filename) {
      throw new Error('All path components must be provided')
    }
    const normalizedBase = basePath.replace(/\/+$/, '')
    const normalizedDate = datePath.replace(/^\/+|\/+$/g, '')
    const normalizedFilename = filename.replace(/^\/+/, '')
    return `${normalizedBase}/${normalizedDate}/${normalizedFilename}`
  }

  static parseFilePath(filePath: string): {
    directory: string
    filename: string
    basename: string
    extension: string
  } {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path must be a non-empty string')
    }

    const directory = dirname(filePath)
    const filename = basename(filePath)
    const extension = this.getFileExtension(filename)
    const basenameWithoutExt = this.removeExtension(filename)

    return { directory, filename, basename: basenameWithoutExt, extension }
  }

  static isAllowedExtension(filename: string, allowedExtensions: string[]): boolean {
    if (!filename || !Array.isArray(allowedExtensions)) return false
    const extension = this.getFileExtension(filename).toLowerCase()
    const normalizedAllowed = allowedExtensions.map((ext) =>
      ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
    )
    return normalizedAllowed.includes(extension)
  }
}
