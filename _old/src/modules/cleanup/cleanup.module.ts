/**
 * Модуль для автоматической очистки устаревших файлов
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { CleanupService } from './cleanup.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), StorageModule],
  providers: [CleanupService],
  exports: [CleanupService],
})
export class CleanupModule {}
