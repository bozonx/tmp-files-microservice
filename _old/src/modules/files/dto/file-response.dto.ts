import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { IsString, IsNumber, IsObject, IsOptional, IsDateString, IsBoolean } from 'class-validator';

/**
 * DTO для ответа с информацией о файле
 * Используется для возврата информации о файле в API ответах
 */
export class FileResponseDto {
  @ApiProperty({
    description: 'Unique file identifier',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @Expose()
  @IsString({ message: 'File ID must be a string' })
  id: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'document.pdf',
  })
  @Expose()
  @IsString({ message: 'Original name must be a string' })
  originalName: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  @Expose()
  @IsString({ message: 'MIME type must be a string' })
  mimeType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1024000,
  })
  @Expose()
  @IsNumber({}, { message: 'File size must be a number' })
  size: number;

  @ApiProperty({
    description: 'Upload timestamp in ISO format',
    example: '2024-01-15T10:30:00.000Z',
  })
  @Expose()
  @IsDateString({}, { message: 'Upload date must be a valid ISO date string' })
  uploadedAt: string;

  @ApiProperty({
    description: 'Time to live in seconds',
    example: 3600,
  })
  @Expose()
  @IsNumber({}, { message: 'TTL must be a number' })
  ttl: number;

  @ApiProperty({
    description: 'Expiration timestamp in ISO format',
    example: '2024-01-15T11:30:00.000Z',
  })
  @Expose()
  @IsDateString({}, { message: 'Expiration date must be a valid ISO date string' })
  expiresAt: string;

  @ApiPropertyOptional({
    description: 'Additional file metadata',
    type: 'object',
    additionalProperties: true,
    example: { description: 'Important document', category: 'work' },
  })
  @Expose()
  @IsOptional()
  @IsObject({ message: 'Metadata must be an object' })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'SHA-256 hash of the file for deduplication',
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  })
  @Expose()
  @IsString({ message: 'File hash must be a string' })
  hash: string;

  @ApiProperty({
    description: 'Whether the file is expired',
    example: false,
  })
  @Expose()
  @IsBoolean({ message: 'Is expired must be a boolean' })
  @Transform(({ obj }) => {
    // Вычисляем истек ли файл на основе expiresAt
    if (obj.expiresAt) {
      return new Date(obj.expiresAt) < new Date();
    }
    return false;
  })
  isExpired: boolean;

  @ApiProperty({
    description: 'Time remaining until expiration in seconds',
    example: 1800,
  })
  @Expose()
  @IsNumber({}, { message: 'Time remaining must be a number' })
  @Transform(({ obj }) => {
    // Вычисляем оставшееся время до истечения
    if (obj.expiresAt) {
      const remaining = Math.max(
        0,
        Math.floor((new Date(obj.expiresAt).getTime() - new Date().getTime()) / 1000),
      );
      return remaining;
    }
    return 0;
  })
  timeRemaining: number;
}

/**
 * DTO для ответа при загрузке файла
 */
export class UploadFileResponseDto {
  @ApiProperty({
    description: 'Information about the uploaded file',
    type: FileResponseDto,
  })
  @Expose()
  @Type(() => FileResponseDto)
  file: FileResponseDto;

  @ApiProperty({
    description: 'URL for downloading the file',
    example: '/api/v1/files/f47ac10b-58cc-4372-a567-0e02b2c3d479/download',
  })
  @Expose()
  @IsString({ message: 'Download URL must be a string' })
  downloadUrl: string;

