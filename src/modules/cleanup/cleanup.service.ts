import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '@modules/storage/storage.service';

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupService.name);
  private readonly intervalName = 'cleanup';

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    // Read cleanup interval (minutes). 0 or negative disables scheduling.
    const minutesRaw = this.configService.get<string>('CLEANUP_INTERVAL_MINS');
    const minutes = Number(minutesRaw ?? 10);
    const validMinutes = Number.isFinite(minutes) ? Math.floor(minutes) : 10;

    if (validMinutes <= 0) {
      this.logger.log('Cleanup interval disabled (CLEANUP_INTERVAL_MINS <= 0)');
      return;
    }

    // Schedule fixed-interval cleanup; execution logs include deleted files and freed bytes
    const intervalMs = validMinutes * 60_000;
    const intervalRef = setInterval(() => {
      void this.handleScheduledCleanup();
    }, intervalMs);

    this.schedulerRegistry.addInterval(this.intervalName, intervalRef);
    this.logger.log(`Scheduled cleanup with interval: every ${validMinutes} minute(s)`);
  }

  onModuleDestroy(): void {
    try {
      const interval = this.schedulerRegistry.getInterval(this.intervalName);
      clearInterval(interval);
      this.schedulerRegistry.deleteInterval(this.intervalName);
    } catch {
      // ignore if not registered
    }
  }

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
