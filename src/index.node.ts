import { serve } from '@hono/node-server'
import type { HttpBindings } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { S3Client } from '@aws-sdk/client-s3'
import { createApp, createDefaultLogger } from './app.js'
import { loadAppEnv } from './config/env.js'
import { S3StorageAdapter } from './adapters/node/s3-storage.adapter.js'
import { StorageMetadataAdapter } from './adapters/storage-metadata.adapter.js'
import { createServices } from './services/services.factory.js'
import { createErrorHandler } from './middleware/error-handler.js'
import { createUiBasicAuthMiddleware } from './middleware/auth.middleware.js'
import type { HonoEnv } from './types/hono.types.js'
import { createFilesRoutesNode } from './routes/files.route.node.js'
import { NodeDnsResolver } from './adapters/node/dns-resolver.node.js'

const env = loadAppEnv(process.env)
const logger = createDefaultLogger(env)

if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
  throw new Error(
    'S3 credentials are required in Node runtime (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)'
  )
}

const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
})

const storage = new S3StorageAdapter({ client: s3Client, bucket: env.S3_BUCKET })

const metadata = new StorageMetadataAdapter({ storage })

const dnsResolver = new NodeDnsResolver()

const apiApp = createApp(
  { env, storage, metadata, logger, dnsResolver },
  {
    createFilesRoutes: () => createFilesRoutesNode(),
  }
)

const app = new Hono<HonoEnv>()

app.onError(createErrorHandler())

app.route('/', apiApp)

const basePath = env.BASE_PATH
const rootPath = basePath ? `/${basePath}` : '/'

if (env.ENABLE_UI) {
  app.use('*', async (c, next) => {
    c.set('env', env)
    await next()
  })

  app.use(`${rootPath}/*`, createUiBasicAuthMiddleware())

  app.get(rootPath, async () => {
    const { readFile } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    const html = await readFile(resolve(process.cwd(), 'public', 'index.html'), 'utf-8')
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache',
      },
    })
  })

  const assetsPrefix = basePath ? `/${basePath}/public` : '/public'
  app.use(
    `${assetsPrefix}/*`,
    serveStatic({
      root: './public',
      rewriteRequestPath: (path) => path.replace(new RegExp(`^${assetsPrefix}`), ''),
    })
  )
}

// Create services once for background cleanup loop.
// Route-level services are created per request in app.ts.
const services = createServices({ env, storage, metadata, logger, dnsResolver })

const server = serve(
  {
    fetch: app.fetch,
    port: env.LISTEN_PORT,
    hostname: env.LISTEN_HOST,
  },
  (info: { port: number }) => {
    logger.info('Server started', {
      url: `http://${env.LISTEN_HOST}:${info.port}${env.BASE_PATH ? `/${env.BASE_PATH}` : ''}`,
    })
  }
)

async function shutdown(signal: string): Promise<void> {
  logger.warn('Shutdown signal received', { signal })

  server.close(() => {
    logger.info('HTTP server closed')
  })

  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  logger.error('Unhandled promise rejection', { error: err.message, stack: err.stack })
})

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack })
  void shutdown('uncaughtException')
})

// Expose Node bindings typing (used by routes when detecting multipart streaming)
export type NodeHonoBindings = HttpBindings
