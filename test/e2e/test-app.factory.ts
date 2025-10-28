import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '@/app.module';

export async function createTestApp(): Promise<NestFastifyApplication> {
  // Ensure defaults the same as in main.ts
  process.env.API_BASE_PATH = process.env.API_BASE_PATH ?? 'api';
  process.env.API_VERSION = process.env.API_VERSION ?? 'v1';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({
      logger: false, // We'll use Pino logger instead
    })
  );

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const apiBasePath = (process.env.API_BASE_PATH || 'api').replace(/^\/+|\/+$/g, '');
  const apiVersion = (process.env.API_VERSION || 'v1').replace(/^\/+|\/+$/g, '');
  app.setGlobalPrefix(`${apiBasePath}/${apiVersion}`);

  await app.init();
  // Ensure Fastify has completed plugin registration and routing before tests
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
