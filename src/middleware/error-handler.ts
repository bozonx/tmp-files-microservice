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
    const requestId = (c.get as unknown as (key: string) => unknown)('requestId')

    const body = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: url.pathname,
      method: c.req.method,
      message,
      error: err instanceof Error ? err.name : 'UnknownError',
      requestId: typeof requestId === 'string' ? requestId : undefined,
    }

    const maybeLogger = ((): unknown => {
      try {
        return (c.get as unknown as (key: string) => unknown)('logger')
      } catch {
        return undefined
      }
    })()

    const logMeta = {
      requestId: typeof requestId === 'string' ? requestId : undefined,
      method: c.req.method,
      path: url.pathname,
      statusCode,
      message: rawMessage,
      error: err instanceof Error ? err.name : 'UnknownError',
      stack: err instanceof Error ? err.stack : undefined,
    }

    if (
      typeof maybeLogger === 'object' &&
      maybeLogger !== null &&
      'error' in maybeLogger &&
      typeof (maybeLogger as { error?: unknown }).error === 'function'
    ) {
      ;(maybeLogger as { error: (message: string, meta?: Record<string, unknown>) => void }).error(
        'Request failed',
        logMeta
      )
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
