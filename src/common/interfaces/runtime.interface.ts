export interface RuntimeServices {
  now(): Date
  randomUUID(): string
  sha256HexStream(
    input: ReadableStream<Uint8Array>
  ): Promise<{ hashHex: string; stream: ReadableStream<Uint8Array> }>
}
