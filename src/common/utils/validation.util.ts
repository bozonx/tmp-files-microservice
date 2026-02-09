import type { FileInfo, UploadedFile } from '../interfaces/file.interface.js'

export class ValidationUtil {
  private static readonly DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024
  private static readonly MIN_TTL_MIN = 1 * 60
  private static readonly DEFAULT_MAX_TTL = 31 * 24 * 60 * 60

  public static validateUploadedFile(
    file: UploadedFile,
    options: {
      allowedMimeTypes?: string[]
      blockExecutables?: boolean
      blockArchives?: boolean
      maxFileSize?: number
    } = {}
  ): { isValid: boolean; errors: string[] } {
    const {
      allowedMimeTypes = [],
      blockExecutables = false,
      blockArchives = false,
      maxFileSize = this.DEFAULT_MAX_FILE_SIZE,
    } = options
    const errors: string[] = []

    if (!file) {
      errors.push('File is required')
      return { isValid: false, errors }
    }

    if (
      !file.originalname ||
      typeof file.originalname !== 'string' ||
      file.originalname.trim() === ''
    ) {
      errors.push('Original filename is required')
    }

    if (typeof file.size !== 'number' || (file.size <= 0 && !file.stream)) {
      errors.push('File size must be a positive number')
    } else if (file.size > maxFileSize) {
      errors.push(`File size exceeds maximum allowed size of ${maxFileSize} bytes`)
    }

    if (!file.mimetype || typeof file.mimetype !== 'string' || file.mimetype.trim() === '') {
      errors.push('MIME type is required')
    } else {
      if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
        errors.push(`MIME type '${file.mimetype}' is not allowed`)
      }

      const filename = file.originalname.toLowerCase()

      if (blockExecutables && this.isExecutable(file.mimetype, filename)) {
        errors.push('Executable files are not allowed')
      }

      if (blockArchives && this.isArchive(file.mimetype, filename)) {
        errors.push('Archive files are not allowed')
      }
    }

    if (!file.stream) {
      errors.push('File stream is required')
    }

    return { isValid: errors.length === 0, errors }
  }

  public static validateTTL(
    ttl: number,
    minTtl: number = this.MIN_TTL_MIN,
    maxTtl: number = this.DEFAULT_MAX_TTL
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (typeof ttl !== 'number') {
      errors.push('TTL must be a number')
    } else if (!Number.isInteger(ttl)) {
      errors.push('TTL must be an integer')
    } else if (ttl < minTtl) {
      errors.push(`TTL must be at least ${minTtl} seconds`)
    } else if (ttl > maxTtl) {
      errors.push(
        `TTL must not exceed ${maxTtl} seconds (MAX_TTL_MIN: ${Math.floor(maxTtl / 60)} minutes)`
      )
    }

    return { isValid: errors.length === 0, errors }
  }

  public static validateFileId(id: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!id || typeof id !== 'string') {
      errors.push('File ID is required and must be a string')
    } else if (id.trim().length === 0) {
      errors.push('File ID cannot be empty')
    } else if (id.length > 255) {
      errors.push('File ID is too long')
    } else if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      errors.push('File ID must contain only alphanumeric characters, hyphens, and underscores')
    }

    return { isValid: errors.length === 0, errors }
  }

  public static validateMetadata(metadata: Record<string, unknown>): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (metadata === null || metadata === undefined) {
      return { isValid: true, errors: [] }
    }

    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      errors.push('Metadata must be an object')
      return { isValid: false, errors }
    }

    const keys = Object.keys(metadata)
    if (keys.length > 50) {
      errors.push('Metadata cannot have more than 50 keys')
    }

    for (const [key, value] of Object.entries(metadata)) {
      if (typeof key !== 'string' || key.length === 0) {
        errors.push('Metadata keys must be non-empty strings')
        continue
      }

      if (key.length > 100) {
        errors.push(`Metadata key '${key}' is too long`)
      }

      if (
        value !== null &&
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean' &&
        !Array.isArray(value)
      ) {
        errors.push(`Metadata value for key '${key}' must be a string, number, boolean, or null`)
      }

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== 'string') {
            errors.push(`Metadata array value for key '${key}' at index ${i} must be a string`)
          }
        }
      }

      if (typeof value === 'string' && value.length > 1000) {
        errors.push(`Metadata value for key '${key}' is too long`)
      }
    }

    return { isValid: errors.length === 0, errors }
  }

  public static validateFileInfo(fileInfo: FileInfo): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!fileInfo || typeof fileInfo !== 'object') {
      errors.push('File info is required and must be an object')
      return { isValid: false, errors }
    }

    const idValidation = this.validateFileId(fileInfo.id)
    if (!idValidation.isValid) {
      errors.push(...idValidation.errors)
    }

    if (!fileInfo.originalName || typeof fileInfo.originalName !== 'string') {
      errors.push('Original name is required')
    }

    if (!fileInfo.storedName || typeof fileInfo.storedName !== 'string') {
      errors.push('Stored name is required')
    }

    if (!fileInfo.mimeType || typeof fileInfo.mimeType !== 'string') {
      errors.push('MIME type is required')
    }

    if (typeof fileInfo.size !== 'number' || fileInfo.size <= 0) {
      errors.push('Size must be a positive number')
    }

    if (!fileInfo.hash || typeof fileInfo.hash !== 'string') {
      errors.push('Hash is required')
    }

    if (!(fileInfo.uploadedAt instanceof Date)) {
      errors.push('Uploaded at must be a Date object')
    }

    if (typeof fileInfo.ttl !== 'number' || fileInfo.ttl <= 0) {
      errors.push('TTL must be a positive number')
    }

    if (!(fileInfo.expiresAt instanceof Date)) {
      errors.push('Expires at must be a Date object')
    }

    if (!fileInfo.filePath || typeof fileInfo.filePath !== 'string') {
      errors.push('File path is required')
    }

    if (fileInfo.metadata) {
      const metadataValidation = this.validateMetadata(fileInfo.metadata)
      if (!metadataValidation.isValid) {
        errors.push(...metadataValidation.errors)
      }
    }

    return { isValid: errors.length === 0, errors }
  }

  public static isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  public static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  public static isValidURL(url: string): boolean {
    if (!url || typeof url !== 'string') return false
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private static isExecutable(mimeType: string, filename: string): boolean {
    const exeMimes = [
      'application/x-msdownload',
      'application/x-sh',
      'application/x-bash',
      'application/x-executable',
      'application/x-mach-binary',
      'application/vnd.microsoft.portable-executable',
    ]
    const exeExts = ['.exe', '.bat', '.sh', '.cmd', '.bin', '.msi', '.jar']

    return exeMimes.includes(mimeType) || exeExts.some((ext) => filename.endsWith(ext))
  }

  private static isArchive(mimeType: string, filename: string): boolean {
    const archiveMimes = [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/x-gzip',
      'application/x-bzip2',
      'application/x-xz',
      'application/x-compress',
    ]
    const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.z']

    return archiveMimes.includes(mimeType) || archiveExts.some((ext) => filename.endsWith(ext))
  }
}
