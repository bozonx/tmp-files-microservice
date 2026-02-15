import type { AppEnv } from '../config/env.js'
import type { LoggerAdapter } from '../adapters/logger.adapter.js'
import type { StorageService } from './storage.service.js'
import type { UploadedFile, FileInfo } from '../common/interfaces/file.interface.js'
import { ValidationUtil } from '../common/utils/validation.util.js'
import { DateUtil } from '../common/utils/date.util.js'
import { HttpError } from '../common/errors/http.error.js'
import { NullDnsResolver, type DnsResolver } from '../common/interfaces/dns-resolver.interface.js'
import type { StorageRange } from '../common/interfaces/storage.interface.js'

export interface FilesServiceDeps {
  env: AppEnv
  storage: StorageService
  logger: LoggerAdapter
  dnsResolver?: DnsResolver
}

export interface FileResponse {
  id: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: string
  ttlMins: number
  expiresAt: string
  metadata?: Record<string, unknown>
  hash: string
  isExpired: boolean
  timeRemainingMins: number
}

export interface PaginationInfo {
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface UploadFileResponse {
  file: FileResponse
  downloadUrl: string
  downloadPath: string
  infoUrl: string
  deleteUrl: string
  message: string
}

export interface GetFileInfoResponse {
  file: FileResponse
  downloadUrl: string
  downloadPath: string
  deleteUrl: string
}

export interface DeleteFileResponse {
  fileId: string
  message: string
  deletedAt: string
}

export class FilesService {
  private readonly dnsResolver: DnsResolver

  constructor(private readonly deps: FilesServiceDeps) {
    this.dnsResolver = deps.dnsResolver ?? new NullDnsResolver()
  }

  private isProbablyNodeRuntime(): boolean {
    return (
      typeof process !== 'undefined' &&
      typeof process.versions === 'object' &&
      process.versions !== null &&
      typeof (process.versions as Record<string, unknown>).node === 'string'
    )
  }

  private isPrivateIpv4(ip: string): boolean {
    const parts = ip.split('.')
    if (parts.length !== 4) return false
    const nums = parts.map((p) => Number.parseInt(p, 10))
    if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false

    const [a, b] = nums
    if (a === 10) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }

  private isPrivateIpv6(ip: string): boolean {
    const normalized = ip.toLowerCase()

    if (normalized === '::1') return true
    if (normalized === '0:0:0:0:0:0:0:1') return true

    // Unique local addresses (fc00::/7)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true

    // Link-local addresses (fe80::/10)
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9')) return true
    if (normalized.startsWith('fea') || normalized.startsWith('feb')) return true

    return false
  }

  private isBlockedHostname(hostname: string): boolean {
    const h = hostname.toLowerCase()
    if (h === 'localhost' || h.endsWith('.localhost')) return true
    if (h === '0.0.0.0') return true
    if (h === '::1') return true
    if (h.endsWith('.local')) return true
    if (h.includes(':') && this.isPrivateIpv6(h)) return true
    if (!h.includes(':') && this.isPrivateIpv4(h)) return true
    return false
  }

  private async assertRemoteAddressAllowed(url: URL): Promise<void> {
    if (this.deps.env.NODE_ENV === 'test') return

    if (this.isBlockedHostname(url.hostname)) {
      throw new HttpError('URL hostname is not allowed', 400)
    }

    if (!this.isProbablyNodeRuntime()) return

    try {
      const addresses = await this.dnsResolver.lookupAll(url.hostname)
      for (const addr of addresses) {
        if (this.isPrivateIpv4(addr) || this.isPrivateIpv6(addr)) {
          throw new HttpError('URL resolves to a private network address', 400)
        }
      }
    } catch (e: unknown) {
      if (e instanceof HttpError) throw e
      throw new HttpError('Failed to resolve URL hostname', 400)
    }
  }

  private parseAndValidateRemoteUrl(input: string): URL {
    let url: URL
    try {
      url = new URL(input)
    } catch {
      throw new HttpError('Invalid URL', 400)
    }

    const protocol = url.protocol.toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new HttpError('Only http/https URLs are allowed', 400)
    }

    const portRaw = url.port.trim()
    if (portRaw !== '') {
      const port = Number.parseInt(portRaw, 10)
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        throw new HttpError('Invalid URL port', 400)
      }

