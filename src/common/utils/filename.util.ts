import { HashUtil } from './hash.util.js'

export class FilenameUtil {
  private static readonly MAX_FILENAME_LENGTH = 255
  private static readonly FORBIDDEN_CHARS_REPLACE = /[<>:"/\\|?*\x00-\x1f]/g
  private static readonly FORBIDDEN_CHARS_TEST = /[<>:"/\\|?*\x00-\x1f]/

  private static randomUUID(): string {
    const cryptoAny = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined
    if (cryptoAny?.randomUUID) return cryptoAny.randomUUID()

    const hex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
    hex[6] = (hex[6] & 0x0f) | 0x40
    hex[8] = (hex[8] & 0x3f) | 0x80
    const toHex = (b: number) => b.toString(16).padStart(2, '0')
    const s = hex.map(toHex).join('')
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
  }

  public static generateSafeFilename(originalName: string, hash: string): string {
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
    const uuid = this.randomUUID().replace(/-/g, '').substring(0, 8)
    return `${shortName}_${uuid}${extension}`
  }

  public static getFileExtension(filename: string): string {
    if (!filename || typeof filename !== 'string') return ''
    const lastDot = filename.lastIndexOf('.')
    if (lastDot <= 0) return ''
    const ext = filename.slice(lastDot)
    // guard against path-ish cases
    if (ext.includes('/') || ext.includes('\\')) return ''
    return ext.toLowerCase()
  }

  public static removeExtension(filename: string): string {
    if (!filename || typeof filename !== 'string') return ''
    const ext = this.getFileExtension(filename)
    const base = this.basename(filename)
    if (!ext) return base
    return base.slice(0, Math.max(0, base.length - ext.length))
  }

  public static basename(input: string): string {
    const normalized = input.replace(/\\/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : ''
  }

  public static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') return ''

    let sanitized = filename.replace(/[^\p{L}\p{N}._-]/gu, '_')
    sanitized = sanitized.replace(/_+/g, '_')
    sanitized = sanitized.replace(/^_+|_+$/g, '')
    if (!sanitized) sanitized = 'file'
    return sanitized
  }

  public static isSafeFilename(filename: string): boolean {
    if (!filename || typeof filename !== 'string') return false
    if (filename.length > this.MAX_FILENAME_LENGTH) return false
    if (this.FORBIDDEN_CHARS_TEST.test(filename)) return false
    if (filename.trim().length === 0) return false
    return true
  }

  public static generateDatePath(date: Date = new Date()): string {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid date provided')
    }
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  public static createFilePath(basePath: string, datePath: string, filename: string): string {
    if (!basePath || !datePath || !filename) {
      throw new Error('All path components must be provided')
    }
    const normalizedBase = basePath.replace(/\/+$/, '')
    const normalizedDate = datePath.replace(/^\/+|\/+$/g, '')
    const normalizedFilename = filename.replace(/^\/+/, '')
    return `${normalizedBase}/${normalizedDate}/${normalizedFilename}`
  }

  public static parseFilePath(filePath: string): {
    directory: string
    filename: string
    basename: string
    extension: string
  } {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path must be a non-empty string')
    }

    const normalized = filePath.replace(/\\/g, '/')
    const lastSlash = normalized.lastIndexOf('/')
    const directory = lastSlash >= 0 ? normalized.slice(0, lastSlash) : ''
    const filename = this.basename(normalized)
    const extension = this.getFileExtension(filename)
    const basenameWithoutExt = this.removeExtension(filename)

    return { directory, filename, basename: basenameWithoutExt, extension }
  }

  public static isAllowedExtension(filename: string, allowedExtensions: string[]): boolean {
    if (!filename || !Array.isArray(allowedExtensions)) return false
    const extension = this.getFileExtension(filename).toLowerCase()
    const normalizedAllowed = allowedExtensions.map((ext) =>
      ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
    )
    return normalizedAllowed.includes(extension)
  }
}