  @ApiProperty({
    description: 'URL for getting file information',
    example: '/api/v1/files/f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @Expose()
  @IsString({ message: 'Info URL must be a string' })
  infoUrl: string;

  @ApiProperty({
    description: 'URL for deleting the file',
    example: '/api/v1/files/f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @Expose()
  @IsString({ message: 'Delete URL must be a string' })
  deleteUrl: string;

  @ApiProperty({
    description: 'Success message',
    example: 'File uploaded successfully',
  })
  @Expose()
  @IsString({ message: 'Message must be a string' })
  message: string;
}

/**
 * DTO для ответа при получении информации о файле
 */
export class GetFileInfoResponseDto {
  @ApiProperty({
    description: 'Information about the file',
    type: FileResponseDto,
  })
  @Expose()
  @Type(() => FileResponseDto)
  file: FileResponseDto;

  @ApiProperty({
    description: 'URL for downloading the file',
    example: '/api/v1/files/f47ac10b-58cc-4372-a567-0e02b2c3d479/download',
  })
  @Expose()
  @IsString({ message: 'Download URL must be a string' })
  downloadUrl: string;

  @ApiProperty({
    description: 'URL for deleting the file',
    example: '/api/v1/files/f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @Expose()
  @IsString({ message: 'Delete URL must be a string' })
  deleteUrl: string;
}

/**
 * DTO для ответа при удалении файла
 */
export class DeleteFileResponseDto {
  @ApiProperty({
    description: 'ID of the deleted file',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @Expose()
  @IsString({ message: 'File ID must be a string' })
  fileId: string;

  @ApiProperty({
    description: 'Success message',
    example: 'File deleted successfully',
  })
  @Expose()
  @IsString({ message: 'Message must be a string' })
  message: string;

  @ApiProperty({
    description: 'Deletion timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  @Expose()
  @IsDateString({}, { message: 'Deleted at must be a valid ISO date string' })
  deletedAt: string;
}

/**
 * DTO для ответа при получении списка файлов
 */
export class ListFilesResponseDto {
  @ApiProperty({
    description: 'List of files',
    type: [FileResponseDto],
  })
  @Expose()
  @Type(() => FileResponseDto)
  files: FileResponseDto[];

  @ApiProperty({
    description: 'Total number of files',
    example: 150,
  })
  @Expose()
  @IsNumber({}, { message: 'Total must be a number' })
  total: number;

  @ApiProperty({
    description: 'Pagination information',
    type: 'object',
    additionalProperties: true,
  })
  @Expose()
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * DTO для ответа при получении статистики
 */
export class FileStatsResponseDto {
  @ApiProperty({
    description: 'Total number of files',
    example: 150,
  })
  @Expose()
  @IsNumber({}, { message: 'Total files must be a number' })
  totalFiles: number;

  @ApiProperty({
    description: 'Total size of all files in bytes',
    example: 1073741824,
  })
  @Expose()
  @IsNumber({}, { message: 'Total size must be a number' })
  totalSize: number;

  @ApiProperty({
    description: 'Number of files by MIME type',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { 'application/pdf': 50, 'image/jpeg': 30, 'text/plain': 20 },
  })
  @Expose()
  @IsObject({ message: 'Files by MIME type must be an object' })
  filesByMimeType: Record<string, number>;

  @ApiProperty({
    description: 'Number of files by upload date',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { '2024-01-15': 25, '2024-01-14': 30, '2024-01-13': 20 },
  })
  @Expose()
  @IsObject({ message: 'Files by date must be an object' })
  filesByDate: Record<string, number>;

  @ApiProperty({
    description: 'Statistics generation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  @Expose()
  @IsDateString({}, { message: 'Generated at must be a valid ISO date string' })
  generatedAt: string;
}

/**
 * DTO для базового API ответа
 */
export class BaseApiResponseDto<T = any> {
  @ApiProperty({
    description: 'Operation success status',
    example: true,
  })
  @Expose()
  @IsBoolean({ message: 'Success must be a boolean' })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Response data',
  })
  @Expose()
  @IsOptional()
  data?: T;

  @ApiPropertyOptional({
    description: 'Error message',
    example: 'File not found',
  })
  @Expose()
  @IsOptional()
  @IsString({ message: 'Error message must be a string' })
  error?: string;

  @ApiPropertyOptional({
    description: 'Error code',
    example: 'FILE_NOT_FOUND',
  })
  @Expose()
  @IsOptional()
  @IsString({ message: 'Error code must be a string' })
  errorCode?: string;

  @ApiPropertyOptional({
    description: 'Request execution time in milliseconds',
    example: 150,
  })
  @Expose()
  @IsOptional()
  @IsNumber({}, { message: 'Execution time must be a number' })
  executionTime?: number;

  @ApiPropertyOptional({
    description: 'Request metadata',
    type: 'object',
    additionalProperties: true,
  })
  @Expose()
  @IsOptional()
  @IsObject({ message: 'Metadata must be an object' })
  metadata?: {
    timestamp: string;
    version: string;
    requestId?: string;
  };
}
