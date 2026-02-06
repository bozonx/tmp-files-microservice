import { Module, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { StorageService } from './storage.service.js'
import { RedisService } from './redis.service.js'
import { FileMetadataProvider } from './file-metadata.provider.js'
import { RedisMetadataProvider } from './redis-metadata.provider.js'
import { METADATA_PROVIDER } from './metadata.provider.js'
import { StorageAppConfig } from '../../config/storage.config.js'

@Module({
  providers: [
    StorageService,
    RedisService,
    FileMetadataProvider,
    RedisMetadataProvider,
    {
      provide: METADATA_PROVIDER,
      inject: [ConfigService, FileMetadataProvider, RedisMetadataProvider],
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
    },
  ],
  exports: [StorageService, METADATA_PROVIDER],
})
export class StorageModule {}
