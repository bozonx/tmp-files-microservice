import { Hono, type Context } from 'hono'
import type { HonoEnv } from '../types/hono.types.js'
import type { StorageRange } from '../common/interfaces/storage.interface.js'

function parseRangeHeader(
  rangeHeader: string,
  totalSize: number
): { range?: StorageRange; errorStatus?: 400 | 416 } {
  const raw = rangeHeader.trim()
  if (raw === '') return {}
  if (!raw.toLowerCase().startsWith('bytes=')) return { errorStatus: 400 }

  const spec = raw.slice(6).trim()
  if (spec === '') return { errorStatus: 400 }
  if (spec.includes(',')) return { errorStatus: 416 }

  const [startStr, endStr] = spec.split('-')
  if (startStr === undefined || endStr === undefined) return { errorStatus: 400 }

  // suffix range: bytes=-500
  if (startStr.trim() === '') {
    const suffixLen = Number.parseInt(endStr, 10)
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) return { errorStatus: 400 }
    if (totalSize <= 0) return { errorStatus: 416 }
    const length = Math.min(suffixLen, totalSize)
    return { range: { offset: totalSize - length, length } }
  }

  const start = Number.parseInt(startStr, 10)
  if (!Number.isFinite(start) || start < 0) return { errorStatus: 400 }
  if (start >= totalSize) return { errorStatus: 416 }

  // open-ended range: bytes=100-
  if (endStr.trim() === '') {
    return { range: { offset: start } }
  }

  const end = Number.parseInt(endStr, 10)
  if (!Number.isFinite(end) || end < 0) return { errorStatus: 400 }
  if (end < start) return { errorStatus: 416 }

  const clampedEnd = Math.min(end, totalSize - 1)
  return { range: { offset: start, length: clampedEnd - start + 1 } }
}

export function createDownloadRoutes(): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.get('/download/:id', async (c: Context<HonoEnv>) => {
    const services = c.get('services')
    const rangeHeader = c.req.header('Range')
    const fileId = c.req.param('id')

    // Add Accept-Ranges header to all download responses
    c.header('Accept-Ranges', 'bytes')

    const fileRes = await services.files.getFileInfo({ fileId })
    const totalSize = fileRes.file.size

    let range: StorageRange | undefined
    if (rangeHeader) {
      const parsed = parseRangeHeader(rangeHeader, totalSize)
      if (parsed.errorStatus === 400) {
        return new Response('Invalid Range header', { status: 400, headers: c.res.headers })
      }
      if (parsed.errorStatus === 416) {
        c.header('Content-Range', `bytes */${totalSize}`)
        return new Response('Range Not Satisfiable', { status: 416, headers: c.res.headers })
      }
      range = parsed.range
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
