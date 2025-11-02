import { Module } from '@nestjs/common';
import { APP_PIPE, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { getConfig } from './config/app.config';
import { HealthController } from './common/controllers/health.controller';
import { StorageTestController } from './common/controllers/storage-test.controller';
import { StorageModule } from './modules/storage/storage.module';
import { FilesModule } from './modules/files/files.module';
import { CleanupModule } from './modules/cleanup/cleanup.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import { AuthGuard } from './common/guards/auth.guard';

@Module({
  imports: [
    // Глобальная конфигурация
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      load: [getConfig],
    }),

    // Модуль для cron jobs (автоматическая очистка)
    ScheduleModule.forRoot(),

    // Модуль для работы с файловым хранилищем
    StorageModule,

    // Модуль для работы с файлами (бизнес-логика)
    FilesModule,

    // Модуль для автоматической очистки устаревших файлов
    CleanupModule,
  ],
  controllers: [HealthController, StorageTestController],
  providers: [
    // Глобальный пайп валидации
    {
      provide: APP_PIPE,
      useClass: GlobalValidationPipe,
    },
    // Глобальный guard аутентификации
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
