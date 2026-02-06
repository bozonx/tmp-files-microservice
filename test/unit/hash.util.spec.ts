import { HashUtil } from '@/common/utils/hash.util.js'

describe('HashUtil', () => {
  it('hashString is deterministic and valid', async () => {
    const h1 = await HashUtil.hashString('data')
    const h2 = await HashUtil.hashString('data')
    expect(h1).toBe(h2)
    expect(HashUtil.isValidHash(h1)).toBe(true)
  })

  it('hashBytes matches hashString for same content', async () => {
    const bytes = new TextEncoder().encode('data')
    const hb = await HashUtil.hashBytes(bytes)
    const hs = await HashUtil.hashString('data')
    expect(hb).toBe(hs)
  })

  it('compareHashes compares case-insensitively', async () => {
    const h = await HashUtil.hashString('data')
    expect(HashUtil.compareHashes(h, h.toUpperCase())).toBe(true)
  })
})
