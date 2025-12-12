import { createHash } from 'crypto'
import fs from 'fs-extra'
const { readFile } = fs

export class HashUtil {
  static async hashFile(filePath: string): Promise<string> {
    const fileBuffer = await readFile(filePath)
    return this.hashBuffer(fileBuffer)
  }

  static hashBuffer(buffer: Buffer): string {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Input must be a Buffer')
    }
    const hash = createHash('sha256')
    hash.update(buffer)
    return hash.digest('hex')
  }

  static hashString(data: string): string {
    if (typeof data !== 'string') {
      throw new Error('Input must be a string')
    }
    const hash = createHash('sha256')
    hash.update(data, 'utf8')
    return hash.digest('hex')
  }

  static isValidHash(hash: string): boolean {
    if (typeof hash !== 'string') return false
    return /^[a-f0-9]{64}$/i.test(hash)
  }

  static compareHashes(hash1: string, hash2: string): boolean {
    if (!this.isValidHash(hash1) || !this.isValidHash(hash2)) return false
    return hash1.toLowerCase() === hash2.toLowerCase()
  }

  static generateShortHash(data: string | Buffer, length: number = 8): string {
    const hash = Buffer.isBuffer(data) ? this.hashBuffer(data) : this.hashString(data)
    if (length < 1 || length > 64) throw new Error('Length must be between 1 and 64')
    return hash.substring(0, length)
  }
}
