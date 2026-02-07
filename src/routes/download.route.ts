import { Hono, type Context } from 'hono'
import type { HonoEnv } from '../types/hono.types.js'

export function createDownloadRoutes(): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.get('/download/:id', async (c: Context<HonoEnv>) => {
    const services = c.get('services')
    const { stream, fileInfo } = await services.files.downloadFileStream({
      fileId: c.req.param('id'),
    })

    const name = String(fileInfo.originalName || 'file')
    const asciiName = name.replace(/[\r\n"\\]/g, '_')
    const encoded = encodeURIComponent(name)

    c.header('Content-Type', fileInfo.mimeType)
    c.header('Content-Length', String(fileInfo.size))
    c.header(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`
    )
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    c.header('Pragma', 'no-cache')
    c.header('Expires', '0')

    return new Response(stream, { status: 200, headers: c.res.headers })
  })

  return app
}
