import { Module } from '@nestjs/common'
import { FilesController } from './files.controller.js'
import { DownloadController } from './download.controller.js'
import { FilesService } from './files.service.js'
import { StorageModule } from '../storage/storage.module.js'

@Module({
  imports: [StorageModule],
  controllers: [FilesController, DownloadController],
  providers: [FilesService],
})
export class FilesModule {}
