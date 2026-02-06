import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  _Object,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { ReadStream } from 'fs'
import { FileStorageProvider } from './storage-provider.interface.js'
import { StorageOperationResult } from '../../common/interfaces/storage.interface.js'

@Injectable()
export class S3StorageProvider implements FileStorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name)
  private readonly client: S3Client
  private readonly bucket: string

  constructor(private readonly configService: ConfigService) {
    const s3Config = this.configService.get('storage.s3')
    this.bucket = s3Config.bucket

    this.client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      forcePathStyle: s3Config.forcePathStyle,
    })
  }

  async saveFile(
    fileStream: any,
    key: string,
    mimeType: string
  ): Promise<StorageOperationResult<string>> {
    try {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: fileStream,
          ContentType: mimeType,
        },
      })

      await upload.done()
      return { success: true, data: key }
    } catch (error: any) {
      this.logger.error(`Failed to upload to S3: ${error.message}`, error.stack)
      return { success: false, error: `S3 upload failed: ${error.message}` }
    }
  }

  async readFile(key: string): Promise<StorageOperationResult<Buffer>> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
      const response = await this.client.send(command)
      const stream = response.Body as any
      const chunks: any[] = []
      
      for await (const chunk of stream) {
        chunks.push(chunk)
      }
      
      return { success: true, data: Buffer.concat(chunks) }
    } catch (error: any) {
      this.logger.error(`Failed to read from S3: ${error.message}`, error.stack)
      return { success: false, error: `S3 read failed: ${error.message}` }
    }
  }

  async createReadStream(key: string): Promise<StorageOperationResult<any>> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
      const response = await this.client.send(command)
      return { success: true, data: response.Body }
    } catch (error: any) {
      this.logger.error(`Failed to create S3 read stream: ${error.message}`, error.stack)
      return { success: false, error: `S3 stream creation failed: ${error.message}` }
    }
  }

  async deleteFile(key: string): Promise<StorageOperationResult<void>> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
      await this.client.send(command)
      return { success: true }
    } catch (error: any) {
      this.logger.error(`Failed to delete from S3: ${error.message}`, error.stack)
      return { success: false, error: `S3 deletion failed: ${error.message}` }
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({
        Bucket: this.bucket,
      })
      await this.client.send(command)
      return true
    } catch (error: any) {
      this.logger.error(`S3 health check failed: ${error.message}`)
      return false
    }
  }

  async listAllKeys(): Promise<string[]> {
    const keys: string[] = []
    let continuationToken: string | undefined

    try {
      do {
        const command: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: this.bucket,
          ContinuationToken: continuationToken,
        })
        const response = await this.client.send(command)
        
        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key) keys.push(obj.Key)
          }
        }
        
        continuationToken = response.NextContinuationToken
      } while (continuationToken)

      return keys
    } catch (error: any) {
      this.logger.error(`Failed to list S3 objects: ${error.message}`, error.stack)
      return []
    }
  }
}
