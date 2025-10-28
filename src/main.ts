import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { AppModule } from '@/app.module';
import type { AppConfig } from '@config/app.config';

async function bootstrap() {
  // Create app with bufferLogs enabled to capture early logs
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // We'll use Pino logger instead
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

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Register CORS for WunderGraph Gateway integration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(cors as any, {
    origin: true, // Allow all origins for Federation Gateway
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Register Helmet for security headers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(helmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        baseUri: [`'self'`],
        fontSrc: [`'self'`, 'https:', 'data:'],
        formAction: [`'self'`],
        frameAncestors: [`'self'`],
        imgSrc: [`'self'`, 'data:'],
        objectSrc: [`'none'`],
        scriptSrc: [
          `'self'`,
          'https:',
          appConfig.nodeEnv !== 'production' ? `'unsafe-inline'` : undefined,
        ].filter(Boolean) as string[],
        scriptSrcAttr: [`'none'`],
        styleSrc: [
          `'self'`,
          'https:',
          appConfig.nodeEnv !== 'production' ? `'unsafe-inline'` : undefined,
        ].filter(Boolean) as string[],
        ...(appConfig.nodeEnv === 'production' && { upgradeInsecureRequests: [] }),
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: appConfig.nodeEnv === 'production',
    },
  });

  // Configure global API prefix from configuration
  const globalPrefix = `${appConfig.apiBasePath}/${appConfig.apiVersion}`;
  app.setGlobalPrefix(globalPrefix);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(appConfig.port, appConfig.host);

  logger.log(
    `🚀 Micro STT service is running on: http://${appConfig.host}:${appConfig.port}/${globalPrefix}`,
    'Bootstrap',
  );
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap');
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap');

  // Rely on enableShutdownHooks for graceful shutdown
}

void bootstrap();
