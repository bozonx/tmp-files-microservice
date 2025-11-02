import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '@modules/storage/storage.service';
import { DateUtil } from '@common/utils/date.util';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly storageService: StorageService) {}

  @Cron('0 */10 * * * *')
  async handleScheduledCleanup(): Promise<void> {
    this.logger.log('Starting scheduled cleanup');
    const start = Date.now();
    try {
      const expired = await this.storageService.searchFiles({ expiredOnly: true, limit: 10000 });
      let deleted = 0;
      let freed = 0;
      for (const file of expired.files) {
        const res = await this.storageService.deleteFile(file.id);
        if (res.success) {
          deleted += 1;
          freed += file.size;
        }
      }
      this.logger.log(
        `Cleanup completed: ${deleted} files deleted, freed ${freed} bytes in ${Date.now() - start}ms`,
      );
    } catch (e: any) {
      this.logger.error(`Scheduled cleanup failed: ${e.message}`);
    }
  }
}
