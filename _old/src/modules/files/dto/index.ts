/**
 * Экспорт всех DTO классов для модуля файлов
 */

// DTO для загрузки файлов
export { UploadFileDto, FileValidationDto, UpdateFileMetadataDto } from './upload-file.dto';

// DTO для ответов API
export {
  FileResponseDto,
  UploadFileResponseDto,
  GetFileInfoResponseDto,
  DeleteFileResponseDto,
  ListFilesResponseDto,
  FileStatsResponseDto,
  BaseApiResponseDto,
} from './file-response.dto';

// DTO для health check
export {
  HealthStatus,
  HealthCheckDto,
  StorageHealthDto,
  HealthResponseDto,
  DetailedHealthResponseDto,
  HealthErrorResponseDto,
} from './health-response.dto';
