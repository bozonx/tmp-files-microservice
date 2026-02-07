export class HashUtil {
  public static async hashString(data: string): Promise<string> {
    if (typeof data !== 'string') throw new Error('Input must be a string')
    const enc = new TextEncoder()
    return this.hashBytes(enc.encode(data))
  }

  public static async hashBytes(bytes: Uint8Array): Promise<string> {
    const cryptoAny = globalThis.crypto as unknown as { subtle?: SubtleCrypto } | undefined
    if (!cryptoAny?.subtle) {
      throw new Error('Web Crypto API is not available (crypto.subtle missing)')
    }

    const digest = await cryptoAny.subtle.digest('SHA-256', bytes.slice().buffer)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  public static isValidHash(hash: string): boolean {
    if (typeof hash !== 'string') return false
    return /^[a-f0-9]{64}$/i.test(hash)
  }

  public static compareHashes(hash1: string, hash2: string): boolean {
    if (!this.isValidHash(hash1) || !this.isValidHash(hash2)) return false
    return hash1.toLowerCase() === hash2.toLowerCase()
  }
}
