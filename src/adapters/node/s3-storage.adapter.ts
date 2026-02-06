import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { Readable } from 'node:stream'
import type { FileStorageAdapter } from '../file-storage.adapter.js'
import type { StorageOperationResult } from '../../common/interfaces/storage.interface.js'

export interface S3StorageAdapterDeps {
  client: S3Client
  bucket: string
}

export class S3StorageAdapter implements FileStorageAdapter {
  constructor(private readonly deps: S3StorageAdapterDeps) {}

  async saveFile(
    input: ReadableStream<Uint8Array>,
    key: string,
    mimeType: string
  ): Promise<StorageOperationResult<string>> {
    try {
      const body = Readable.fromWeb(input as any)
      const upload = new Upload({
        client: this.deps.client,
        params: {
          Bucket: this.deps.bucket,
          Key: key,
          Body: body,
          ContentType: mimeType,
        },
      })

      await upload.done()
      return { success: true, data: key }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `S3 upload failed: ${err.message}` }
    }
  }

  async readFile(key: string): Promise<StorageOperationResult<Uint8Array>> {
    try {
      const cmd = new GetObjectCommand({ Bucket: this.deps.bucket, Key: key })
      const res = await this.deps.client.send(cmd)
      const body = res.Body as any
      if (!body) return { success: false, error: 'NotFound' }

      const chunks: Buffer[] = []
      for await (const chunk of body as any) {
        chunks.push(Buffer.from(chunk))
      }
      return { success: true, data: new Uint8Array(Buffer.concat(chunks)) }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `S3 read failed: ${err.message}` }
    }
  }

  async createReadStream(key: string): Promise<StorageOperationResult<ReadableStream<Uint8Array>>> {
    try {
      const cmd = new GetObjectCommand({ Bucket: this.deps.bucket, Key: key })
      const res = await this.deps.client.send(cmd)
      const body = res.Body as any
      if (!body) return { success: false, error: 'NotFound' }

      const nodeReadable = body as Readable
      const web = Readable.toWeb(nodeReadable) as any
      return { success: true, data: web }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `S3 stream creation failed: ${err.message}` }
    }
  }

  async deleteFile(key: string): Promise<StorageOperationResult<void>> {
    try {
      const cmd = new DeleteObjectCommand({ Bucket: this.deps.bucket, Key: key })
      await this.deps.client.send(cmd)
      return { success: true }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `S3 deletion failed: ${err.message}` }
    }
  }

  async listAllKeys(): Promise<string[]> {
    const keys: string[] = []
    let continuationToken: string | undefined

    try {
      do {
        const cmd = new ListObjectsV2Command({
          Bucket: this.deps.bucket,
          ContinuationToken: continuationToken,
        })

        const res = await this.deps.client.send(cmd)
        for (const obj of res.Contents ?? []) {
          if (obj.Key) keys.push(obj.Key)
        }

        continuationToken = res.NextContinuationToken
      } while (continuationToken)
    } catch {
      return []
    }

    return keys
  }

  async isHealthy(): Promise<boolean> {
    try {
      const cmd = new HeadBucketCommand({ Bucket: this.deps.bucket })
      await this.deps.client.send(cmd)
      return true
    } catch {
      return false
    }
  }
}
