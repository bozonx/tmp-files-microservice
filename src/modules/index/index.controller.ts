import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@config/app.config';
import { readPackageVersion } from '@/utils/package-version.utils';
import { SERVICE_METADATA } from '@common/constants/app.constants';

@Controller()
export class IndexController {
  private readonly version: string = readPackageVersion();

  constructor(private readonly configService: ConfigService) {}

  @Get()
  public index() {
    const appConfig = this.configService.get<AppConfig>('app')!;
    const base = `/${appConfig.apiBasePath}/${appConfig.apiVersion}`;
    return {
      name: SERVICE_METADATA.NAME,
      version: this.version,
      status: 'ok',
      time: new Date().toISOString(),
      links: {
        self: base,
        health: `${base}/health`,
        transcriptions: `${base}/transcriptions`,
      },
    } as const;
  }
}
