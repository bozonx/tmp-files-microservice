import { Test } from '@nestjs/testing'
import { ValidationPipe } from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '@/app.module'
import { HTTP_CONSTANTS } from '@common/constants/http.constants'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { join } from 'path'

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
  const uiSegment = 'ui'
  const staticPrefix = basePath ? `/${basePath}/${uiSegment}/public/` : `/${uiSegment}/public/`
  const uiPath = basePath ? `/${basePath}/${uiSegment}` : `/${uiSegment}`
  const baseRootPath = basePath ? `/${basePath}` : '/'

  await (app as any).register(fastifyStatic, {
    root: join(process.cwd(), 'public'),
    prefix: staticPrefix,
  })

  app.setGlobalPrefix(fullApiPrefix, {
    exclude: [
      { path: uiPath, method: 'GET' as any },
      { path: `${uiPath}/`.replace(/\/+$/, '/'), method: 'GET' as any },
    ],
  })

  const fastifyInstance = app.getHttpAdapter().getInstance()
  const serveIndex = async (request: any, reply: any) => {
    const { readFile } = await import('fs/promises')
    const indexPath = join(process.cwd(), 'public', 'index.html')
    const html = await readFile(indexPath, 'utf-8')
    reply.type('text/html').send(html)
  }

  fastifyInstance.get(baseRootPath, async (request, reply) => {
    reply.redirect(`${uiPath}/`)
  })
  fastifyInstance.get(uiPath, async (request, reply) => {
    reply.redirect(`${uiPath}/`)
  })
  fastifyInstance.get(`${uiPath}/`, serveIndex)

  await app.init()
  // Ensure Fastify has completed plugin registration and routing before tests
  await app.getHttpAdapter().getInstance().ready()
  return app
}
