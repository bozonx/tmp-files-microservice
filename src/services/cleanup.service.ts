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
    const expired = await this.deps.storage.searchFiles({
      expiredOnly: true,
      limit: 1000,
    })

    for (const file of expired.files) {
      await this.deps.storage.deleteFile(file.id)
    }

    await this.deps.storage.deleteOrphanedFiles()
  }
}
