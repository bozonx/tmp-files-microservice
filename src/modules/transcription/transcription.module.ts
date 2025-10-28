import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TranscriptionService } from './transcription.service';
import { TranscriptionController } from './transcription.controller';
import { AssemblyAiProvider } from '@providers/assemblyai/assemblyai.provider';
import type { SttConfig } from '@config/stt.config';
import { SttProviderRegistry } from '@/providers/stt-provider.registry';
import { STT_PROVIDER } from '@common/constants/tokens';

/**
 * Transcription module
 * Provides speech-to-text transcription functionality with pluggable provider support
 */
@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const timeoutSec = cfg.get<number>('stt.requestTimeoutSec', 15);
        return {
          timeout: timeoutSec * 1000,
          maxRedirects: 3,
          validateStatus: () => true,
        };
      },
    }),
  ],
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    AssemblyAiProvider,
    SttProviderRegistry,
    {
      provide: STT_PROVIDER,
      inject: [ConfigService, SttProviderRegistry, AssemblyAiProvider],
      useFactory: (
        configService: ConfigService,
        registry: SttProviderRegistry,
        assembly: AssemblyAiProvider,
      ) => {
        const cfg = configService.get<SttConfig>('stt');
        const name = (cfg?.defaultProvider ?? 'assemblyai').toLowerCase();
        return registry.get(name) ?? assembly;
      },
    },
  ],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
