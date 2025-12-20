import { Test } from '@nestjs/testing'
import { ValidationPipe } from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '@/app.module'
import { HTTP_CONSTANTS } from '@common/constants/http.constants'
import fastifyMultipart from '@fastify/multipart'

export async function createTestApp(): Promise<NestFastifyApplication> {
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

  await (app as any).register(fastifyMultipart, {
    limits: {
      fileSize: maxFileSizeMb * 1024 * 1024,
    },
  })

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  )

  const basePath = (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '')
  const apiPrefix = 'api/v1'
  const fullApiPrefix = basePath ? `${basePath}/${apiPrefix}` : apiPrefix
  app.setGlobalPrefix(fullApiPrefix)

  await app.init()
  // Ensure Fastify has completed plugin registration and routing before tests
  await app.getHttpAdapter().getInstance().ready()
  return app
}
