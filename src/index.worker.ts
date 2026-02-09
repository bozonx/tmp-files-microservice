/// <reference types="@cloudflare/workers-types" />

import { createApp, createDefaultLogger } from './app.js'
import { loadAppEnv } from './config/env.js'
import { R2StorageAdapter } from './adapters/cloudflare/r2-storage.adapter.js'
import { StorageMetadataAdapter } from './adapters/storage-metadata.adapter.js'
import { createFilesRoutesWorkers } from './routes/files.route.workers.js'

function decodeBasicCredentials(header: string): { user: string; pass: string } | null {
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

  return {
    user: decoded.slice(0, idx),
    pass: decoded.slice(idx + 1),
  }
}

function isBasicConfigured(env: { AUTH_BASIC_USER?: string; AUTH_BASIC_PASS?: string }): boolean {
  return Boolean(env.AUTH_BASIC_USER && env.AUTH_BASIC_PASS)
}

function matchesBasicAuth(
  header: string,
  env: { AUTH_BASIC_USER?: string; AUTH_BASIC_PASS?: string }
): boolean {
  if (!isBasicConfigured(env)) return false
  const creds = decodeBasicCredentials(header)
  if (!creds) return false
  return creds.user === env.AUTH_BASIC_USER && creds.pass === env.AUTH_BASIC_PASS
}

export interface CloudflareBindings {
  R2_BUCKET: R2Bucket
  ASSETS: { fetch: (req: Request) => Promise<Response> }

  BASE_PATH?: string
  LOG_LEVEL?: string
  DOWNLOAD_BASE_URL?: string
  MAX_FILE_SIZE_MB?: string
  ALLOWED_MIME_TYPES?: string

  AUTH_BASIC_USER?: string
  AUTH_BASIC_PASS?: string
  AUTH_BEARER_TOKENS?: string

  MAX_TTL_MIN?: string
}

export default {
  async fetch(request: Request, env: CloudflareBindings, ctx: ExecutionContext): Promise<Response> {
    const appEnv = loadAppEnv(env as unknown as Record<string, unknown>)
    const logger = createDefaultLogger(appEnv)

    const storage = new R2StorageAdapter({ bucket: env.R2_BUCKET })
    const metadata = new StorageMetadataAdapter({ storage })

    const app = createApp(
      { env: appEnv, storage, metadata, logger },
      {
        createFilesRoutes: () => createFilesRoutesWorkers(),
      }
    )

    const url = new URL(request.url)
    const basePath = appEnv.BASE_PATH

    if (appEnv.ENABLE_UI) {
      const rootPath = basePath ? `/${basePath}` : '/'
      const assetsPrefix = basePath ? `/${basePath}/public/` : '/public/'

      const isUiRequest =
        url.pathname === rootPath ||
        url.pathname === `${rootPath}/` ||
        url.pathname.startsWith(assetsPrefix)

      if (isUiRequest) {
        if (isBasicConfigured(appEnv)) {
          const authorization = request.headers.get('authorization') ?? ''
          if (!matchesBasicAuth(authorization, appEnv)) {
            return new Response('Unauthorized', {
              status: 401,
              headers: {
                'www-authenticate': 'Basic realm="UI"',
              },
            })
          }
        }
      }

      if (url.pathname === rootPath || url.pathname === `${rootPath}/`) {
        return env.ASSETS.fetch(request)
      }

      if (url.pathname.startsWith(assetsPrefix)) {
        const newUrl = new URL(request.url)
        newUrl.pathname = url.pathname.replace(assetsPrefix, '/')
        return env.ASSETS.fetch(new Request(newUrl.toString(), request))
      }
    }

    return app.fetch(request, env, ctx)
  },
}
