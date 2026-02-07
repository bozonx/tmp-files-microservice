import type { ErrorHandler } from 'hono'
import type { HonoEnv } from '../types/hono.types.js'

interface HttpErrorLike {
  status: number
}

function isHttpErrorLike(err: unknown): err is HttpErrorLike {
  if (typeof err !== 'object' || err === null) return false
  if (!('status' in err)) return false
  return typeof (err as { status?: unknown }).status === 'number'
}

export function createErrorHandler(): ErrorHandler<HonoEnv> {
  return (err, c) => {
    const url = new URL(c.req.url)

    const statusCode = isHttpErrorLike(err) ? err.status : 500
    const message = err instanceof Error ? err.message : 'Internal server error'

    const body = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: url.pathname,
      method: c.req.method,
      message,
      error: err instanceof Error ? err.name : 'UnknownError',
    }

    const logger = c.get('logger')
    logger.error('Request failed', {
      method: c.req.method,
      path: url.pathname,
      statusCode,
      message,
      error: err instanceof Error ? err.name : 'UnknownError',
      stack: err instanceof Error ? err.stack : undefined,
    })

    return new Response(JSON.stringify(body), {
      status: statusCode,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }
}
