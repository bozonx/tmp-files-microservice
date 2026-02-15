/// <reference types="@cloudflare/workers-types" />

import type { FileStorageAdapter } from '../file-storage.adapter.js'
import type {
  StorageOperationResult,
  StorageRange,
} from '../../common/interfaces/storage.interface.js'

export interface R2StorageAdapterDeps {
  bucket: R2Bucket
}

export class R2StorageAdapter implements FileStorageAdapter {
  constructor(private readonly deps: R2StorageAdapterDeps) {}

  private async readStreamToArrayBuffer(input: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
    const reader = input.getReader()
    const chunks: Uint8Array[] = []
    let total = 0

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue
      chunks.push(value)
      total += value.byteLength
    }

    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    return merged.buffer
  }

  public async saveFile(
    input: ReadableStream<Uint8Array>,
    key: string,
    mimeType: string,
    size?: number,
    metadata?: Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    signal?: AbortSignal
  ): Promise<StorageOperationResult<string>> {
    try {
      // In Cloudflare Workers, R2.put() requires a known length for streams.
      // If a size is provided and FixedLengthStream is available, we use it to wrap the stream.
      let uploadInput: ReadableStream<Uint8Array> | ArrayBuffer | string = input

      const fixedLengthStream = (globalThis as unknown as { FixedLengthStream?: any })
        .FixedLengthStream
      if (size !== undefined && size > 0 && fixedLengthStream) {
        uploadInput = input.pipeThrough(new fixedLengthStream(size))
      } else if (size === undefined || size <= 0) {
        uploadInput = await this.readStreamToArrayBuffer(input)
      }

      await this.deps.bucket.put(key, uploadInput, {
        httpMetadata: {
          contentType: mimeType,
        },
        customMetadata: metadata,
      })
      return { success: true, data: key }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `R2 upload failed: ${err.message}` }
    }
  }

  public async readFile(
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    signal?: AbortSignal
  ): Promise<StorageOperationResult<Uint8Array>> {
    try {
      const obj = await this.deps.bucket.get(key)
      if (!obj) return { success: false, error: 'NotFound' }
      const ab = await obj.arrayBuffer()
      return { success: true, data: new Uint8Array(ab) }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `R2 read failed: ${err.message}` }
    }
  }

  public async createReadStream(
    key: string,
    range?: StorageRange,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    signal?: AbortSignal
  ): Promise<StorageOperationResult<ReadableStream<Uint8Array>>> {
    try {
      const obj = await this.deps.bucket.get(key, { range })
      if (!obj?.body) return { success: false, error: 'NotFound' }
      return { success: true, data: obj.body }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `R2 stream creation failed: ${err.message}` }
    }
  }

  public async getMetadata(
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    signal?: AbortSignal
  ): Promise<StorageOperationResult<Record<string, string>>> {
    try {
      const obj = await this.deps.bucket.head(key)
      if (!obj) return { success: false, error: 'NotFound' }
      return { success: true, data: obj.customMetadata ?? {} }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `R2 metadata fetch failed: ${err.message}` }
    }
  }

  public async deleteFile(
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    signal?: AbortSignal
  ): Promise<StorageOperationResult<void>> {
    try {
      await this.deps.bucket.delete(key)
      return { success: true }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `R2 deletion failed: ${err.message}` }
    }
  }

  public async listAllKeys(prefix?: string, signal?: AbortSignal): Promise<string[]> {
    const keys: string[] = []
    let cursor: string | undefined

    do {
      if (signal?.aborted) return []
      const res = await this.deps.bucket.list({ cursor, prefix })
      for (const obj of res.objects) {
        keys.push(obj.key)
      }
      cursor = res.truncated ? res.cursor : undefined
    } while (cursor)

    return keys
  }

  public async isHealthy(): Promise<boolean> {
    try {
      await this.deps.bucket.list({ limit: 1 })
      return true
    } catch {
      return false
    }
  }
}
