import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from './config/env.js'
import { ConsoleLoggerAdapter, type LoggerAdapter } from './adapters/logger.adapter.js'
import type { FileStorageAdapter } from './adapters/file-storage.adapter.js'
import type { MetadataAdapter } from './adapters/metadata.adapter.js'
import { createHealthRoutes } from './routes/health.route.js'
import { createFilesRoutes } from './routes/files.route.js'
import { createDownloadRoutes } from './routes/download.route.js'
import { createCleanupRoutes } from './routes/cleanup.route.js'
import { createErrorHandler } from './middleware/error-handler.js'
import { createServices, type AppServices } from './services/services.factory.js'

export interface AppBindings {
  env: AppEnv
  storage: FileStorageAdapter
  metadata: MetadataAdapter
  logger: LoggerAdapter
  services: AppServices
}

export function createApp(bindings: Omit<AppBindings, 'services'>): Hono<{ Bindings: AppBindings }> {
  const app = new Hono<{ Bindings: AppBindings }>()

  app.use('*', async (c, next) => {
    ;(c.env as any).env = bindings.env
    ;(c.env as any).storage = bindings.storage
    ;(c.env as any).metadata = bindings.metadata
    ;(c.env as any).logger = bindings.logger
    ;(c.env as any).services = createServices({
      env: bindings.env,
      storage: bindings.storage,
      metadata: bindings.metadata,
      logger: bindings.logger,
    })
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
