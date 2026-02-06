import type { AppEnv } from '../config/env.js'
import type { LoggerAdapter } from '../adapters/logger.adapter.js'
import type { FileStorageAdapter } from '../adapters/file-storage.adapter.js'
import type { MetadataAdapter } from '../adapters/metadata.adapter.js'
import { StorageService } from './storage.service.js'
import { FilesService } from './files.service.js'
import { CleanupService } from './cleanup.service.js'

export interface ServiceFactoryDeps {
  env: AppEnv
  storage: FileStorageAdapter
  metadata: MetadataAdapter
  logger: LoggerAdapter
}

export interface AppServices {
  storage: StorageService
  files: FilesService
  cleanup: CleanupService
}

export function createServices(deps: ServiceFactoryDeps): AppServices {
  const storage = new StorageService({
    env: deps.env,
    fileStorage: deps.storage,
    metadata: deps.metadata,
    logger: deps.logger,
  })

  const files = new FilesService({
    env: deps.env,
    storage,
    logger: deps.logger,
  })

  const cleanup = new CleanupService({
    env: deps.env,
    storage,
    logger: deps.logger,
  })

  return { storage, files, cleanup }
}
