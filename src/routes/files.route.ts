import { Hono, type Context } from 'hono'

export function createFilesRoutes(): Hono {
  const app = new Hono()

  app.post('/files', async (c: Context) => {
    const contentType = c.req.header('content-type') || ''
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      const err: any = new Error('Multipart request expected')
      err.status = 400
      throw err
    }

    // Node.js streaming path (Docker): parse multipart without buffering whole request.
    const nodeIncoming = (c.env as any)?.incoming as
      | undefined
      | { headers?: Record<string, unknown> }
    if (nodeIncoming && typeof (nodeIncoming as any).pipe === 'function') {
      const services = (c.env as any).services

      const [{ default: Busboy }, { Readable }] = await Promise.all([
        import('busboy'),
        import('node:stream'),
      ])

      const req = nodeIncoming as any
      const bb = Busboy({ headers: (req as any).headers as any })

      let ttlMins: number | undefined
      let metadata: Record<string, any> | undefined
      const uploads: Promise<any>[] = []

      bb.on('field', (name: string, value: string) => {
        if (name === 'ttlMins') {
          const v = value.trim()
          if (v !== '') ttlMins = Number.parseInt(v, 10)
        }
        if (name === 'metadata') {
          const v = value.trim()
          if (v === '') return
          try {
            metadata = JSON.parse(v)
          } catch {
            const err: any = new Error('Invalid metadata JSON format')
            err.status = 400
            bb.emit('error', err)
          }
        }
      })

      bb.on(
        'file',
        (
          name: string,
          file: any,
          info: { filename: string; mimeType: string; encoding: string }
        ) => {
          if (name !== 'file') {
            file.resume()
            return
          }

          const webStream = (Readable as any).toWeb(file as any) as any

          const ttl = Math.max(60, Math.floor(((ttlMins ?? 1440) as number) * 60))

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

      const result = await new Promise<any>((resolve, reject) => {
        bb.on('error', reject)
        bb.on('finish', async () => {
          try {
            if (uploads.length === 0) {
              const err: any = new Error('No file provided')
              err.status = 400
              throw err
            }
            const responses = await Promise.all(uploads)
            resolve(responses.length === 1 ? responses[0] : responses)
          } catch (e) {
            reject(e)
          }
        })

        req.pipe(bb)
      })

      return c.json(result, 201)
    }

    const form = await c.req.formData()

    const ttlMinsRaw = form.get('ttlMins')
    const ttlMins = ttlMinsRaw ? Number.parseInt(String(ttlMinsRaw), 10) : 1440
    const ttl = Math.max(60, Math.floor(ttlMins * 60))

    const metadataRaw = form.get('metadata')
    let metadata: Record<string, any> | undefined
    if (metadataRaw !== null && metadataRaw !== undefined && String(metadataRaw).trim() !== '') {
      try {
        metadata = JSON.parse(String(metadataRaw))
      } catch {
        const err: any = new Error('Invalid metadata JSON format')
        err.status = 400
        throw err
      }
    }

    const files = form.getAll('file')
    if (files.length === 0) {
      const err: any = new Error('No file provided')
      err.status = 400
      throw err
    }

    const services = (c.env as any).services

    const responses = []
    for (const f of files) {
      if (!(f instanceof File)) continue
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

  app.post('/files/url', async (c: Context) => {
    const body = await c.req.json().catch(() => ({}))
    const url = body?.url
    if (!url || typeof url !== 'string') {
      const err: any = new Error('Field "url" is required and must be a string')
      err.status = 400
      throw err
    }

    const ttlMins =
      body?.ttlMins !== undefined && body?.ttlMins !== null
        ? Number.parseInt(String(body.ttlMins), 10)
        : 1440
    const ttl = Math.max(60, Math.floor(ttlMins * 60))

    let metadata: Record<string, any> | undefined
    if (body?.metadata !== undefined) {
      if (typeof body.metadata === 'string' && body.metadata.trim() !== '') {
        try {
          metadata = JSON.parse(body.metadata)
        } catch {
          const err: any = new Error('Invalid metadata JSON format')
          err.status = 400
          throw err
        }
      } else if (typeof body.metadata === 'object' && body.metadata !== null) {
        metadata = body.metadata
      }
    }

    const services = (c.env as any).services
    const resp = await services.files.uploadFileFromUrl({ url, ttl, metadata })
    return c.json(resp, 201)
  })

  app.get('/files/stats', async (c: Context) => {
    const services = (c.env as any).services
    const resp = await services.files.getFileStats()
    return c.json(resp)
  })

  app.get('/files/:id', async (c: Context) => {
    const services = (c.env as any).services
    const resp = await services.files.getFileInfo({ fileId: c.req.param('id') })
    return c.json(resp)
  })

  app.delete('/files/:id', async (c: Context) => {
    const services = (c.env as any).services
    const resp = await services.files.deleteFile({ fileId: c.req.param('id') })
    return c.json(resp)
  })

  app.get('/files', async (c: Context) => {
    const q = c.req.query()
    const services = (c.env as any).services

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

  app.get('/files/:id/exists', async (c: Context) => {
    const fileId = c.req.param('id')
    const services = (c.env as any).services

    const exists = await services.files.fileExists(fileId)
    if (!exists) return c.json({ exists, fileId, isExpired: false })

    const info = await services.files.getFileInfo({ fileId })
    return c.json({ exists, fileId, isExpired: info.file.isExpired })
  })

  return app
}
