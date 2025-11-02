import {
  IsOptional,
  IsNumber,
  IsObject,
  Min,
  Max,
  IsString,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UploadedFile } from '../../../common/interfaces/file.interface';

/**
 * DTO для загрузки файлов
 * Валидирует параметры загрузки файла через multipart/form-data
 */
export class UploadFileDto {
  @ApiProperty({
    description:
      'Time to live (TTL) for the file in seconds. Must be specified and not exceed MAX_TTL_MIN',
    minimum: 60,
    maximum: 86400 * 30, // 30 days
    example: 3600,
  })
  @IsNotEmpty({ message: 'TTL is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'TTL must be a valid number' })
  @Min(60, { message: 'TTL must be at least 60 seconds (1 minute)' })
  @Max(86400 * 30, { message: 'TTL cannot exceed 30 days (2592000 seconds)' })
  ttl: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for the file',
    type: 'object',
    additionalProperties: true,
    example: { description: 'Important document', category: 'work' },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata must be a valid object' })
  @Transform(({ value }) => {
    // Преобразуем строку JSON в объект если необходимо
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        throw new Error('Invalid JSON format for metadata');
      }
    }
    return value;
  })
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether to allow duplicate files (same hash)',
    default: true,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean({ message: 'allowDuplicate must be a boolean value' })
  allowDuplicate?: boolean = true;

  @ApiPropertyOptional({
    description: 'Custom filename for the file (optional)',
    example: 'my-document.pdf',
  })
  @IsOptional()
  @IsString({ message: 'Custom filename must be a string' })
  customFilename?: string;
}

/**
 * DTO для валидации файла в multipart запросе
 * Используется для валидации самого файла
 */
export class FileValidationDto {
  @ApiProperty({
    description: 'The file to upload',
    type: 'string',
    format: 'binary',
  })
  file: UploadedFile;

  @ApiProperty({
    description:
      'Time to live (TTL) for the file in seconds. Must be specified and not exceed MAX_TTL_MIN',
    minimum: 60,
    maximum: 86400 * 30,
    example: 3600,
  })
  @IsNotEmpty({ message: 'TTL is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'TTL must be a valid number' })
  @Min(60, { message: 'TTL must be at least 60 seconds (1 minute)' })
  @Max(86400 * 30, { message: 'TTL cannot exceed 30 days (2592000 seconds)' })
  ttl: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for the file',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject({ message: 'Metadata must be a valid object' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        throw new Error('Invalid JSON format for metadata');
      }
    }
    return value;
  })
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether to allow duplicate files (same hash)',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean({ message: 'allowDuplicate must be a boolean value' })
  allowDuplicate?: boolean = true;

  @ApiPropertyOptional({
    description: 'Custom filename for the file (optional)',
  })
  @IsOptional()
  @IsString({ message: 'Custom filename must be a string' })
  customFilename?: string;
}

/**
 * DTO для обновления метаданных файла
 */
export class UpdateFileMetadataDto {
  @ApiPropertyOptional({
    description: 'New metadata for the file',
    type: 'object',
    additionalProperties: true,
    example: { description: 'Updated document', category: 'personal' },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata must be a valid object' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        throw new Error('Invalid JSON format for metadata');
      }
    }
    return value;
  })
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'New TTL for the file in seconds',
    minimum: 60,
    maximum: 86400 * 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'TTL must be a valid number' })
  @Min(60, { message: 'TTL must be at least 60 seconds (1 minute)' })
  @Max(86400 * 30, { message: 'TTL cannot exceed 30 days (2592000 seconds)' })
  ttl?: number;
}
