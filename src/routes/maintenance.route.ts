import { Hono } from 'hono'
import type { Context } from 'hono'
import type { HonoEnv } from '../types/hono.types.js'

export function createMaintenanceRoutes(): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.post('/maintenance/run', async (c: Context<HonoEnv>) => {
    const logger = c.get('logger')
    logger.info('Starting maintenance cycle')
    
    try {
      const services = c.get('services')
      await services.cleanup.runCleanup()
      logger.info('Maintenance cycle completed successfully')
      return c.json({ success: true, message: 'Maintenance completed' })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      logger.error('Maintenance cycle failed', { error: err.message, stack: err.stack })
      throw err
    }
  })

  return app
}
