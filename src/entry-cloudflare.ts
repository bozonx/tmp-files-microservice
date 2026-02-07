/// <reference types="@cloudflare/workers-types" />

import { createApp, createDefaultLogger } from './app.js'
import { loadAppEnv } from './config/env.js'
import { R2StorageAdapter } from './adapters/cloudflare/r2-storage.adapter.js'
import { KvMetadataAdapter } from './adapters/cloudflare/kv-metadata.adapter.js'
import { createFilesRoutesWorkers } from './routes/files.route.workers.js'

export interface CloudflareBindings {
  R2_BUCKET: R2Bucket
  METADATA_KV: KVNamespace
  ASSETS: { fetch: (req: Request) => Promise<Response> }

  BASE_PATH?: string
  LOG_LEVEL?: string
  DOWNLOAD_BASE_URL?: string
  MAX_FILE_SIZE_MB?: string
  ALLOWED_MIME_TYPES?: string
  ENABLE_DEDUPLICATION?: string
  MAX_TTL_MIN?: string
  CLEANUP_INTERVAL_MINS?: string
}

export default {
  async fetch(request: Request, env: CloudflareBindings, ctx: ExecutionContext): Promise<Response> {
    const appEnv = loadAppEnv(env as unknown as Record<string, unknown>)
    const logger = createDefaultLogger(appEnv)

    const storage = new R2StorageAdapter({ bucket: env.R2_BUCKET })
    const metadata = new KvMetadataAdapter({ kv: env.METADATA_KV })

    const app = createApp(
      { env: appEnv, storage, metadata, logger },
      {
        createFilesRoutes: () => createFilesRoutesWorkers(),
      }
    )

    const url = new URL(request.url)
    const basePath = appEnv.BASE_PATH
    const uiPrefix = basePath ? `/${basePath}/ui` : '/ui'

    if (url.pathname === (basePath ? `/${basePath}` : '/') || url.pathname === uiPrefix) {
      return Response.redirect(`${uiPrefix}/`, 302)
    }

    if (url.pathname === `${uiPrefix}/` || url.pathname.startsWith(`${uiPrefix}/public/`)) {
      return env.ASSETS.fetch(request)
    }

    return app.fetch(request, env, ctx)
  },

  scheduled(_event: ScheduledEvent, env: CloudflareBindings, ctx: ExecutionContext): void {
    const appEnv = loadAppEnv(env as unknown as Record<string, unknown>)
    const logger = createDefaultLogger(appEnv)

    const storage = new R2StorageAdapter({ bucket: env.R2_BUCKET })
    const metadata = new KvMetadataAdapter({ kv: env.METADATA_KV })
    const app = createApp(
      { env: appEnv, storage, metadata, logger },
      {
        createFilesRoutes: () => createFilesRoutesWorkers(),
      }
    )

    const basePath = appEnv.BASE_PATH
    const apiBase = basePath ? `/${basePath}/api/v1` : '/api/v1'

    ctx.waitUntil(
      Promise.resolve(
        app.fetch(
          new Request(`http://internal${apiBase}/cleanup/run`, { method: 'POST' }),
          env,
          ctx
        )
      )
    )
  },
}
