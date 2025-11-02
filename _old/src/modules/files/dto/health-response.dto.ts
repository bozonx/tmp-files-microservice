import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { IsString, IsNumber, IsObject, IsOptional, IsDateString, IsEnum } from 'class-validator';

/**
 * Статусы здоровья компонентов
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
}

/**
 * DTO для результата проверки здоровья компонента
 */
export class HealthCheckDto {
  @ApiProperty({
    description: 'Component health status',
    enum: HealthStatus,
    example: HealthStatus.HEALTHY,
  })
  @Expose()
  @IsEnum(HealthStatus, { message: 'Status must be one of: healthy, unhealthy, degraded' })
  status: HealthStatus;

  @ApiPropertyOptional({
    description: 'Status message',
    example: 'Component is working normally',
  })
  @Expose()
  @IsOptional()
  @IsString({ message: 'Message must be a string' })
  message?: string;

  @ApiProperty({
    description: 'Last check timestamp in ISO format',
    example: '2024-01-15T10:30:00.000Z',
  })
  @Expose()
  @IsDateString({}, { message: 'Last checked must be a valid ISO date string' })
  lastChecked: string;

  @ApiPropertyOptional({
    description: 'Response time in milliseconds',
    example: 15,
  })
  @Expose()
  @IsOptional()
  @IsNumber({}, { message: 'Response time must be a number' })
  responseTime?: number;

  @ApiPropertyOptional({
    description: 'Additional component details',
    type: 'object',
    additionalProperties: true,
    example: { version: '1.0.0', uptime: 3600 },
  })
  @Expose()
  @IsOptional()
  @IsObject({ message: 'Details must be an object' })
  details?: Record<string, any>;
}

/**
 * DTO для информации о хранилище
 */
export class StorageHealthDto {
  @ApiProperty({
    description: 'Storage health status',
    enum: HealthStatus,
    example: HealthStatus.HEALTHY,
  })
  @Expose()
  @IsEnum(HealthStatus, { message: 'Storage status must be one of: healthy, unhealthy, degraded' })
  status: HealthStatus;

  @ApiProperty({
    description: 'Total storage space in bytes',
    example: 1073741824000,
  })
  @Expose()
  @IsNumber({}, { message: 'Total space must be a number' })
  totalSpace: number;

  @ApiProperty({
    description: 'Used storage space in bytes',
    example: 536870912000,
  })
  @Expose()
  @IsNumber({}, { message: 'Used space must be a number' })
  usedSpace: number;

  @ApiProperty({
    description: 'Available storage space in bytes',
    example: 536870912000,
  })
  @Expose()
  @IsNumber({}, { message: 'Available space must be a number' })
  @Transform(({ obj }) => {
    // Вычисляем доступное место
    return obj.totalSpace - obj.usedSpace;
  })
  availableSpace: number;

  @ApiProperty({
    description: 'Storage usage percentage',
    example: 50.0,
  })
  @Expose()
  @IsNumber({}, { message: 'Usage percentage must be a number' })
  @Transform(({ obj }) => {
    // Вычисляем процент использования
    if (obj.totalSpace > 0) {
      return Number(((obj.usedSpace / obj.totalSpace) * 100).toFixed(2));
    }
    return 0;
  })
  usagePercentage: number;

  @ApiProperty({
    description: 'Number of files in storage',
    example: 1500,
  })
  @Expose()
  @IsNumber({}, { message: 'File count must be a number' })
  fileCount: number;

  @ApiPropertyOptional({
    description: 'Storage path',
    example: '/app/storage',
  })
  @Expose()
  @IsOptional()
  @IsString({ message: 'Storage path must be a string' })
  storagePath?: string;

  @ApiPropertyOptional({
    description: 'Last cleanup timestamp',
    example: '2024-01-15T09:00:00.000Z',
  })
  @Expose()
  @IsOptional()
  @IsDateString({}, { message: 'Last cleanup must be a valid ISO date string' })
  lastCleanup?: string;

  @ApiPropertyOptional({
    description: 'Storage details',
    type: 'object',
    additionalProperties: true,
    example: { filesystem: 'ext4', mountPoint: '/app' },
  })
  @Expose()
  @IsOptional()
  @IsObject({ message: 'Storage details must be an object' })
  details?: Record<string, any>;
}

/**
 * DTO для ответа health check
 */
export class HealthResponseDto {
  @ApiProperty({
    description: 'Overall application health status',
    enum: HealthStatus,
    example: HealthStatus.HEALTHY,
  })
  @Expose()
  @IsEnum(HealthStatus, { message: 'Status must be one of: healthy, unhealthy, degraded' })
  status: HealthStatus;

