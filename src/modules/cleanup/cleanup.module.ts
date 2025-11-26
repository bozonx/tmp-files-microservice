import { Module } from '@nestjs/common'
import { CleanupService } from './cleanup.service'
import { StorageModule } from '@modules/storage/storage.module'
import { CleanupController } from './cleanup.controller'

@Module({
  imports: [StorageModule],
  controllers: [CleanupController],
  providers: [CleanupService],
})
export class CleanupModule {}
