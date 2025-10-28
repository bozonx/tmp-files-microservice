/**
 * Response DTO for transcription operations
 */
export class TranscriptionResponseDto {
  public text!: string;

  public provider!: string;

  public requestId!: string;

  public durationSec?: number;

  public language?: string;

  public confidenceAvg?: number;

  public wordsCount?: number;

  public processingMs!: number;

  public timestampsEnabled!: boolean;
}
