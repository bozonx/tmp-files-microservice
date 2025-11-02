import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { getConfig } from './config/app.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    // Получаем конфигурацию
    const config = getConfig();

    // Создаем приложение с Fastify адаптером
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: config.logging.level === 'debug' || config.logging.level === 'verbose',
      }),
    );

    // Регистрируем multipart для загрузки файлов
    await app.register(require('@fastify/multipart'), {
      limits: {
        fileSize: config.storage.maxFileSize,
      },
    });

    // Настройка глобальных фильтров и пайпов
    app.useGlobalFilters(new GlobalExceptionFilter());

    if (config.server.enableGlobalValidation) {
      app.useGlobalPipes(new GlobalValidationPipe());
    }

    // CORS настройки
    if (config.cors.enabled) {
      app.enableCors({
        origin: config.cors.origin,
        credentials: config.cors.credentials,
        methods: config.cors.methods,
        allowedHeaders: config.cors.allowedHeaders,
        exposedHeaders: config.cors.exposedHeaders,
        maxAge: config.cors.maxAge,
      });
    }

    // Установка глобального префикса для API
    const globalPrefix = config.server.basePath
      ? `${config.server.basePath}/${config.server.apiVersion}`
      : config.server.apiVersion;
    app.setGlobalPrefix(globalPrefix);

    // Настройка Swagger (только для разработки)
    if (config.server.enableSwagger) {
      const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');

      const swaggerConfig = new DocumentBuilder()
        .setTitle('Micro File Cache API')
        .setDescription('Микросервис для временного кэширования файлов')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, swaggerConfig);
      const swaggerPath = config.server.basePath ? `${config.server.basePath}/docs` : 'docs';
      SwaggerModule.setup(swaggerPath, app, document);

      logger.log(`Swagger documentation available at /${swaggerPath}`);
    }

    // Запуск приложения
    const port = config.server.port;
    const host = config.server.host;

    await app.listen(port, host);

    logger.log(`🚀 Application is running on: http://${host}:${port}`);
    logger.log(`📚 API documentation: http://${host}:${port}/${config.server.basePath || ''}/docs`);
    logger.log(`🏥 Health check: http://${host}:${port}/${globalPrefix}/health`);
  } catch (error) {
    logger.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();
