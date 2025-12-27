import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module.js'
import type { AppConfig } from './config/app.config.js'
import { HTTP_CONSTANTS } from './common/constants/http.constants.js'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { join } from 'path'
import { CleanupService } from './modules/cleanup/cleanup.service.js'
import { APP_CLOSE_TIMEOUT_MS } from './common/constants/app.constants.js'

async function bootstrap() {
  // Create app with bufferLogs enabled to capture early logs
  const maxFileSizeMb = parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) || 100
  // Derive Fastify bodyLimit from MAX_FILE_SIZE_MB plus a fixed multipart overhead to ensure
  // uploads fail early at the HTTP layer rather than during service validation.
  const bodyLimit = (maxFileSizeMb + HTTP_CONSTANTS.MULTIPART_OVERHEAD_MB) * 1024 * 1024
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // We'll use Pino logger instead
      bodyLimit,
      forceCloseConnections: false,
    }),
    {
      bufferLogs: true,
    }
  )

  // Use Pino logger for the entire application
  app.useLogger(app.get(Logger))

  const configService = app.get(ConfigService)
  const logger = app.get(Logger)

  const appConfig = configService.get<AppConfig>('app')!

  // Register multipart for file uploads with size limits from storage config
  await (app as any).register(fastifyMultipart, {
    limits: {
      fileSize: configService.get('storage')?.maxFileSize ?? 100 * 1024 * 1024,
    },
  })

  // Register static file serving for UI
  const basePath = appConfig.basePath
  const apiPrefix = 'api/v1'
  const fullApiPrefix = basePath ? `${basePath}/${apiPrefix}` : apiPrefix
  const staticPrefix = basePath ? `/${basePath}/public/` : '/public/'
  const uiPath = basePath ? `/${basePath}` : '/'

  await (app as any).register(fastifyStatic, {
    root: join(process.cwd(), 'public'),
    prefix: staticPrefix,
  })

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  )

  // Configure global API prefix
  app.setGlobalPrefix(fullApiPrefix, {
    exclude: [
      { path: uiPath, method: 'GET' as any },
      { path: `${uiPath}/`.replace(/\/+$/, '/'), method: 'GET' as any },
    ],
  })

  // Register root route for UI directly with Fastify (bypasses global prefix)
  const fastifyInstance = app.getHttpAdapter().getInstance()

  const serveIndex = async (request: any, reply: any) => {
    const { readFile } = await import('fs/promises')
    const indexPath = join(process.cwd(), 'public', 'index.html')
    const html = await readFile(indexPath, 'utf-8')
    reply.type('text/html').send(html)
  }

  if (basePath) {
    // Redirect /sub to /sub/ so that relative paths in index.html work correctly
    fastifyInstance.get(uiPath, async (request, reply) => {
      reply.redirect(`${uiPath}/`)
    })
    fastifyInstance.get(`${uiPath}/`, serveIndex)
  } else {
    fastifyInstance.get('/', serveIndex)
  }

  // Enable graceful shutdown
  // app.enableShutdownHooks() <--- REPLACED WITH CUSTOM LOGIC BELOW

  await app.listen(appConfig.port, appConfig.host)

  logger.log(
    `🚀 NestJS service is running on: http://${appConfig.host}:${appConfig.port}/${fullApiPrefix}`,
    'Bootstrap'
  )
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap')
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap')
  logger.log(`🏠 UI Path: http://${appConfig.host}:${appConfig.port}${uiPath}`, 'Bootstrap')

  // Custom Graceful Shutdown Orchestration
  const cleanupService = app.get(CleanupService)
  let isShuttingDown = false

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true

    const startTime = Date.now()
    logger.log(`🛑 Shutdown signal ${signal} received. Starting graceful shutdown...`, 'Bootstrap')

    try {
      // 1. Prevent new cleanup tasks
      cleanupService.markAsShuttingDown()
      logger.log(
        `✓ Cleanup service marked as shutting down (${Date.now() - startTime}ms)`,
        'Bootstrap'
      )

      // 2. Stop accepting new connections
      // Fastify close() stops the server from accepting new connections and closes existing ones
      // due to forceCloseConnections: true
      logger.log('🛑 Closing HTTP server...', 'Bootstrap')
      await app.getHttpAdapter().getInstance().close()
      logger.log(`✓ HTTP server closed (${Date.now() - startTime}ms)`, 'Bootstrap')

      // 3. Close the NestJS application (triggers OnModuleDestroy, waiting for active cleanup)
      logger.log('🛑 Closing NestJS application...', 'Bootstrap')
      await Promise.race([
        app.close(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('App close timeout')), APP_CLOSE_TIMEOUT_MS)
        ),
      ])
      logger.log(`✓ NestJS application closed (${Date.now() - startTime}ms)`, 'Bootstrap')

      logger.log(`✅ Graceful shutdown completed in ${Date.now() - startTime}ms`, 'Bootstrap')
      process.exit(0)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error(`❌ Error during graceful shutdown: ${err.message}`, err.stack, 'Bootstrap')
      logger.error(`Shutdown failed after ${Date.now() - startTime}ms, forcing exit`, 'Bootstrap')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

void bootstrap()
