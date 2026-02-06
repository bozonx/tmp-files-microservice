import { Hono } from 'hono'

export function createCleanupRoutes(): Hono {
  const app = new Hono()

  app.post('/cleanup/run', async (c) => {
    const services = (c.env as any).services
    await services.cleanup.runCleanup()
    return c.json({ success: true, message: 'Cleanup completed' })
  })

  return app
}
