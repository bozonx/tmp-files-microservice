import { IsBoolean, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class TranscribeFileDto {
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'audioUrl must be a valid URL' })
  @Matches(/^https?:\/\//i, { message: 'audioUrl must start with http or https' })
  public readonly audioUrl!: string;

  @IsOptional()
  @IsString()
  public readonly provider?: string;

  @IsOptional()
  @IsBoolean()
  public readonly timestamps?: boolean;

  @IsOptional()
  @IsString()
  public readonly apiKey?: string;
}
