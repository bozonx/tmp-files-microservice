import type { MetadataAdapter } from './metadata.adapter.js'
import type { FileStorageAdapter } from './file-storage.adapter.js'
import type { FileInfo, FileStats } from '../common/interfaces/file.interface.js'
import type { FileSearchParams, FileSearchResult } from '../common/interfaces/storage.interface.js'
import { DateUtil } from '../common/utils/date.util.js'

export interface StorageMetadataAdapterDeps {
  storage: FileStorageAdapter
}

const METADATA_PREFIX = 'metadata/'

export class StorageMetadataAdapter implements MetadataAdapter {
  constructor(private readonly deps: StorageMetadataAdapterDeps) {}

  public async initialize(): Promise<void> {
    // No-op
  }

  private metadataKey(expiresAt: Date | string, id: string): string {
    const ts = DateUtil.toTimestamp(expiresAt)
    return `${METADATA_PREFIX}${ts}__${id}.json`
  }

  public async saveFileInfo(fileInfo: FileInfo): Promise<void> {
    const key = this.metadataKey(fileInfo.expiresAt, fileInfo.id)
    // We store the data both in headers (for fast retrieval during download)
    // and as a marker file (for efficient cleanup listing)
    await this.deps.storage.saveFile(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(fileInfo)))
          controller.close()
        },
      }),
      key,
      'application/json'
    )
  }

  public async getFileInfo(fileId: string): Promise<FileInfo | null> {
    // Attempt to get metadata directly from the main file headers first (optimization)
    const headerRes = await this.deps.storage.getMetadata(fileId)
    if (
      headerRes.success &&
      headerRes.data &&
      headerRes.data['original-name'] &&
      headerRes.data['expires-at']
    ) {
      const meta = headerRes.data
      return {
        id: fileId,
        originalName: meta['original-name'] || '',
        storedName: meta['stored-name'] || fileId,
        mimeType: meta['mime-type'] || 'application/octet-stream',
        size: Number.parseInt(meta['size'] || '0', 10),
        hash: meta['hash'] || '',
        uploadedAt: meta['uploaded-at'] || new Date(0).toISOString(),
        ttl: Number.parseInt(meta['ttl'] || '0', 10),
        expiresAt: meta['expires-at'] || new Date(0).toISOString(),
        filePath: fileId,
        metadata: {},
      }
    }

    // Fallback: search in metadata/ folder
    const allMetaKeys = await this.deps.storage.listAllKeys(METADATA_PREFIX)
    const match = allMetaKeys.find((k) => k.endsWith(`__${fileId}.json`))
    if (!match) return null

    const contentRes = await this.deps.storage.readFile(match)
    if (!contentRes.success || !contentRes.data) return null

    return JSON.parse(new TextDecoder().decode(contentRes.data)) as FileInfo
  }

  public async deleteFileInfo(fileId: string): Promise<void> {
    const allMetaKeys = await this.deps.storage.listAllKeys(METADATA_PREFIX)
    const matches = allMetaKeys.filter((k) => k.endsWith(`__${fileId}.json`))
    for (const key of matches) {
      await this.deps.storage.deleteFile(key)
    }
  }



  public async searchFiles(params: FileSearchParams): Promise<FileSearchResult> {
    const allMetaKeys = await this.deps.storage.listAllKeys(METADATA_PREFIX)
    const files: FileInfo[] = []

    console.log(`[StorageMetadata] Found ${allMetaKeys.length} keys with prefix "${METADATA_PREFIX}"`)

    for (const key of allMetaKeys) {
      // metadata/[expiresAt]__[id].json
      const filename = key.slice(METADATA_PREFIX.length)
      const [expiresTsStr] = filename.split('__')
      const expiresTs = Number.parseInt(expiresTsStr, 10)

      const isExpired = DateUtil.isExpired(new Date(expiresTs))
      // console.log(`[StorageMetadata] Key: ${key}, ExpiresTs: ${expiresTs}, IsExpired: ${isExpired}, ParamsExpiredOnly: ${params.expiredOnly}`)
      
      if (params.expiredOnly && !isExpired) continue

      const contentRes = await this.deps.storage.readFile(key)
      if (contentRes.success && contentRes.data) {
        try {
          const content = new TextDecoder().decode(contentRes.data)
          // console.log(`[StorageMetadata] Content for ${key}:`, content.slice(0, 100))
          const info = JSON.parse(content) as FileInfo
          
          // Apply filters
          if (params.mimeType && info.mimeType !== params.mimeType) continue
          if (params.minSize !== undefined && info.size < params.minSize) continue
          if (params.maxSize !== undefined && info.size > params.maxSize) continue
          
          files.push(info)
        } catch (e) {
          console.error(`[StorageMetadata] Error parsing metadata for key ${key}:`, e)
          // ignore corrupt meta files
        }
      } else {
        console.error(`[StorageMetadata] Failed to read metadata file for key ${key}`)
      }
    }

    files.sort((a, b) => DateUtil.toTimestamp(b.uploadedAt) - DateUtil.toTimestamp(a.uploadedAt))
    
    const total = files.length
    let out = files
    if (params.offset) out = out.slice(params.offset)
    if (params.limit) out = out.slice(0, params.limit)

    return { files: out, total, params }
  }

  public async getStats(): Promise<FileStats> {
    const res = await this.searchFiles({})
    const all = res.files

    const filesByMimeType: Record<string, number> = {}
    const filesByDate: Record<string, number> = {}

    for (const f of all) {
      filesByMimeType[f.mimeType] = (filesByMimeType[f.mimeType] || 0) + 1
      const dateKey = DateUtil.format(f.uploadedAt, 'YYYY-MM-DD')
      filesByDate[dateKey] = (filesByDate[dateKey] || 0) + 1
    }

    return {
      totalFiles: all.length,
      totalSize: all.reduce((sum, f) => sum + f.size, 0),
      filesByMimeType,
      filesByDate,
    }
  }

  public async getAllFileIds(): Promise<string[]> {
    const allMetaKeys = await this.deps.storage.listAllKeys(METADATA_PREFIX)
    return allMetaKeys.map((k) => {
      const filename = k.slice(METADATA_PREFIX.length)
      const parts = filename.split('__')
      return parts[1].replace('.json', '')
    })
  }

  public async isHealthy(): Promise<boolean> {
    return this.deps.storage.isHealthy()
  }
}
