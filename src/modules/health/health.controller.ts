import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';

/**
 * Health check controller using NestJS Terminus
 * Provides standardized health check endpoints
 */
@Controller('health')
export class HealthController {
  private readonly serviceStartMs = Date.now();

  constructor(private readonly health: HealthCheckService) {}

  /**
   * Basic health check endpoint
   * Returns service status
   * Note: This is a basic check. External service dependencies
   * should be monitored separately in production
   */
  @Get()
  @HealthCheck()
  public async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Basic service health - always up if the service is running
      () => ({ service: { status: 'up' } }),
    ]);
  }

  /**
   * Readiness probe endpoint
   * Checks if the service is ready to accept requests
   */
  @Get('ready')
  @HealthCheck()
  public async ready(): Promise<HealthCheckResult> {
    return this.health.check([
      // Add any readiness checks here
      // For now, just return a basic check
      () => ({ ready: { status: 'up' } }),
    ]);
  }

  /**
   * Liveness probe endpoint
   * Simple check to verify the service is running
   */
  @Get('live')
  @HealthCheck()
  public async live(): Promise<HealthCheckResult> {
    const uptime = Date.now() - this.serviceStartMs;
    return this.health.check([() => ({ uptime: { status: 'up', uptime } })]);
  }
}
