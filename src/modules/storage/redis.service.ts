import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'
import { StorageAppConfig } from '../../config/storage.config.js'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client: Redis | null = null
  private readonly config: StorageAppConfig['redis']

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<StorageAppConfig>('storage')!.redis
  }

  async onModuleInit() {
    if (!this.config.enabled) {
      return
    }

    try {
      this.client = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000)
          return delay
        },
      })

      this.client.on('connect', () => {
        this.logger.log(`Connected to Redis at ${this.config.host}:${this.config.port}`)
      })

      this.client.on('error', (err) => {
        this.logger.error('Redis error', err)
      })
    } catch (error) {
      this.logger.error('Failed to initialize Redis client', error)
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit()
      this.logger.log('Redis connection closed')
    }
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client is not initialized or disabled')
    }
    return this.client
  }

  isEnabled(): boolean {
    return this.config.enabled
  }
}
