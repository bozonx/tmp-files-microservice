import { registerAs } from '@nestjs/config'

export interface StorageAppConfig {
  basePath: string
  maxFileSize: number
  allowedMimeTypes: string[]
  enableDeduplication: boolean
  maxTtl: number
}

function parseAllowedMimeTypes(input?: string): string[] {
  if (!input || input.trim() === '') return []
  // Try JSON array first for backward compatibility
  try {
    const parsed = JSON.parse(input)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((v) => typeof v === 'string')
        .map((v) => v.trim())
        .filter((v) => v !== '')
    }
  } catch {
    // ignore and fallback to CSV parsing
  }
  // Fallback: comma-separated list
  return input
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

export default registerAs('storage', (): StorageAppConfig => {
  const dir = process.env.STORAGE_DIR?.trim()
  if (!dir) {
    throw new Error('Storage config validation error: STORAGE_DIR environment variable is required')
  }
  return {
    basePath: dir,
    maxFileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) || 100) * 1024 * 1024,
    allowedMimeTypes: parseAllowedMimeTypes(process.env.ALLOWED_MIME_TYPES),
    enableDeduplication: process.env.ENABLE_DEDUPLICATION !== 'false',
    maxTtl: (parseInt(process.env.MAX_TTL_MIN || '44640', 10) || 44640) * 60,
  }
})
