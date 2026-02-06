import { Hono, type Context } from 'hono'

export function createDownloadRoutes(): Hono {
  const app = new Hono()

  app.get('/download/:id', async (c: Context) => {
    const services = (c.env as any).services
    const { stream, fileInfo } = await services.files.downloadFileStream({
      fileId: c.req.param('id'),
    })

    c.header('Content-Type', fileInfo.mimeType)
    c.header('Content-Length', String(fileInfo.size))
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    c.header('Pragma', 'no-cache')
    c.header('Expires', '0')

    return new Response(stream as any, { status: 200, headers: c.res.headers })
  })

  return app
}
