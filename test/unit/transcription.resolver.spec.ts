import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { TranscriptionResolver } from '@/graphql/resolvers/transcription.resolver';
import { TranscriptionService } from '@modules/transcription/transcription.service';

describe('TranscriptionResolver', () => {
  let resolver: TranscriptionResolver;
  let service: TranscriptionService;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
  };

  const mockService = {
    transcribeByUrl: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptionResolver,
        { provide: TranscriptionService, useValue: mockService },
        { provide: PinoLogger, useValue: mockLogger },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    resolver = module.get<TranscriptionResolver>(TranscriptionResolver);
    service = module.get<TranscriptionService>(TranscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should call transcriptionService.transcribeByUrl with correct input', async () => {
    const input = {
      audioUrl: 'https://example.com/audio.mp3',
      provider: 'assemblyai',
      timestamps: true,
      apiKey: 'test-key',
    };
    const result = {
      text: 'test transcription',
      provider: 'assemblyai',
      requestId: 'req-123',
      processingMs: 100,
      timestampsEnabled: true,
    };

    mockService.transcribeByUrl.mockResolvedValue(result);

    const response = await resolver.transcribeFile(input);

    expect(service.transcribeByUrl).toHaveBeenCalledWith(input);
    expect(response).toEqual(result);
  });

  it('should log transcription request', async () => {
    const input = { audioUrl: 'https://example.com/audio.mp3' };
    const result = {
      text: 'test',
      provider: 'assemblyai',
      requestId: 'req-123',
      processingMs: 100,
      timestampsEnabled: false,
    };

    mockService.transcribeByUrl.mockResolvedValue(result);

    await resolver.transcribeFile(input);

    expect(mockLogger.info).toHaveBeenCalledWith(
      `GraphQL: Transcription request for ${input.audioUrl}`,
    );
  });

  it('should handle service errors', async () => {
    const input = { audioUrl: 'https://example.com/audio.mp3' };
    const error = new Error('Service error');

    mockService.transcribeByUrl.mockRejectedValue(error);

    await expect(resolver.transcribeFile(input)).rejects.toThrow('Service error');
  });
});
