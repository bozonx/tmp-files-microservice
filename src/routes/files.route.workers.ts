import { Hono, type Context } from 'hono'
import type { HonoEnv } from '../types/hono.types.js'
import type { UploadFileResponse } from '../services/files.service.js'
import { ValidationUtil } from '../common/utils/validation.util.js'
import { HttpError } from '../common/errors/http.error.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createFilesRoutesWorkers(): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  const parseOptionalInt = (raw: string | undefined, name: string): number | undefined => {
    if (raw === undefined) return undefined
    if (raw.trim() === '') return undefined
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) {
      throw new HttpError(`Query parameter "${name}" must be an integer`, 400)
    }
    return n
  }

  const parseOptionalDate = (raw: string | undefined, name: string): Date | undefined => {
    if (raw === undefined) return undefined
    if (raw.trim() === '') return undefined
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) {
      throw new HttpError(`Query parameter "${name}" must be a valid ISO date`, 400)
    }
    return d
  }

  app.post('/files', async (c: Context<HonoEnv>) => {
    const contentType = c.req.header('content-type') ?? ''
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      throw new HttpError('Multipart request expected', 400)
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

    const responses: UploadFileResponse[] = []
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
      minSize: parseOptionalInt(q.minSize, 'minSize'),
      maxSize: parseOptionalInt(q.maxSize, 'maxSize'),
      uploadedAfter: parseOptionalDate(q.uploadedAfter, 'uploadedAfter'),
      uploadedBefore: parseOptionalDate(q.uploadedBefore, 'uploadedBefore'),
      expiredOnly: q.expiredOnly === 'true',
      limit: parseOptionalInt(q.limit, 'limit'),
      offset: parseOptionalInt(q.offset, 'offset'),
    })

    return c.json(resp)
  })

  app.get('/files/:id/exists', async (c: Context<HonoEnv>) => {
    const fileId = c.req.param('id')
    const services = c.get('services')

    const idValidation = ValidationUtil.validateFileId(fileId)
    if (!idValidation.isValid) {
      throw new HttpError(`File ID validation failed: ${idValidation.errors.join(', ')}`, 400)
    }

    const exists = await services.files.fileExists(fileId)
    if (!exists) return c.json({ exists, fileId, isExpired: false })

    const info = await services.files.getFileInfo({ fileId })
    return c.json({ exists, fileId, isExpired: info.file.isExpired })
  })

  return app
}
