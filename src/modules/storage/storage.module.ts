import { Module, Logger } from '@nestjs/common'
import { ConfigService, ConfigModule } from '@nestjs/config'
import { StorageService } from './storage.service.js'
import { RedisService } from './redis.service.js'
import { FileMetadataProvider } from './file-metadata.provider.js'
import { RedisMetadataProvider } from './redis-metadata.provider.js'
import { METADATA_PROVIDER } from './metadata.provider.js'
import { StorageAppConfig } from '../../config/storage.config.js'
import { FILE_STORAGE_PROVIDER } from './storage-provider.interface.js'
import { S3StorageProvider } from './s3-storage.provider.js'

@Module({
  imports: [ConfigModule],
  providers: [
    StorageService,
    RedisService,
    FileMetadataProvider,
    RedisMetadataProvider,
    S3StorageProvider,
    {
      provide: FILE_STORAGE_PROVIDER,
      useClass: S3StorageProvider,
    },
    {
      provide: METADATA_PROVIDER,
      useFactory: (
        configService: ConfigService,
        fileMetadata: FileMetadataProvider,
        redisMetadata: RedisMetadataProvider
      ) => {
        const logger = new Logger('MetadataProviderFactory')
        const config = configService.get<StorageAppConfig>('storage')
        if (config?.redis.enabled) {
          logger.log('Using Redis as metadata provider')
          return redisMetadata
        }
        logger.log('Using filesystem as metadata provider')
        return fileMetadata
      },
      inject: [ConfigService, FileMetadataProvider, RedisMetadataProvider],
    },
  ],
  exports: [StorageService, METADATA_PROVIDER, FILE_STORAGE_PROVIDER],
})
export class StorageModule {}
