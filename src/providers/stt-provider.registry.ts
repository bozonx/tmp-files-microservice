import { Injectable } from '@nestjs/common';
import type { SttProvider } from '@common/interfaces/stt-provider.interface';
import { AssemblyAiProvider } from '@providers/assemblyai/assemblyai.provider';

@Injectable()
export class SttProviderRegistry {
  constructor(private readonly assemblyAiProvider: AssemblyAiProvider) {}

  public get(providerName: string): SttProvider | undefined {
    switch (providerName.toLowerCase()) {
      case 'assemblyai':
        return this.assemblyAiProvider;
      default:
        return undefined;
    }
  }
}
