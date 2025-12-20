import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { ConfigService } from '@nestjs/config'
import { StorageService } from '../storage/storage.service.js'
import { CLEANUP_BATCH_SIZE } from '../../common/constants/app.constants.js'

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupService.name)
  private readonly intervalName = 'cleanup'

  private isShuttingDown = false
  private isCleaning = false
  private activeCleanupPromise: Promise<void> | null = null

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry
  ) {}

  markAsShuttingDown(): void {
    this.isShuttingDown = true
    this.logger.log('Cleanup service marked as shutting down. New cleanup tasks will be prevented.')
  }

  onModuleInit(): void {
    // Read cleanup interval (minutes). 0 or negative disables scheduling.
    const minutesRaw = this.configService.get<string>('CLEANUP_INTERVAL_MINS')
    const minutes = Number(minutesRaw ?? 10)
    const validMinutes = Number.isFinite(minutes) ? Math.floor(minutes) : 10

    if (validMinutes <= 0) {
      this.logger.log('Cleanup interval disabled (CLEANUP_INTERVAL_MINS <= 0)')
      return
    }

    // Schedule fixed-interval cleanup; execution logs include deleted files and freed bytes
    const intervalMs = validMinutes * 60_000
    const intervalRef = setInterval(() => {
      this.activeCleanupPromise = this.handleScheduledCleanup().catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err))
        this.logger.error(`Unhandled cleanup error: ${error.message}`, error.stack)
      })
    }, intervalMs)

    this.schedulerRegistry.addInterval(this.intervalName, intervalRef)
    this.logger.log(`Scheduled cleanup with interval: every ${validMinutes} minute(s)`)
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Cleanup service shutting down...')
    try {
      const interval = this.schedulerRegistry.getInterval(this.intervalName)
      clearInterval(interval)
      this.schedulerRegistry.deleteInterval(this.intervalName)
    } catch {
      // ignore if not registered
    }

    if (this.isCleaning && this.activeCleanupPromise) {
      this.logger.log('Waiting for active cleanup task to complete...')
      await this.activeCleanupPromise
    }
  }

  async handleScheduledCleanup(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.debug('Skipping scheduled cleanup because service is shutting down')
      return
    }
    if (this.isCleaning) {
      this.logger.warn('Cleanup already in progress, skipping concurrent execution')
      return
    }
    this.isCleaning = true

    // Store the promise for all cleanup invocations (scheduled and manual)
    const cleanupPromise = (async () => {
      this.logger.log('Starting scheduled cleanup')
      const start = Date.now()
      try {
        const expired = await this.storageService.searchFiles({
          expiredOnly: true,
          limit: CLEANUP_BATCH_SIZE,
        })
        let deleted = 0
        let freed = 0
        for (const file of expired.files) {
          if (this.isShuttingDown) {
            this.logger.log(`Cleanup interrupted by shutdown after processing ${deleted} files`)
            break
          }
          const res = await this.storageService.deleteFile(file.id)
          if (res.success) {
            deleted += 1
            freed += file.size
          }
        }
        this.logger.log(
          `Cleanup completed: ${deleted} files deleted, freed ${freed} bytes in ${Date.now() - start}ms`
        )
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e))
        this.logger.error(`Scheduled cleanup failed: ${error.message}`, error.stack)
      } finally {
        this.isCleaning = false
      }
    })()

    this.activeCleanupPromise = cleanupPromise
    await cleanupPromise
  }
}
