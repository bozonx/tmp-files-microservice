import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateUtil } from '@common/utils/date.util';
import { StorageService } from '@modules/storage/storage.service';
import { ValidationUtil } from '@common/utils/validation.util';
import { UploadedFile, FileInfo } from '@common/interfaces/file.interface';
import type { AppConfig } from '@config/app.config';

interface UploadFileParams {
  file: UploadedFile;
  ttl: number;
  metadata?: Record<string, any>;
  allowDuplicate?: boolean;
  customFilename?: string;
}

interface GetFileInfoParams { fileId: string; includeExpired?: boolean }
interface DownloadFileParams { fileId: string; includeExpired?: boolean }
interface DeleteFileParams { fileId: string; force?: boolean }

export interface FileResponse {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  ttl: number;
  expiresAt: string;
  metadata?: Record<string, any>;
  hash: string;
  isExpired: boolean;
  timeRemaining: number;
}

export interface UploadFileResponse {
  file: FileResponse;
  downloadUrl: string;
  infoUrl: string;
  deleteUrl: string;
  message: string;
}

export interface GetFileInfoResponse { file: FileResponse; downloadUrl: string; deleteUrl: string }
export interface DeleteFileResponse { fileId: string; message: string; deletedAt: string }

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(private readonly storageService: StorageService, private readonly configService: ConfigService) {
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE_MB', 100) * 1024 * 1024;
    this.allowedMimeTypes = this.configService.get<string[]>('ALLOWED_MIME_TYPES', []);
  }

  private generateApiUrl(endpoint: string, params: Record<string, string> = {}): string {
    const appCfg = this.configService.get<AppConfig>('app')!;
    const prefix = `${appCfg.apiBasePath}/${appCfg.apiVersion}`;
    let url = `/${prefix}/${endpoint}`;
    Object.entries(params).forEach(([k, v]) => (url = url.replace(`:${k}`, v)));
    return url;
  }

  async uploadFile(params: UploadFileParams): Promise<UploadFileResponse> {
    const startTime = Date.now();
    try {
      this.logger.log(`Starting file upload: ${params.file.originalname}`);

      const v = ValidationUtil.validateUploadedFile(params.file, this.allowedMimeTypes, this.maxFileSize);
      if (!v.isValid) throw new BadRequestException(`File validation failed: ${v.errors.join(', ')}`);

      const storageCfg = this.configService.get('storage') as any;
      const ttlValidation = ValidationUtil.validateTTL(params.ttl, 60, storageCfg?.maxTtl ?? 30 * 24 * 3600);
      if (!ttlValidation.isValid) throw new BadRequestException(`TTL validation failed: ${ttlValidation.errors.join(', ')}`);

      if (params.metadata) {
        const mv = ValidationUtil.validateMetadata(params.metadata);
        if (!mv.isValid) throw new BadRequestException(`Metadata validation failed: ${mv.errors.join(', ')}`);
      }

      const saveResult = await this.storageService.saveFile({ file: params.file, ttl: params.ttl, metadata: params.metadata });
      if (!saveResult.success) throw new InternalServerErrorException(`Failed to save file: ${saveResult.error}`);

      const fileInfo = saveResult.data as FileInfo;
      const respFile = this.toFileResponse(fileInfo);

      return {
        file: respFile,
        downloadUrl: this.generateApiUrl('files/:id/download', { id: fileInfo.id }),
        infoUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
        deleteUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
        message: 'File uploaded successfully',
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`File upload failed: ${error.message} (${executionTime}ms)`, error.stack);
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(`File upload failed: ${error.message}`);
    }
  }

  async getFileInfo(params: GetFileInfoParams): Promise<GetFileInfoResponse> {
    const startTime = Date.now();
    try {
      const idValidation = ValidationUtil.validateFileId(params.fileId);
      if (!idValidation.isValid) throw new BadRequestException(`File ID validation failed: ${idValidation.errors.join(', ')}`);

      const fileResult = await this.storageService.getFileInfo(params.fileId);
      if (!fileResult.success) {
        if (fileResult.error?.includes('not found')) throw new NotFoundException(`File with ID ${params.fileId} not found`);
        if (fileResult.error?.includes('expired')) throw new NotFoundException(`File with ID ${params.fileId} has expired`);
        throw new InternalServerErrorException(`Failed to get file info: ${fileResult.error}`);
      }

      const fileInfo = fileResult.data as FileInfo;
      const fileResponse = this.toFileResponse(fileInfo);
      return {
        file: fileResponse,
        downloadUrl: this.generateApiUrl('files/:id/download', { id: fileInfo.id }),
        deleteUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Get file info failed: ${error.message} (${executionTime}ms)`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(`Get file info failed: ${error.message}`);
    }
  }

  async downloadFile(params: DownloadFileParams): Promise<{ buffer: Buffer; fileInfo: FileInfo }> {
    const startTime = Date.now();
    try {
      const idValidation = ValidationUtil.validateFileId(params.fileId);
      if (!idValidation.isValid) throw new BadRequestException(`File ID validation failed: ${idValidation.errors.join(', ')}`);

      const fileResult = await this.storageService.getFileInfo(params.fileId);
      if (!fileResult.success) {
        if (fileResult.error?.includes('not found')) throw new NotFoundException(`File with ID ${params.fileId} not found`);
        if (fileResult.error?.includes('expired') && !params.includeExpired) throw new NotFoundException(`File with ID ${params.fileId} has expired`);
        throw new InternalServerErrorException(`Failed to get file info: ${fileResult.error}`);
      }
      const fileInfo = fileResult.data as FileInfo;

      const readResult = await this.storageService.readFile(params.fileId);
      if (!readResult.success) throw new InternalServerErrorException(`Failed to read file: ${readResult.error}`);

      return { buffer: readResult.data as Buffer, fileInfo };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`File download failed: ${error.message} (${executionTime}ms)`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(`File download failed: ${error.message}`);
    }
  }

  async deleteFile(params: DeleteFileParams): Promise<DeleteFileResponse> {
    const startTime = Date.now();
    try {
      const idValidation = ValidationUtil.validateFileId(params.fileId);
      if (!idValidation.isValid) throw new BadRequestException(`File ID validation failed: ${idValidation.errors.join(', ')}`);

      const fileResult = await this.storageService.getFileInfo(params.fileId);
      if (!fileResult.success) {
        if (fileResult.error?.includes('not found')) throw new NotFoundException(`File with ID ${params.fileId} not found`);
        if (fileResult.error?.includes('expired') && !params.force) throw new NotFoundException(`File with ID ${params.fileId} has expired`);
        if (!fileResult.error?.includes('expired')) throw new InternalServerErrorException(`Failed to get file info: ${fileResult.error}`);
      }

      const deleteResult = await this.storageService.deleteFile(params.fileId);
      if (!deleteResult.success) throw new InternalServerErrorException(`Failed to delete file: ${deleteResult.error}`);

      const fileInfo = deleteResult.data as FileInfo;
      return { fileId: fileInfo.id, message: 'File deleted successfully', deletedAt: new Date().toISOString() };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`File deletion failed: ${error.message} (${executionTime}ms)`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(`File deletion failed: ${error.message}`);
    }
  }

  async listFiles(params: { mimeType?: string; minSize?: number; maxSize?: number; uploadedAfter?: Date; uploadedBefore?: Date; expiredOnly?: boolean; limit?: number; offset?: number; }): Promise<{ files: FileResponse[]; total: number; pagination: any }> {
    try {
      const searchResult = await this.storageService.searchFiles(params);
      const files = searchResult.files.map((f) => this.toFileResponse(f));
      const pagination = {
        page: Math.floor((params.offset || 0) / (params.limit || 10)) + 1,
        limit: params.limit || 10,
        totalPages: Math.ceil(searchResult.total / (params.limit || 10)),
        hasNext: (params.offset || 0) + (params.limit || 10) < searchResult.total,
        hasPrev: (params.offset || 0) > 0,
      };
      return { files, total: searchResult.total, pagination };
    } catch (error: any) {
      throw new InternalServerErrorException(`List files failed: ${error.message}`);
    }
  }

  async getFileStats(): Promise<{ stats: any; generatedAt: string }> {
    const startTime = Date.now();
    try {
      const stats = await this.storageService.getFileStats();
      return { stats, generatedAt: new Date().toISOString() };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Get file stats failed: ${error.message} (${executionTime}ms)`, error.stack);
      throw new InternalServerErrorException(`Get file stats failed: ${error.message}`);
    }
  }

  async fileExists(fileId: string, includeExpired: boolean = false): Promise<boolean> {
    try {
      const fileResult = await this.storageService.getFileInfo(fileId);
      if (!fileResult.success) return false;
      if ((fileResult as any).error?.includes('expired') && !includeExpired) return false;
      return true;
    } catch (error: any) {
      this.logger.error(`File exists check failed: ${error.message}`, error.stack);
      return false;
    }
  }

  private toFileResponse(fileInfo: FileInfo): FileResponse {
    const uploadedAt = typeof fileInfo.uploadedAt === 'string' ? new Date(fileInfo.uploadedAt) : fileInfo.uploadedAt;
    const expiresAt = typeof fileInfo.expiresAt === 'string' ? new Date(fileInfo.expiresAt) : fileInfo.expiresAt;
    return {
      id: fileInfo.id,
      originalName: fileInfo.originalName,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      uploadedAt: uploadedAt.toISOString(),
      ttl: fileInfo.ttl,
      expiresAt: expiresAt.toISOString(),
      metadata: fileInfo.metadata,
      hash: fileInfo.hash,
      isExpired: DateUtil.isExpired(expiresAt),
      timeRemaining: Math.max(0, DateUtil.diffInSeconds(expiresAt, DateUtil.now().toDate())),
    };
  }
}
