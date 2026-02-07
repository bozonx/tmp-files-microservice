import type { AppEnv } from '../config/env.js'
import type { LoggerAdapter } from '../adapters/logger.adapter.js'
import type { FileStorageAdapter } from '../adapters/file-storage.adapter.js'
import type { MetadataAdapter } from '../adapters/metadata.adapter.js'
import type { AppServices } from '../services/services.factory.js'

export interface AppBindings {
  env: AppEnv
  storage: FileStorageAdapter
  metadata: MetadataAdapter
  logger: LoggerAdapter
}

export interface AppVariables {
  env: AppEnv
  storage: FileStorageAdapter
  metadata: MetadataAdapter
  logger: LoggerAdapter
  services: AppServices
  requestId: string
}

export type HonoEnv = {
  Bindings: Record<string, unknown> & {
    incoming?: NodeJS.ReadableStream
  }
  Variables: AppVariables
}
