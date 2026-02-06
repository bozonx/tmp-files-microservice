import { ValidationUtil } from '@/common/utils/validation.util.js'
import { Readable } from 'stream'

describe('ValidationUtil', () => {
  it('validateUploadedFile returns valid for proper file', () => {
    const res = ValidationUtil.validateUploadedFile(
      {
        originalname: 'a.txt',
        mimetype: 'text/plain',
        size: 3,
        stream: Readable.from(Buffer.from('abc')),
      } as any,
      ['text/plain'],
      10
    )
    expect(res.isValid).toBe(true)
  })

  it('validateUploadedFile catches errors', () => {
    const res = ValidationUtil.validateUploadedFile(
      { originalname: '', mimetype: '', size: 0 } as any,
      [],
      1
    )
    expect(res.isValid).toBe(false)
    expect(res.errors.length).toBeGreaterThan(0)
  })

  it('validateTTL enforces bounds', () => {
    expect(ValidationUtil.validateTTL(60).isValid).toBe(true)
    expect(ValidationUtil.validateTTL(10).isValid).toBe(false)
  })

  it('validateFileId basic checks', () => {
    expect(ValidationUtil.validateFileId('abc-123').isValid).toBe(true)
    expect(ValidationUtil.validateFileId('bad id').isValid).toBe(false)
  })

  it('validateMetadata handles invalid shapes', () => {
    expect(ValidationUtil.validateMetadata({ a: '1', b: 2 }).isValid).toBe(true)
    expect(ValidationUtil.validateMetadata([] as any).isValid).toBe(false)
  })
})
