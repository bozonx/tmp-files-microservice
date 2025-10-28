import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { TranscriptionService } from '@modules/transcription/transcription.service';
import { AuthGuard } from '@common/guards/auth.guard';
import { TranscriptionResponse } from '../models/transcription-response.model';
import { TranscribeFileInput } from '../inputs/transcribe-file.input';

@Resolver(() => TranscriptionResponse)
@UseGuards(AuthGuard)
export class TranscriptionResolver {
  constructor(
    private readonly transcriptionService: TranscriptionService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    logger.setContext(TranscriptionResolver.name);
  }

  @Mutation(() => TranscriptionResponse, {
    description: 'Транскрибировать аудиофайл по URL',
  })
  async transcribeFile(@Args('input') input: TranscribeFileInput): Promise<TranscriptionResponse> {
    this.logger.info(`GraphQL: Transcription request for ${input.audioUrl}`);
    return this.transcriptionService.transcribeByUrl(input);
  }
}
