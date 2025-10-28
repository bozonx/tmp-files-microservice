import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  ServiceUnavailableException,
  GatewayTimeoutException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { lastValueFrom, timeout } from 'rxjs';
import type {
  SttProvider,
  TranscriptionRequestByUrl,
  TranscriptionResult,
} from '@common/interfaces/stt-provider.interface';
import type { SttConfig } from '@config/stt.config';
import { ASSEMBLYAI_API } from '@common/constants/app.constants';

interface AssemblyCreateResponse {
  id: string;
  status: string;
}

interface AssemblyTranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  error?: string;
  words?: Array<{ start: number; end: number; text: string; confidence?: number }>;
  audio_duration?: number;
  language_code?: string;
  confidence?: number; // some payloads expose average confidence
}

@Injectable()
export class AssemblyAiProvider implements SttProvider {
  private readonly cfg: SttConfig;

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.cfg = this.configService.get<SttConfig>('stt')!;
    logger.setContext(AssemblyAiProvider.name);
  }

  public async submitAndWaitByUrl(params: TranscriptionRequestByUrl): Promise<TranscriptionResult> {
    this.logger.debug(`Submitting transcription request to AssemblyAI for URL: ${params.audioUrl}`);

    const headers = { Authorization: params.apiKey as string };
    const apiUrl = `${ASSEMBLYAI_API.BASE_URL}${ASSEMBLYAI_API.TRANSCRIPTS_ENDPOINT}`;
    const create$ = this.http.post<AssemblyCreateResponse>(
      apiUrl,
      { audio_url: params.audioUrl },
      { headers, validateStatus: () => true },
    );

    const createRes = await lastValueFrom(create$.pipe(timeout(this.cfg.requestTimeoutSec * 1000)));
    if (createRes.status >= 400 || !createRes.data?.id) {
      this.logger.error(
        `Failed to create transcription. Status: ${createRes.status}, Response: ${JSON.stringify(createRes.data)}`,
      );
      throw new ServiceUnavailableException('Failed to create transcription');
    }

    const id = createRes.data.id;
    this.logger.info(`Transcription request created with ID: ${id}`);

    const startedAt = Date.now();
    const deadline = startedAt + this.cfg.maxSyncWaitMin * 60 * 1000;

    // Poll loop
    let pollCount = 0;
    for (;;) {
      if (Date.now() > deadline) {
        this.logger.error(
          `Transcription timeout after ${this.cfg.maxSyncWaitMin} minutes for ID: ${id}`,
        );
        throw new GatewayTimeoutException('TRANSCRIPTION_TIMEOUT');
      }

      await new Promise(r => setTimeout(r, this.cfg.pollIntervalMs));
      pollCount++;

      this.logger.debug(`Polling transcription status (attempt ${pollCount}) for ID: ${id}`);

      const getUrl = `${ASSEMBLYAI_API.BASE_URL}${ASSEMBLYAI_API.TRANSCRIPTS_ENDPOINT}/${id}`;
      const get$ = this.http.get<AssemblyTranscriptResponse>(getUrl, {
        headers,
        validateStatus: () => true,
      });
      const getRes = await lastValueFrom(get$.pipe(timeout(this.cfg.requestTimeoutSec * 1000)));
      const body = getRes.data;

      if (!body) {
        this.logger.debug(`No response body for ID: ${id}, continuing...`);
        continue;
      }

      this.logger.debug(`Transcription status: ${body.status} for ID: ${id}`);

      if (body.status === 'completed') {
        this.logger.info(
          `Transcription completed for ID: ${id}. Text length: ${body.text?.length || 0} chars`,
        );
        return {
          text: body.text ?? '',
          requestId: id,
          durationSec: body.audio_duration,
          language: body.language_code,
          confidenceAvg: body.confidence,
          words: body.words?.map(w => ({ start: w.start, end: w.end, text: w.text })) ?? undefined,
        };
      }

      if (body.status === 'error') {
        this.logger.error(`Transcription failed for ID: ${id}. Error: ${body.error}`);
        throw new ServiceUnavailableException(body.error ?? 'Transcription failed');
      }
    }
  }
}
