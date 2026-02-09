/// <reference types="@cloudflare/workers-types" />

import { createApp, createDefaultLogger } from './app.js'
import { loadAppEnv } from './config/env.js'
import { R2StorageAdapter } from './adapters/cloudflare/r2-storage.adapter.js'
import { StorageMetadataAdapter } from './adapters/storage-metadata.adapter.js'
import { createFilesRoutesWorkers } from './routes/files.route.workers.js'

export interface CloudflareBindings {
  R2_BUCKET: R2Bucket
  ASSETS: { fetch: (req: Request) => Promise<Response> }

  BASE_PATH?: string
  LOG_LEVEL?: string
  DOWNLOAD_BASE_URL?: string
  MAX_FILE_SIZE_MB?: string
  ALLOWED_MIME_TYPES?: string
  ENABLE_DEDUPLICATION?: string
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
