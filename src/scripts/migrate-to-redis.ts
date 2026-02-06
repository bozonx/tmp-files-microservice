import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { StorageService } from '../modules/storage/storage.service.js';
import { FileMetadataProvider } from '../modules/storage/file-metadata.provider.js';
import { RedisMetadataProvider } from '../modules/storage/redis-metadata.provider.js';
import { METADATA_PROVIDER } from '../modules/storage/metadata.provider.js';
import { Logger } from '@nestjs/common';

async function migrate() {
  const logger = new Logger('Migration');
  logger.log('Starting migration from file to Redis...');

  const app = await NestFactory.createApplicationContext(AppModule);
  
  const fileProvider = app.get(FileMetadataProvider);
  const redisProvider = app.get(RedisMetadataProvider);

  try {
    await fileProvider.initialize();
    await redisProvider.initialize();

    const fileIds = await fileProvider.getAllFileIds();
    logger.log(`Found ${fileIds.length} files to migrate`);

    let migrated = 0;
    for (const id of fileIds) {
      const fileInfo = await fileProvider.getFileInfo(id);
      if (fileInfo) {
        await redisProvider.saveFileInfo(fileInfo);
        migrated++;
        if (migrated % 100 === 0) {
          logger.log(`Migrated ${migrated}/${fileIds.length} files...`);
        }
      }
    }

    logger.log(`Migration completed! Total migrated: ${migrated}`);
  } catch (error) {
    logger.error('Migration failed', error);
  } finally {
    await app.close();
  }
}

migrate();
