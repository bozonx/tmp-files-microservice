import {
  type S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { Readable } from 'node:stream'
import type { FileStorageAdapter } from '../file-storage.adapter.js'
import type {
  StorageOperationResult,
  StorageRange,
} from '../../common/interfaces/storage.interface.js'

export interface S3StorageAdapterDeps {
  client: S3Client
  bucket: string
}

export class S3StorageAdapter implements FileStorageAdapter {
  constructor(private readonly deps: S3StorageAdapterDeps) {}

  public async saveFile(
    input: ReadableStream<Uint8Array>,
    key: string,
    mimeType: string,
    size?: number,
    metadata?: Record<string, string>,
    signal?: AbortSignal
  ): Promise<StorageOperationResult<string>> {
    try {
      const reader = input.getReader()
      const iterable = {
        async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            if (value) yield value
          }
        },
      }

      const body = Readable.from(iterable)
      const upload = new Upload({
        client: this.deps.client,
        params: {
          Bucket: this.deps.bucket,
          Key: key,
          Body: body,
          ContentType: mimeType,
          Metadata: metadata,
        },
      })

      if (signal) {
        signal.addEventListener('abort', () => upload.abort(), { once: true })
      }

      await upload.done()
      return { success: true, data: key }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `S3 upload failed: ${err.message}` }
    }
  }

  public async readFile(
    key: string,
    signal?: AbortSignal
  ): Promise<StorageOperationResult<Uint8Array>> {
    try {
      const cmd = new GetObjectCommand({ Bucket: this.deps.bucket, Key: key })
      const res = await this.deps.client.send(cmd, { abortSignal: signal })
      const body = res.Body
      if (!body) return { success: false, error: 'NotFound' }

      const chunks: Buffer[] = []
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        if (signal?.aborted) {
          throw new Error('Aborted')
        }
        chunks.push(Buffer.from(chunk))
      }
      return { success: true, data: new Uint8Array(Buffer.concat(chunks)) }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `S3 read failed: ${err.message}` }
    }
  }

  public async createReadStream(
    key: string,
    range?: StorageRange,
    signal?: AbortSignal
  ): Promise<StorageOperationResult<ReadableStream<Uint8Array>>> {
    try {
      let rangeHeader: string | undefined
      if (range) {
        const end = range.length ? range.offset + range.length - 1 : ''
        rangeHeader = `bytes=${range.offset}-${end}`
      }

      const cmd = new GetObjectCommand({
        Bucket: this.deps.bucket,
        Key: key,
        Range: rangeHeader,
      })
      const res = await this.deps.client.send(cmd, { abortSignal: signal })
      const body = res.Body
      if (!body) return { success: false, error: 'NotFound' }

      const nodeReadable = body as unknown as Readable
      const web = Readable.toWeb(nodeReadable) as unknown as ReadableStream<Uint8Array>
      return { success: true, data: web }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `S3 stream creation failed: ${err.message}` }
    }
  }

  public async getMetadata(
    key: string,
    signal?: AbortSignal
  ): Promise<StorageOperationResult<Record<string, string>>> {
    try {
      const cmd = new HeadObjectCommand({ Bucket: this.deps.bucket, Key: key })
      const res = await this.deps.client.send(cmd, { abortSignal: signal })
      return { success: true, data: res.Metadata ?? {} }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `S3 metadata fetch failed: ${err.message}` }
    }
  }

  public async deleteFile(
    key: string,
    signal?: AbortSignal
  ): Promise<StorageOperationResult<void>> {
    try {
      const cmd = new DeleteObjectCommand({ Bucket: this.deps.bucket, Key: key })
      await this.deps.client.send(cmd, { abortSignal: signal })
      return { success: true }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `S3 deletion failed: ${err.message}` }
    }
  }

  public async listAllKeys(prefix?: string, signal?: AbortSignal): Promise<string[]> {
    const keys: string[] = []
    let continuationToken: string | undefined

    try {
      do {
        if (signal?.aborted) return []
        const cmd = new ListObjectsV2Command({
          Bucket: this.deps.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })

        const res = await this.deps.client.send(cmd, { abortSignal: signal })
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

  public async isHealthy(): Promise<boolean> {
    try {
      const cmd = new HeadBucketCommand({ Bucket: this.deps.bucket })
      await this.deps.client.send(cmd)
      return true
    } catch {
      return false
    }
  }
}
