import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from '@/app.module';
import type { AppConfig } from '@config/app.config';
import { HTTP_CONSTANTS } from '@common/constants/http.constants';

async function bootstrap() {
  // Create app with bufferLogs enabled to capture early logs
  const maxFileSizeMb = parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) || 100;
  const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
  const bodyLimit = maxFileSizeBytes + HTTP_CONSTANTS.MULTIPART_OVERHEAD_BYTES;
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // We'll use Pino logger instead
      bodyLimit,
    }),
    {
      bufferLogs: true,
    },
  );

  // Use Pino logger for the entire application
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  const appConfig = configService.get<AppConfig>('app')!;

  // Register multipart for file uploads with size limits from storage config
  await (app as any).register(require('@fastify/multipart'), {
    limits: {
      fileSize: (configService.get('storage') as any)?.maxFileSize ?? 100 * 1024 * 1024,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Configure global API prefix from configuration
  const globalPrefix = `${appConfig.apiBasePath}/v1`;
  app.setGlobalPrefix(globalPrefix);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(appConfig.port, appConfig.host);

  logger.log(
    `🚀 NestJS service is running on: http://${appConfig.host}:${appConfig.port}/${globalPrefix}`,
    'Bootstrap',
  );
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap');
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap');

  // Rely on enableShutdownHooks for graceful shutdown
}

void bootstrap();
