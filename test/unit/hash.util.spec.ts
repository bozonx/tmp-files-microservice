import { HashUtil } from '@/common/utils/hash.util'

describe('HashUtil', () => {
  it('hashString is deterministic and valid', () => {
    const h1 = HashUtil.hashString('data')
    const h2 = HashUtil.hashString('data')
    expect(h1).toBe(h2)
    expect(HashUtil.isValidHash(h1)).toBe(true)
  })

  it('hashBuffer matches hashString for same content', () => {
    const buf = Buffer.from('data')
    const hb = HashUtil.hashBuffer(buf)
    const hs = HashUtil.hashString('data')
    expect(hb).toBe(hs)
  })

  it('generateShortHash returns requested length', () => {
    const short = HashUtil.generateShortHash('data', 10)
    expect(short).toHaveLength(10)
  })

  it('compareHashes compares case-insensitively', () => {
    const h = HashUtil.hashString('data')
    expect(HashUtil.compareHashes(h, h.toUpperCase())).toBe(true)
  })
})
