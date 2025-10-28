import { registerAs } from '@nestjs/config';
import {
  IsString,
  IsArray,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
  validateSync,
} from 'class-validator';
import { plainToClass } from 'class-transformer';

export class SttConfig {
  @IsString()
  public defaultProvider!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  public allowedProviders!: string[];

  @IsInt()
  @Min(1)
  @Max(1000)
  public maxFileMb!: number;

  @IsInt()
  @Min(1)
  @Max(300)
  public requestTimeoutSec!: number;

  @IsInt()
  @Min(100)
  @Max(10000)
  public pollIntervalMs!: number;

  @IsInt()
  @Min(1)
  @Max(60)
  public maxSyncWaitMin!: number;

  @IsBoolean()
  public allowCustomApiKey!: boolean;

  @IsOptional()
  @IsString()
  public assemblyAiApiKey?: string;
}

export default registerAs('stt', (): SttConfig => {
  const config = plainToClass(SttConfig, {
    defaultProvider: process.env.STT_DEFAULT_PROVIDER ?? 'assemblyai',
    allowedProviders: (process.env.STT_ALLOWED_PROVIDERS ?? 'assemblyai')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    maxFileMb: parseInt(process.env.STT_MAX_FILE_SIZE_MB ?? '100', 10),
    requestTimeoutSec: parseInt(process.env.STT_REQUEST_TIMEOUT_SEC ?? '15', 10),
    pollIntervalMs: parseInt(process.env.STT_POLL_INTERVAL_MS ?? '1500', 10),
    maxSyncWaitMin: parseInt(process.env.STT_MAX_SYNC_WAIT_MIN ?? '3', 10),
    allowCustomApiKey: (process.env.ALLOW_CUSTOM_API_KEY ?? 'false') === 'true',
    assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY,
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`STT config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});
