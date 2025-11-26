import { Module } from '@nestjs/common'
import { FilesController } from './files.controller'
import { DownloadController } from './download.controller'
import { FilesService } from './files.service'
import { StorageModule } from '@modules/storage/storage.module'

@Module({
  imports: [StorageModule],
  controllers: [FilesController, DownloadController],
  providers: [FilesService],
})
export class FilesModule {}
