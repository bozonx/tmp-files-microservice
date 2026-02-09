export interface AppEnv {
  NODE_ENV: 'development' | 'production' | 'test'
  LISTEN_HOST: string
  LISTEN_PORT: number
  BASE_PATH: string
  LOG_LEVEL: string
  DOWNLOAD_BASE_URL: string

  MAX_FILE_SIZE_MB: number
  ALLOWED_MIME_TYPES: string[]
  ENABLE_DEDUPLICATION: boolean
  MAX_TTL_MIN: number

  S3_ENDPOINT?: string
  S3_REGION: string
  S3_BUCKET: string
  S3_ACCESS_KEY_ID: string
  S3_SECRET_ACCESS_KEY: string
  S3_FORCE_PATH_STYLE: boolean
  ENABLE_UI: boolean
}

export type RuntimeEnvSource = Record<string, unknown>

function readString(env: RuntimeEnvSource, key: string, fallback = ''): string {
  const v = env[key]
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (v === undefined || v === null) return fallback
  return fallback
}

function readInt(env: RuntimeEnvSource, key: string, fallback: number): number {
  const raw = readString(env, key, '')
  if (raw.trim() === '') return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

function readBool(env: RuntimeEnvSource, key: string, fallback: boolean): boolean {
  const raw = readString(env, key, '')
  if (raw.trim() === '') return fallback
  return raw === 'true' || raw === '1'
}

function parseAllowedMimeTypes(input: string): string[] {
  const trimmed = input.trim()
  if (trimmed === '') return []

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((v) => typeof v === 'string')
        .map((v) => v.trim())
        .filter((v) => v !== '')
    }
  } catch {
    // ignore
  }

  return trimmed
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

export function loadAppEnv(envSource: RuntimeEnvSource): AppEnv {
  const nodeEnvRaw = readString(envSource, 'NODE_ENV', 'production')
  const NODE_ENV = (
    ['development', 'production', 'test'].includes(nodeEnvRaw) ? nodeEnvRaw : 'production'
  ) as AppEnv['NODE_ENV']

  const BASE_PATH = readString(envSource, 'BASE_PATH', '').replace(/^\/+|\/+$/g, '')

  const MAX_FILE_SIZE_MB = readInt(envSource, 'MAX_FILE_SIZE_MB', 100)
  const MAX_TTL_MIN = readInt(envSource, 'MAX_TTL_MIN', 44640)

  return {
    NODE_ENV,
    LISTEN_HOST: readString(envSource, 'LISTEN_HOST', '0.0.0.0'),
    LISTEN_PORT: readInt(envSource, 'LISTEN_PORT', 8080),
    BASE_PATH,
    LOG_LEVEL: readString(envSource, 'LOG_LEVEL', 'warn'),
    DOWNLOAD_BASE_URL: readString(envSource, 'DOWNLOAD_BASE_URL', '').replace(/\/+$/, ''),

    MAX_FILE_SIZE_MB,
    ALLOWED_MIME_TYPES: parseAllowedMimeTypes(readString(envSource, 'ALLOWED_MIME_TYPES', '')),
    ENABLE_DEDUPLICATION: readBool(envSource, 'ENABLE_DEDUPLICATION', true),
    MAX_TTL_MIN,

    S3_ENDPOINT: readString(envSource, 'S3_ENDPOINT', '') || undefined,
    S3_REGION: readString(envSource, 'S3_REGION', 'us-east-1'),
    S3_BUCKET: readString(envSource, 'S3_BUCKET', 'tmp-files'),
    S3_ACCESS_KEY_ID: readString(envSource, 'S3_ACCESS_KEY_ID', ''),
    S3_SECRET_ACCESS_KEY: readString(envSource, 'S3_SECRET_ACCESS_KEY', ''),
    S3_FORCE_PATH_STYLE: readBool(envSource, 'S3_FORCE_PATH_STYLE', false),
    ENABLE_UI: readBool(envSource, 'ENABLE_UI', false),
  }
}
