import { registerAs } from '@nestjs/config';

export interface StorageAppConfig {
  basePath: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  enableDeduplication: boolean;
  maxTtl: number;
}

function parseAllowedMimeTypes(input?: string): string[] {
  if (!input || input.trim() === '') return [];
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.filter((v) => typeof v === 'string' && v.trim() !== '');
    }
  } catch {}
  return [];
}

export default registerAs('storage', (): StorageAppConfig => {
  return {
    basePath: process.env.STORAGE_DIR || './storage',
    maxFileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) || 100) * 1024 * 1024,
    allowedMimeTypes: parseAllowedMimeTypes(process.env.ALLOWED_MIME_TYPES),
    enableDeduplication: process.env.ENABLE_DEDUPLICATION !== 'false',
    maxTtl: (parseInt(process.env.MAX_TTL_MIN || '10080', 10) || 10080) * 60,
  };
});
