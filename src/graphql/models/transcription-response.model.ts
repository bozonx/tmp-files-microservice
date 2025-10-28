import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType({ description: 'Результат транскрибации аудио' })
export class TranscriptionResponse {
  @Field(() => String, { description: 'Транскрибированный текст' })
  text!: string;

  @Field(() => String, { description: 'Провайдер STT' })
  provider!: string;

  @Field(() => String, { description: 'ID запроса' })
  requestId!: string;

  @Field(() => Float, { nullable: true, description: 'Длительность в секундах' })
  durationSec?: number;

  @Field(() => String, { nullable: true, description: 'Код языка' })
  language?: string;

  @Field(() => Float, { nullable: true, description: 'Средняя уверенность (0-1)' })
  confidenceAvg?: number;

  @Field(() => Int, { nullable: true, description: 'Количество слов' })
  wordsCount?: number;

  @Field(() => Int, { description: 'Время обработки в мс' })
  processingMs!: number;

  @Field(() => Boolean, { description: 'Включены ли временные метки' })
  timestampsEnabled!: boolean;
}