      // Workers runtime is more restricted because it cannot reliably perform DNS-based private IP checks.
      if (!this.isProbablyNodeRuntime()) {
        if (port !== 80 && port !== 443) {
          throw new HttpError('Only ports 80 and 443 are allowed', 400)
        }
      }
    }
    return url
  }

  private async fetchWithRedirects(
    initialUrl: URL,
    maxRedirects: number,
    signal?: AbortSignal
  ): Promise<{ response: Response; finalUrl: URL }> {
    let current = initialUrl

    for (let i = 0; i <= maxRedirects; i++) {
      await this.assertRemoteAddressAllowed(current)

      const controller = new AbortController()
      const timeoutMs = 15_000
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      let res: Response
      try {
        const fetchSignal = signal
          ? (AbortSignal as any).any([signal, controller.signal])
          : controller.signal

        res = await fetch(current, {
          redirect: 'manual',
          signal: fetchSignal,
        })
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e))
        const name = (err as { name?: unknown }).name
        if (name === 'AbortError') {
          if (signal?.aborted) {
            throw new HttpError('Request cancelled', 499)
          }
          throw new HttpError('Remote request timed out', 504)
        }
        throw err
      } finally {
        clearTimeout(timeoutId)
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) {
          throw new HttpError('Redirect response missing Location header', 400)
        }
        const next = new URL(loc, current)
        current = this.parseAndValidateRemoteUrl(next.toString())
        continue
      }

      return { response: res, finalUrl: current }
    }

    throw new HttpError('Too many redirects', 400)
  }

  private apiBasePath(): string {
    const base = this.deps.env.BASE_PATH
    return base ? `/${base}/api/v1` : '/api/v1'
  }

  public async uploadFileFromUrl(params: {
    url: string
    ttl: number
    metadata?: Record<string, unknown>
    signal?: AbortSignal
  }): Promise<UploadFileResponse> {
    if (!params.url || typeof params.url !== 'string') throw new HttpError('Invalid URL', 400)

    const initialUrl = this.parseAndValidateRemoteUrl(params.url)
    const { response: res, finalUrl } = await this.fetchWithRedirects(
      initialUrl,
      3,
      params.signal
    )
    if (!res.ok) {
      throw new HttpError(`Failed to fetch URL. Status: ${res.status}`, 400)
    }

    const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
    const contentLength = res.headers.get('content-length')
    const size = contentLength ? Number.parseInt(contentLength, 10) : 0

    if (!this.isProbablyNodeRuntime()) {
      if (!contentLength || !Number.isFinite(size) || size <= 0) {
        throw new HttpError('Remote response must include a valid Content-Length header', 400)
      }
    }

    const max = this.deps.env.MAX_FILE_SIZE_MB * 1024 * 1024
    if (size && size > max) {
      throw new HttpError('File size exceeds the maximum allowed limit', 413)
    }

    const nameFromUrl = finalUrl.pathname.split('/').filter(Boolean).pop() ?? 'file'

    if (!res.body) {
      throw new HttpError('Remote response body is empty', 500)
    }

    const file: UploadedFile = {
      originalname: nameFromUrl,
      mimetype: contentType,
      size,
      stream: res.body as ReadableStream<Uint8Array>,
    }

    return this.uploadFile({
      file,
      ttl: params.ttl,
      metadata: params.metadata,
      signal: params.signal,
    })
  }

  private generateApiUrl(endpoint: string, params: Record<string, string> = {}): string {
    let url = `${this.apiBasePath()}/${endpoint}`
    for (const [k, v] of Object.entries(params)) {
      url = url.replace(`:${k}`, v)
    }
    return url
  }

  private getFullDownloadUrl(downloadPath: string): string {
    const base = this.deps.env.DOWNLOAD_BASE_URL
    if (!base) return downloadPath
    return `${base}${downloadPath}`
  }

  private toFileResponse(fileInfo: FileInfo): FileResponse {
    const uploadedAt =
      typeof fileInfo.uploadedAt === 'string' ? new Date(fileInfo.uploadedAt) : fileInfo.uploadedAt
    const expiresAt =
      typeof fileInfo.expiresAt === 'string' ? new Date(fileInfo.expiresAt) : fileInfo.expiresAt

    return {
      id: fileInfo.id,
      originalName: fileInfo.originalName,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      uploadedAt: uploadedAt.toISOString(),
      ttlMins: Math.floor(fileInfo.ttl / 60),
      expiresAt: expiresAt.toISOString(),
      metadata: fileInfo.metadata,
      hash: fileInfo.hash,
      isExpired: DateUtil.isExpired(expiresAt),
      timeRemainingMins: Math.floor(
        Math.max(0, DateUtil.diffInSeconds(expiresAt, DateUtil.now().toDate())) / 60
      ),
    }
  }

  public async uploadFile(params: {
    file: UploadedFile
    ttl: number
    metadata?: Record<string, unknown>
    signal?: AbortSignal
  }): Promise<UploadFileResponse> {
    const maxFileSize = this.deps.env.MAX_FILE_SIZE_MB * 1024 * 1024

    const v = ValidationUtil.validateUploadedFile(params.file, {
      allowedMimeTypes: this.deps.env.ALLOWED_MIME_TYPES,
      maxFileSize,
      blockExecutables: this.deps.env.BLOCK_EXECUTABLE_UPLOADS,
      blockArchives: this.deps.env.BLOCK_ARCHIVE_UPLOADS,
    })
    if (!v.isValid) {
      const tooLarge = v.errors.some((e) => e.includes('exceeds maximum allowed size'))
      throw new HttpError(`File validation failed: ${v.errors.join(', ')}`, tooLarge ? 413 : 400)
    }

    const ttlValidation = ValidationUtil.validateTTL(params.ttl, 60, this.deps.env.MAX_TTL_MIN * 60)
    if (!ttlValidation.isValid) {
      throw new HttpError(`TTL validation failed: ${ttlValidation.errors.join(', ')}`, 400)
    }

    if (params.metadata) {
      const mv = ValidationUtil.validateMetadata(params.metadata)
      if (!mv.isValid) {
        throw new HttpError(`Metadata validation failed: ${mv.errors.join(', ')}`, 400)
      }
    }

    const saveRes = await this.deps.storage.saveFile({
      file: params.file,
      ttl: params.ttl,
      metadata: params.metadata,
      signal: params.signal,
    })

    if (!saveRes.success) {
      throw new HttpError(`Failed to save file: ${saveRes.error ?? 'Unknown error'}`, 500)
    }

    const fileInfo = saveRes.data as FileInfo
    const respFile = this.toFileResponse(fileInfo)
    const downloadPath = this.generateApiUrl('download/:id', { id: fileInfo.id })

    return {
      file: respFile,
      downloadUrl: this.getFullDownloadUrl(downloadPath),
      downloadPath,
      infoUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
      deleteUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
      message: 'File uploaded successfully',
    }
  }

  public async getFileInfo(params: {
    fileId: string
    signal?: AbortSignal
  }): Promise<GetFileInfoResponse> {
    const idValidation = ValidationUtil.validateFileId(params.fileId)
    if (!idValidation.isValid) {
      throw new HttpError(`File ID validation failed: ${idValidation.errors.join(', ')}`, 400)
    }

    const res = await this.deps.storage.getFileInfo(params.fileId, params.signal)
    if (!res.success) {
      const notFound =
        (res.error?.includes('not found') ?? false) || (res.error?.includes('expired') ?? false)
      throw new HttpError(res.error ?? 'Not found', notFound ? 404 : 500)
    }

    const fileInfo = res.data as FileInfo
    const downloadPath = this.generateApiUrl('download/:id', { id: fileInfo.id })

    return {
      file: this.toFileResponse(fileInfo),
      downloadUrl: this.getFullDownloadUrl(downloadPath),
      downloadPath,
      deleteUrl: this.generateApiUrl('files/:id', { id: fileInfo.id }),
    }
  }

  public async downloadFileStream(params: {
    fileId: string
    range?: StorageRange
    signal?: AbortSignal
  }): Promise<{ stream: ReadableStream<Uint8Array>; fileInfo: FileInfo }> {
    const idValidation = ValidationUtil.validateFileId(params.fileId)
    if (!idValidation.isValid) {
      throw new HttpError(`File ID validation failed: ${idValidation.errors.join(', ')}`, 400)
    }

    const fileRes = await this.deps.storage.getFileInfo(params.fileId, params.signal)
    if (!fileRes.success) {
      const notFound =
        (fileRes.error?.includes('not found') ?? false) ||
        (fileRes.error?.includes('expired') ?? false)
      throw new HttpError(fileRes.error ?? 'Not found', notFound ? 404 : 500)
    }

    const info = fileRes.data as FileInfo
    const streamRes = await this.deps.storage.createFileReadStream(
      params.fileId,
      params.range,
      params.signal
    )
    if (!streamRes.success) {
      throw new HttpError(`Failed to create read stream: ${streamRes.error}`, 500)
    }

    return { stream: streamRes.data as ReadableStream<Uint8Array>, fileInfo: info }
  }

  public async deleteFile(params: {
    fileId: string
    signal?: AbortSignal
  }): Promise<DeleteFileResponse> {
    const idValidation = ValidationUtil.validateFileId(params.fileId)
    if (!idValidation.isValid) {
      throw new HttpError(`File ID validation failed: ${idValidation.errors.join(', ')}`, 400)
    }

    const res = await this.deps.storage.deleteFile(params.fileId, params.signal)
    if (!res.success) {
      const notFound = res.error?.includes('not found')
      throw new HttpError(res.error ?? 'Failed to delete', notFound ? 404 : 500)
    }

    return {
      fileId: params.fileId,
      message: 'File deleted successfully',
      deletedAt: new Date().toISOString(),
    }
  }

  public async listFiles(params: {
    mimeType?: string
    minSize?: number
    maxSize?: number
    uploadedAfter?: Date
    uploadedBefore?: Date
    expiredOnly?: boolean
    limit?: number
    offset?: number
    signal?: AbortSignal
  }): Promise<{ files: FileResponse[]; total: number; pagination: PaginationInfo }> {
    const res = await this.deps.storage.searchFiles(params, params.signal)
    const files = res.files.map((f) => this.toFileResponse(f))

    const limit = params.limit ?? 10
    const offset = params.offset ?? 0

    const pagination = {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(res.total / limit),
      hasNext: offset + limit < res.total,
      hasPrev: offset > 0,
    }

    return { files, total: res.total, pagination }
  }

  public async getFileStats(
    signal?: AbortSignal
  ): Promise<{ stats: unknown; generatedAt: string }> {
    const stats = await this.deps.storage.getFileStats(signal)
    return { stats, generatedAt: new Date().toISOString() }
  }

  public async fileExists(fileId: string, signal?: AbortSignal): Promise<boolean> {
    const res = await this.deps.storage.getFileInfo(fileId, signal)
    return !!res.success
  }
}
