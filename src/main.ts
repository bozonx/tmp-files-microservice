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
  await (app as any).register(fastifyStatic, {
    root: join(process.cwd(), 'public'),
    prefix: '/public/',
  })

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  )

  // Configure global API prefix from configuration
  const globalPrefix = `${appConfig.apiBasePath}/v1`
  app.setGlobalPrefix(globalPrefix, {
    exclude: [{ path: '/', method: 'GET' as any }],
  })

  // Register root route for UI directly with Fastify (bypasses global prefix)
  const fastifyInstance = app.getHttpAdapter().getInstance()
  fastifyInstance.get('/', async (request, reply) => {
    const { readFile } = await import('fs/promises')
    const indexPath = join(process.cwd(), 'public', 'index.html')
    const html = await readFile(indexPath, 'utf-8')
    reply.type('text/html').send(html)
  })

  // Enable graceful shutdown
  app.enableShutdownHooks()

  await app.listen(appConfig.port, appConfig.host)

  logger.log(
    `🚀 NestJS service is running on: http://${appConfig.host}:${appConfig.port}/${globalPrefix}`,
    'Bootstrap'
  )
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap')
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap')

  // Rely on enableShutdownHooks for graceful shutdown
}

void bootstrap()
