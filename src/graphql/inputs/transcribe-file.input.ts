import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsUrl, IsOptional, IsBoolean, Matches } from 'class-validator';

@InputType({ description: 'Параметры для транскрибации файла' })
export class TranscribeFileInput {
  @Field(() => String, { description: 'URL аудиофайла (HTTP/HTTPS)' })
  @IsString()
  @IsUrl({ require_tld: false })
  @Matches(/^https?:\/\//i)
  audioUrl!: string;

  @Field(() => String, { nullable: true, description: 'Провайдер STT' })
  @IsOptional()
  @IsString()
  provider?: string;

  @Field(() => Boolean, { nullable: true, description: 'Включить временные метки' })
  @IsOptional()
  @IsBoolean()
  timestamps?: boolean;

  @Field(() => String, { nullable: true, description: 'Кастомный API ключ' })
  @IsOptional()
  @IsString()
  apiKey?: string;
}
