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
    const rawMessage = err instanceof Error ? err.message : 'Internal server error'
    const message = statusCode >= 500 ? 'Internal server error' : rawMessage
    const requestId = c.get('requestId')

    const body = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: url.pathname,
      method: c.req.method,
      message,
      error: err instanceof Error ? err.name : 'UnknownError',
      requestId,
    }

    const maybeLogger = c.get('logger')

    const logMeta = {
      requestId,
      method: c.req.method,
      path: url.pathname,
      statusCode,
      message: rawMessage,
      error: err instanceof Error ? err.name : 'UnknownError',
      stack: statusCode >= 500 && err instanceof Error ? err.stack : undefined,
      cause:
        statusCode >= 500 && err instanceof Error
          ? String((err as { cause?: unknown }).cause ?? '') || undefined
          : undefined,
    }

    if (maybeLogger) {
      maybeLogger.error('Request failed', logMeta)
    } else {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', ...logMeta })
      )
    }

    return new Response(JSON.stringify(body), {
      status: statusCode,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }
}
