import type { AppEnv } from '../config/env.js'
import type { LoggerAdapter } from '../adapters/logger.adapter.js'
import type { StorageService } from './storage.service.js'

export interface CleanupServiceDeps {
  env: AppEnv
  storage: StorageService
  logger: LoggerAdapter
}

export class CleanupService {
  constructor(private readonly deps: CleanupServiceDeps) {}

  public async runCleanup(): Promise<void> {
    const expired = await this.deps.storage.searchFiles({ expiredOnly: true, limit: 1000 })

    const concurrency = 10
    let deleted = 0
    for (let i = 0; i < expired.files.length; i += concurrency) {
      const batch = expired.files.slice(i, i + concurrency)
      const results = await Promise.all(
        batch.map((file) => this.deps.storage.deleteFile(file.id).catch(() => null))
      )
      deleted += results.filter(Boolean).length
    }

    const orphaned = await this.deps.storage.deleteOrphanedFiles()

    this.deps.logger.info('Cleanup completed', {
      expiredTotal: expired.total,
      expiredProcessed: expired.files.length,
      deleted,
      orphanedDeleted: orphaned.deleted,
    })
  }
}
