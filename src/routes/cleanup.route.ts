import { Hono } from 'hono'
import type { Context } from 'hono'
import type { HonoEnv } from '../types/hono.types.js'

export function createCleanupRoutes(): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.post('/cleanup/run', async (c: Context<HonoEnv>) => {
    const services = c.get('services')
    await services.cleanup.runCleanup()
    return c.json({ success: true, message: 'Cleanup completed' })
  })

  return app
}
