/// <reference types="@cloudflare/workers-types" />

import type { FileStorageAdapter } from '../file-storage.adapter.js'
import type { StorageOperationResult } from '../../common/interfaces/storage.interface.js'

export interface R2StorageAdapterDeps {
  bucket: R2Bucket
}

export class R2StorageAdapter implements FileStorageAdapter {
  constructor(private readonly deps: R2StorageAdapterDeps) {}

  public async saveFile(
    input: ReadableStream<Uint8Array>,
    key: string,
    mimeType: string
  ): Promise<StorageOperationResult<string>> {
    try {
      await this.deps.bucket.put(key, input, {
        httpMetadata: {
          contentType: mimeType,
        },
      })
      return { success: true, data: key }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `R2 upload failed: ${err.message}` }
    }
  }

  public async readFile(key: string): Promise<StorageOperationResult<Uint8Array>> {
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
    key: string
  ): Promise<StorageOperationResult<ReadableStream<Uint8Array>>> {
    try {
      const obj = await this.deps.bucket.get(key)
      if (!obj?.body) return { success: false, error: 'NotFound' }
      return { success: true, data: obj.body }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `R2 stream creation failed: ${err.message}` }
    }
  }

  public async deleteFile(key: string): Promise<StorageOperationResult<void>> {
    try {
      await this.deps.bucket.delete(key)
      return { success: true }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: `R2 deletion failed: ${err.message}` }
    }
  }

  public async listAllKeys(): Promise<string[]> {
    const keys: string[] = []
    let cursor: string | undefined

    do {
      const res = await this.deps.bucket.list({ cursor })
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
