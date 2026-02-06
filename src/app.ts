import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from './config/env.js'
import { ConsoleLoggerAdapter, type LoggerAdapter } from './adapters/logger.adapter.js'
import { createHealthRoutes } from './routes/health.route.js'
import { createFilesRoutes } from './routes/files.route.js'
import { createDownloadRoutes } from './routes/download.route.js'
import { createCleanupRoutes } from './routes/cleanup.route.js'
import { createErrorHandler } from './middleware/error-handler.js'
import { createServices } from './services/services.factory.js'
import type { AppBindings, HonoEnv } from './types/hono.types.js'

export function createApp(bindings: AppBindings): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.use('*', async (c, next) => {
    c.set('env', bindings.env)
    c.set('storage', bindings.storage)
    c.set('metadata', bindings.metadata)
    c.set('logger', bindings.logger)
    c.set(
      'services',
      createServices({
        env: bindings.env,
        storage: bindings.storage,
        metadata: bindings.metadata,
        logger: bindings.logger,
      })
    )
    await next()
  })

  app.onError(createErrorHandler())

  const basePath = bindings.env.BASE_PATH
  const apiBase = basePath ? `/${basePath}/api/v1` : '/api/v1'

  app.route(apiBase, createHealthRoutes())
  app.route(apiBase, createFilesRoutes())
  app.route(apiBase, createDownloadRoutes())
  app.route(apiBase, createCleanupRoutes())

  return app
}

export function createDefaultLogger(env: AppEnv): LoggerAdapter {
  return new ConsoleLoggerAdapter(env.LOG_LEVEL)
}

export function getRequestPath(c: Context): string {
  const url = new URL(c.req.url)
  return url.pathname
}
