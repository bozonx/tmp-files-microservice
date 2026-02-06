import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono.types.js'

export function createHealthRoutes(): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.get('/health', (c) => c.json({ status: 'ok' }))

  return app
}
