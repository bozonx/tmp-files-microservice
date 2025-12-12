import { Module } from '@nestjs/common'
import { CleanupService } from './cleanup.service.js'
import { StorageModule } from '../storage/storage.module.js'
import { CleanupController } from './cleanup.controller.js'

@Module({
  imports: [StorageModule],
  controllers: [CleanupController],
  providers: [CleanupService],
})
export class CleanupModule {}
