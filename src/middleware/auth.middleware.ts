import type { MiddlewareHandler } from 'hono'
import { HttpError } from '../common/errors/http.error.js'
import type { AppEnv } from '../config/env.js'

interface BasicCredentials {
  user: string
  pass: string
}

function decodeBasicCredentials(header: string): BasicCredentials | null {
  const raw = header.trim()
  if (!raw.toLowerCase().startsWith('basic ')) return null

  const b64 = raw.slice(6).trim()
  if (b64 === '') return null

  let decoded = ''
  try {
    decoded = atob(b64)
  } catch {
    return null
  }

  const idx = decoded.indexOf(':')
  if (idx < 0) return null

  const user = decoded.slice(0, idx)
  const pass = decoded.slice(idx + 1)

  return { user, pass }
}

function isBasicConfigured(env: AppEnv): boolean {
  return Boolean(env.AUTH_BASIC_USER && env.AUTH_BASIC_PASS)
}

function isBearerConfigured(env: AppEnv): boolean {
  return Array.isArray(env.AUTH_BEARER_TOKENS) && env.AUTH_BEARER_TOKENS.length > 0
}

function isAnyAuthConfigured(env: AppEnv): boolean {
  return isBasicConfigured(env) || isBearerConfigured(env)
}

function matchesBearerToken(authorization: string, env: AppEnv): boolean {
  const raw = authorization.trim()
  if (!raw.toLowerCase().startsWith('bearer ')) return false
  const token = raw.slice(7).trim()
  if (token === '') return false
  return env.AUTH_BEARER_TOKENS.includes(token)
}

function matchesBasicAuth(authorization: string, env: AppEnv): boolean {
  if (!isBasicConfigured(env)) return false
  const creds = decodeBasicCredentials(authorization)
  if (!creds) return false
  return creds.user === env.AUTH_BASIC_USER && creds.pass === env.AUTH_BASIC_PASS
}

export function createApiAuthMiddleware(options: {
  isExcludedPath: (pathname: string) => boolean
}): MiddlewareHandler {
  return async (c, next) => {
    const env = c.get('env')
    if (!isAnyAuthConfigured(env)) {
      await next()
      return
    }

    const url = new URL(c.req.url)
    if (options.isExcludedPath(url.pathname)) {
      await next()
      return
    }

    const authorization = c.req.header('authorization') ?? ''

    const ok =
      (authorization !== '' && matchesBasicAuth(authorization, env)) ||
      (authorization !== '' && matchesBearerToken(authorization, env))

    if (!ok) {
      throw new HttpError('Unauthorized', 401)
    }

    await next()
  }
}

export function createUiBasicAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const env = c.get('env')
    if (!isBasicConfigured(env)) {
      await next()
      return
    }

    const authorization = c.req.header('authorization') ?? ''
    if (!matchesBasicAuth(authorization, env)) {
      return new Response('Unauthorized', {
        status: 401,
        headers: {
          'www-authenticate': 'Basic realm="UI"',
        },
      })
    }

    await next()
  }
}
