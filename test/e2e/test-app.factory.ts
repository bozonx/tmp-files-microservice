import { Test } from '@nestjs/testing'
import { ValidationPipe } from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '@/app.module'
import { HTTP_CONSTANTS } from '@common/constants/http.constants'

export async function createTestApp(): Promise<NestFastifyApplication> {
  // Ensure defaults the same as in main.ts
  process.env.API_BASE_PATH = process.env.API_BASE_PATH ?? 'api'

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const maxFileSizeMb = parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) || 100
  const bodyLimit = (maxFileSizeMb + HTTP_CONSTANTS.MULTIPART_OVERHEAD_MB) * 1024 * 1024
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({
      logger: false, // We'll use Pino logger instead
      bodyLimit,
    })
  )

  await (app as any).register(require('@fastify/multipart'), {
    limits: {
      fileSize: maxFileSizeMb * 1024 * 1024,
    },
  })

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  )

  const apiBasePath = (process.env.API_BASE_PATH || 'api').replace(/^\/+|\/+$/g, '')
  app.setGlobalPrefix(`${apiBasePath}/v1`)

  await app.init()
  // Ensure Fastify has completed plugin registration and routing before tests
  await app.getHttpAdapter().getInstance().ready()
  return app
}
