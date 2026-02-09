import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from './config/env.js'
import { ConsoleLoggerAdapter, type LoggerAdapter } from './adapters/logger.adapter.js'
import { createHealthRoutes } from './routes/health.route.js'
import { createDownloadRoutes } from './routes/download.route.js'
import { createMaintenanceRoutes } from './routes/maintenance.route.js'
import { createErrorHandler } from './middleware/error-handler.js'
import { createApiAuthMiddleware } from './middleware/auth.middleware.js'
import { createServices } from './services/services.factory.js'
import type { AppBindings, HonoEnv } from './types/hono.types.js'

export interface AppRouteFactories {
  createFilesRoutes: () => Hono<HonoEnv>
}

export function createApp(bindings: AppBindings, routes: AppRouteFactories): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.use('*', async (c, next) => {
    const url = new URL(c.req.url)

    const headerRequestId = c.req.header('x-request-id')
    const requestId =
      typeof headerRequestId === 'string' && headerRequestId.trim() !== ''
        ? headerRequestId.trim()
        : globalThis.crypto && 'randomUUID' in globalThis.crypto
          ? (globalThis.crypto as unknown as { randomUUID: () => string }).randomUUID()
          : `${Date.now()}_${Math.random().toString(16).slice(2)}`

    c.set('requestId', requestId)
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
        dnsResolver: bindings.dnsResolver,
      })
    )

    const start = Date.now()
    const onError = createErrorHandler()
    try {
      await next()
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      return onError(err, c)
    } finally {
      const durationMs = Date.now() - start
      const statusCode = c.res ? c.res.status : 500
      try {
        c.header('x-request-id', requestId)
      } catch {
        // ignore
      }

      const logger = c.get('logger')
      logger.info('Request completed', {
        requestId,
        method: c.req.method,
        path: url.pathname,
        statusCode,
        durationMs,
      })
    }
  })

  app.onError(createErrorHandler())

  const basePath = bindings.env.BASE_PATH
  const apiBase = basePath ? `/${basePath}/api/v1` : '/api/v1'

  app.use(
    `${apiBase}/*`,
    createApiAuthMiddleware({
      isExcludedPath: (pathname) => pathname.startsWith(`${apiBase}/download/`),
    })
  )

  app.route(apiBase, createHealthRoutes())
  app.route(apiBase, routes.createFilesRoutes())
  app.route(apiBase, createDownloadRoutes())
  app.route(apiBase, createMaintenanceRoutes())

  return app
}

export function createDefaultLogger(env: AppEnv): LoggerAdapter {
  return new ConsoleLoggerAdapter(env.LOG_LEVEL)
}

export function getRequestPath(c: Context): string {
  const url = new URL(c.req.url)
  return url.pathname
}
