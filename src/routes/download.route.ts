import { Hono, type Context } from 'hono'
import type { HonoEnv } from '../types/hono.types.js'
import type { StorageRange } from '../common/interfaces/storage.interface.js'

export function createDownloadRoutes(): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.get('/download/:id', async (c: Context<HonoEnv>) => {
    const services = c.get('services')
    const rangeHeader = c.req.header('Range')
    const fileId = c.req.param('id')

    // Add Accept-Ranges header to all download responses
    c.header('Accept-Ranges', 'bytes')

    let range: StorageRange | undefined
    if (rangeHeader?.startsWith('bytes=')) {
      const bytesRange = rangeHeader.slice(6)
      const [startStr, endStr] = bytesRange.split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : undefined

      if (!isNaN(start)) {
        range = {
          offset: start,
          length: end !== undefined ? end - start + 1 : undefined,
        }
      }
    }

    const fileRes = await services.files.getFileInfo({ fileId })
    const totalSize = fileRes.file.size

    if (range && range.offset >= totalSize) {
      c.header('Content-Range', `bytes */${totalSize}`)
      return new Response('Range Not Satisfiable', { status: 416, headers: c.res.headers })
    }

    if (range?.length !== undefined) {
      const maxPossibleLength = totalSize - range.offset
      range.length = Math.min(range.length, maxPossibleLength)
    }

    const { stream, fileInfo } = await services.files.downloadFileStream({
      fileId,
      range,
    })

    const name = String(fileInfo.originalName || 'file')
    const asciiName = name.replace(/[\r\n"\\]/g, '_')
    const encoded = encodeURIComponent(name)

    c.header('Content-Type', fileInfo.mimeType)
    c.header(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`
    )
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    c.header('Pragma', 'no-cache')
    c.header('Expires', '0')

    if (range) {
      const start = range.offset
      const end = range.length ? Math.min(start + range.length - 1, totalSize - 1) : totalSize - 1
      const actualLength = end - start + 1

      c.header('Content-Length', String(actualLength))
      c.header('Content-Range', `bytes ${start}-${end}/${totalSize}`)

      return new Response(stream, { status: 206, headers: c.res.headers })
    }

    c.header('Content-Length', String(totalSize))
    return new Response(stream, { status: 200, headers: c.res.headers })
  })

  return app
}
