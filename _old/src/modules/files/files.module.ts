import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { StorageModule } from '../storage/storage.module';

/**
 * Модуль для работы с файлами
 * Предоставляет бизнес-логику для операций с файлами и HTTP endpoints
 */
@Module({
  imports: [
    StorageModule,
    // Настройка Multer для загрузки файлов
    MulterModule.register({
      // Ограничения на размер файла (100MB)
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
      // Фильтр для проверки типов файлов
      fileFilter: (req, file, callback) => {
        // Разрешаем все типы файлов, но можно добавить фильтрацию
        callback(null, true);
      },
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
