export interface TranscriptionRequestByUrl {
  audioUrl: string;
  apiKey?: string;
}

export interface WordTiming {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  requestId: string;
  durationSec?: number;
  language?: string;
  confidenceAvg?: number;
  words?: WordTiming[];
}

export interface SttProvider {
  submitAndWaitByUrl(params: TranscriptionRequestByUrl): Promise<TranscriptionResult>;
}
