import type { ErrorHandler } from 'hono'

export function createErrorHandler(): ErrorHandler {
  return (err, c) => {
    const url = new URL(c.req.url)

    const statusCode = (err as any)?.status ?? (err as any)?.statusCode ?? 500
    const message = err instanceof Error ? err.message : 'Internal server error'

    const body = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: url.pathname,
      method: c.req.method,
      message,
      error: err instanceof Error ? err.name : 'UnknownError',
    }

    const logger = (c.env as any)?.logger
    if (logger?.error) {
      logger.error(`${c.req.method} ${url.pathname} - ${statusCode} - ${message}`)
    }

    return c.json(body, statusCode)
  }
}