  @ApiProperty({
    description: 'Application uptime in seconds',
    example: 3600,
  })
  @Expose()
  @IsNumber({}, { message: 'Uptime must be a number' })
  uptime: number;

  @ApiProperty({
    description: 'Application version',
    example: '1.0.0',
  })
  @Expose()
  @IsString({ message: 'Version must be a string' })
  version: string;

  @ApiProperty({
    description: 'Storage health information',
    type: StorageHealthDto,
  })
  @Expose()
  @Type(() => StorageHealthDto)
  storage: StorageHealthDto;

  @ApiProperty({
    description: 'Health check timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  @Expose()
  @IsDateString({}, { message: 'Timestamp must be a valid ISO date string' })
  timestamp: string;

  @ApiPropertyOptional({
    description: 'Additional health checks',
    type: 'object',
    additionalProperties: true,
  })
  @Expose()
  @IsOptional()
  @IsObject({ message: 'Checks must be an object' })
  checks?: {
    database?: HealthCheckDto;
    filesystem?: HealthCheckDto;
    memory?: HealthCheckDto;
    network?: HealthCheckDto;
  };

  @ApiPropertyOptional({
    description: 'Application environment',
    example: 'production',
  })
  @Expose()
  @IsOptional()
  @IsString({ message: 'Environment must be a string' })
  environment?: string;

  @ApiPropertyOptional({
    description: 'Node.js version',
    example: '22.0.0',
  })
  @Expose()
  @IsOptional()
  @IsString({ message: 'Node version must be a string' })
  nodeVersion?: string;

  @ApiPropertyOptional({
    description: 'Memory usage information',
    type: 'object',
    additionalProperties: true,
    example: {
      used: 134217728,
      total: 268435456,
      percentage: 50.0,
    },
  })
  @Expose()
  @IsOptional()
  @IsObject({ message: 'Memory usage must be an object' })
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };

  @ApiPropertyOptional({
    description: 'CPU usage information',
    type: 'object',
    additionalProperties: true,
    example: {
      usage: 25.5,
      loadAverage: [0.5, 0.8, 1.2],
    },
  })
  @Expose()
  @IsOptional()
  @IsObject({ message: 'CPU usage must be an object' })
  cpu?: {
    usage: number;
    loadAverage: number[];
  };
}

/**
 * DTO для детального health check ответа
 */
export class DetailedHealthResponseDto extends HealthResponseDto {
  @ApiProperty({
    description: 'Detailed component health checks',
    type: 'object',
    additionalProperties: true,
  })
  @Expose()
  @IsObject({ message: 'Component checks must be an object' })
  @Type(() => HealthCheckDto)
  componentChecks: {
    storage: HealthCheckDto;
    filesystem: HealthCheckDto;
    memory: HealthCheckDto;
    network?: HealthCheckDto;
    database?: HealthCheckDto;
  };

  @ApiProperty({
    description: 'Health check summary',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: {
      total: 4,
      healthy: 3,
      unhealthy: 1,
      degraded: 0,
    },
  })
  @Expose()
  @IsObject({ message: 'Summary must be an object' })
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };

  @ApiPropertyOptional({
    description: 'Health check recommendations',
    type: 'array',
    items: { type: 'string' },
    example: ['Consider increasing storage space', 'Monitor memory usage'],
  })
  @Expose()
  @IsOptional()
  @IsString({ each: true, message: 'Recommendations must be an array of strings' })
  recommendations?: string[];
}

/**
 * DTO для ответа при ошибке health check
 */
export class HealthErrorResponseDto {
  @ApiProperty({
    description: 'Health check status (always unhealthy for errors)',
    enum: HealthStatus,
    example: HealthStatus.UNHEALTHY,
  })
  @Expose()
  @IsEnum(HealthStatus, { message: 'Status must be one of: healthy, unhealthy, degraded' })
  status: HealthStatus;

  @ApiProperty({
    description: 'Error message',
    example: 'Failed to check storage health',
  })
  @Expose()
  @IsString({ message: 'Error message must be a string' })
  error: string;

  @ApiProperty({
    description: 'Error code',
    example: 'STORAGE_CHECK_FAILED',
  })
  @Expose()
  @IsString({ message: 'Error code must be a string' })
  errorCode: string;

  @ApiProperty({
    description: 'Error timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  @Expose()
  @IsDateString({}, { message: 'Timestamp must be a valid ISO date string' })
  timestamp: string;

  @ApiPropertyOptional({
    description: 'Additional error details',
    type: 'object',
    additionalProperties: true,
  })
  @Expose()
  @IsOptional()
  @IsObject({ message: 'Details must be an object' })
  details?: Record<string, any>;
}
