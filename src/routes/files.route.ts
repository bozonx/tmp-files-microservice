import { Hono, type Context } from 'hono'
import type { IncomingHttpHeaders } from 'node:http'
import type { HonoEnv } from '../types/hono.types.js'
import type { UploadFileResponse } from '../services/files.service.js'

class HttpError extends Error {
  public readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'HttpError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createFilesRoutes(): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.post('/files', async (c: Context<HonoEnv>) => {
    const contentType = c.req.header('content-type') ?? ''
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      throw new HttpError('Multipart request expected', 400)
    }

    // Node.js streaming path (Docker): parse multipart without buffering whole request.
    const nodeIncoming = c.env.incoming
    if (nodeIncoming && typeof nodeIncoming.pipe === 'function') {
      const services = c.get('services')

      const [{ default: Busboy }, { Readable }] = await Promise.all([
        import('busboy'),
        import('node:stream'),
      ])

      const req = nodeIncoming as unknown as {
        headers?: unknown
        pipe: (dst: unknown) => void
      }

      const headers = (isRecord(req.headers) ? req.headers : {}) as unknown as IncomingHttpHeaders
      const bb = Busboy({ headers })

      let ttlMins: number | undefined
      let metadata: Record<string, unknown> | undefined
      const uploads: Array<Promise<UploadFileResponse>> = []

      bb.on('field', (name: string, value: string) => {
        if (name === 'ttlMins') {
          const v = value.trim()
          if (v !== '') ttlMins = Number.parseInt(v, 10)
        }
        if (name === 'metadata') {
          const v = value.trim()
          if (v === '') return
          try {
            const parsed: unknown = JSON.parse(v)
            if (!isRecord(parsed)) {
              bb.emit('error', new HttpError('Metadata must be an object', 400))
              return
            }
            metadata = parsed
          } catch {
            bb.emit('error', new HttpError('Invalid metadata JSON format', 400))
          }
        }
      })

      bb.on(
        'file',
        (
          name: string,
          file: { resume: () => void },
          info: { filename: string; mimeType: string; encoding: string }
        ) => {
          if (name !== 'file') {
            file.resume()
            return
          }

          const webStream = Readable.toWeb(file as never) as unknown as ReadableStream<Uint8Array>

          const ttl = Math.max(60, Math.floor((ttlMins ?? 1440) * 60))

          uploads.push(
            services.files.uploadFile({
              file: {
                originalname: info.filename || 'unknown',
                mimetype: info.mimeType || 'application/octet-stream',
                size: 0,
                stream: webStream,
                encoding: info.encoding,
              },
              ttl,
              metadata,
            })
          )
        }
      )

      const result = await new Promise<UploadFileResponse | UploadFileResponse[]>(
        (resolve, reject) => {
          bb.on('error', reject)
          bb.on('finish', () => {
            void (async () => {
              if (uploads.length === 0) {
                throw new HttpError('No file provided', 400)
              }
              const responses = await Promise.all(uploads)
              resolve(responses.length === 1 ? responses[0] : responses)
            })().catch((e: unknown) => {
              reject(e instanceof Error ? e : new Error(String(e)))
            })
          })

          req.pipe(bb)
        }
      )

      return c.json(result, 201)
    }

    const form = await c.req.formData()

    const ttlMinsRaw = form.get('ttlMins')
    const ttlMins =
      typeof ttlMinsRaw === 'string' && ttlMinsRaw.trim() !== ''
        ? Number.parseInt(ttlMinsRaw, 10)
        : 1440
    const ttl = Math.max(60, Math.floor(ttlMins * 60))

    const metadataRaw = form.get('metadata')
    let metadata: Record<string, unknown> | undefined
    if (typeof metadataRaw === 'string' && metadataRaw.trim() !== '') {
      try {
        const parsed: unknown = JSON.parse(metadataRaw)
        if (!isRecord(parsed)) {
          throw new HttpError('Metadata must be an object', 400)
        }
        metadata = parsed
      } catch {
        throw new HttpError('Invalid metadata JSON format', 400)
      }
    }

    const files = form.getAll('file')
    if (files.length === 0) {
      throw new HttpError('No file provided', 400)
    }

    const services = c.get('services')

    const responses = []
    for (const f of files) {
      if (!(f instanceof File)) {
        continue
      }
      const uploaded = {
        originalname: f.name || 'unknown',
        mimetype: f.type || 'application/octet-stream',
        size: f.size,
        stream: f.stream(),
      }

      const resp = await services.files.uploadFile({ file: uploaded, ttl, metadata })
      responses.push(resp)
    }

    return c.json(responses.length === 1 ? responses[0] : responses, 201)
  })

  app.post('/files/url', async (c: Context<HonoEnv>) => {
    const bodyUnknown: unknown = await c.req.json().catch(() => null)
    if (!isRecord(bodyUnknown)) {
      throw new HttpError('Invalid JSON body', 400)
    }

    const url = bodyUnknown.url
    if (typeof url !== 'string' || url.trim() === '') {
      throw new HttpError('Field "url" is required and must be a string', 400)
    }

    const ttlMinsRaw = bodyUnknown.ttlMins
    const ttlMins =
      typeof ttlMinsRaw === 'number'
        ? ttlMinsRaw
        : typeof ttlMinsRaw === 'string' && ttlMinsRaw.trim() !== ''
          ? Number.parseInt(ttlMinsRaw, 10)
          : 1440
    const ttl = Math.max(60, Math.floor(ttlMins * 60))

    let metadata: Record<string, unknown> | undefined
    if (bodyUnknown.metadata !== undefined) {
      if (typeof bodyUnknown.metadata === 'string' && bodyUnknown.metadata.trim() !== '') {
        try {
          const parsed: unknown = JSON.parse(bodyUnknown.metadata)
          if (!isRecord(parsed)) {
            throw new HttpError('Metadata must be an object', 400)
          }
          metadata = parsed
        } catch {
          throw new HttpError('Invalid metadata JSON format', 400)
        }
      } else if (typeof bodyUnknown.metadata === 'object' && bodyUnknown.metadata !== null) {
        if (!isRecord(bodyUnknown.metadata)) {
          throw new HttpError('Metadata must be an object', 400)
        }
        metadata = bodyUnknown.metadata
      }
    }

    const services = c.get('services')
    const resp = await services.files.uploadFileFromUrl({ url, ttl, metadata })
    return c.json(resp, 201)
  })

  app.get('/files/stats', async (c: Context<HonoEnv>) => {
    const services = c.get('services')
    const resp = await services.files.getFileStats()
    return c.json(resp)
  })

  app.get('/files/:id', async (c: Context<HonoEnv>) => {
    const services = c.get('services')
    const resp = await services.files.getFileInfo({ fileId: c.req.param('id') })
    return c.json(resp)
  })

  app.delete('/files/:id', async (c: Context<HonoEnv>) => {
    const services = c.get('services')
    const resp = await services.files.deleteFile({ fileId: c.req.param('id') })
    return c.json(resp)
  })

  app.get('/files', async (c: Context<HonoEnv>) => {
    const q = c.req.query()
    const services = c.get('services')

    const resp = await services.files.listFiles({
      mimeType: q.mimeType,
      minSize: q.minSize ? Number.parseInt(q.minSize, 10) : undefined,
      maxSize: q.maxSize ? Number.parseInt(q.maxSize, 10) : undefined,
      uploadedAfter: q.uploadedAfter ? new Date(q.uploadedAfter) : undefined,
      uploadedBefore: q.uploadedBefore ? new Date(q.uploadedBefore) : undefined,
      expiredOnly: q.expiredOnly === 'true',
      limit: q.limit ? Number.parseInt(q.limit, 10) : undefined,
      offset: q.offset ? Number.parseInt(q.offset, 10) : undefined,
    })

    return c.json(resp)
  })

  app.get('/files/:id/exists', async (c: Context<HonoEnv>) => {
    const fileId = c.req.param('id')
    const services = c.get('services')

    const exists = await services.files.fileExists(fileId)
    if (!exists) return c.json({ exists, fileId, isExpired: false })

    const info = await services.files.getFileInfo({ fileId })
    return c.json({ exists, fileId, isExpired: info.file.isExpired })
  })

  return app
}
