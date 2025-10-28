import { Test } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TranscriptionService } from '@modules/transcription/transcription.service';
import { AssemblyAiProvider } from '@providers/assemblyai/assemblyai.provider';
import { STT_PROVIDER } from '@common/constants/tokens';
import { of } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { PinoLogger } from 'nestjs-pino';
import appConfig from '@config/app.config';
import sttConfig from '@config/stt.config';
import { createMockLogger } from '@test/helpers/mocks';

describe('TranscriptionService', () => {
  it('rejects private host url', async () => {
    const mockProvider = { submitAndWaitByUrl: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule,
        ConfigModule.forRoot({
          load: [appConfig, sttConfig],
        }),
      ],
      providers: [
        TranscriptionService,
        AssemblyAiProvider,
        {
          provide: STT_PROVIDER,
          useValue: mockProvider,
        },
        {
          provide: PinoLogger,
          useValue: createMockLogger(),
        },
      ],
    }).compile();

    const svc = moduleRef.get(TranscriptionService);
    await expect(
      svc.transcribeByUrl({ audioUrl: 'http://localhost:8000/a.mp3' }),
    ).rejects.toThrow();
  });

  it('returns response shape on success', async () => {
    process.env.ASSEMBLYAI_API_KEY = 'x';

    const mockProvider = {
      submitAndWaitByUrl: jest.fn().mockResolvedValue({
        text: 'hello',
        requestId: 'id1',
        durationSec: 1,
        language: 'en',
        confidenceAvg: 0.9,
        words: [{ start: 0, end: 100, text: 'hello' }],
      }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule,
        ConfigModule.forRoot({
          load: [appConfig, sttConfig],
        }),
      ],
      providers: [
        TranscriptionService,
        AssemblyAiProvider,
        {
          provide: STT_PROVIDER,
          useValue: mockProvider,
        },
        {
          provide: PinoLogger,
          useValue: createMockLogger(),
        },
      ],
    })
      .overrideProvider(HttpService)
      .useValue({ head: () => of({ headers: {} }) })
      .compile();

    const svc = moduleRef.get(TranscriptionService);
    const res = await svc.transcribeByUrl({ audioUrl: 'https://example.com/a.mp3' });
    expect(res.text).toBe('hello');
    expect(res.provider).toBe('assemblyai');
    expect(res.requestId).toBe('id1');
    expect(res.wordsCount).toBe(1);
  });
});
