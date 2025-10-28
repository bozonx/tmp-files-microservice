import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TranscribeFileDto } from '@common/dto/transcribe-file.dto';

describe('TranscribeFileDto', () => {
  it('validates a correct payload', async () => {
    const obj = plainToInstance(TranscribeFileDto, { audioUrl: 'https://example.com/a.mp3' });
    const errs = await validate(obj);
    expect(errs).toHaveLength(0);
  });

  it('rejects non-http url', async () => {
    const obj = plainToInstance(TranscribeFileDto, { audioUrl: 'ftp://example.com/a.mp3' });
    const errs = await validate(obj);
    expect(errs.length).toBeGreaterThan(0);
  });
});
