import { createTestApp } from './test-app.factory.js'

describe('Cleanup (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app']

  beforeEach(async () => {
    ;({ app } = await createTestApp())
  })

  it('POST /api/v1/cleanup/run returns success', async () => {
    const res = await app.request('/api/v1/cleanup/run', { method: 'POST' })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, message: 'Cleanup completed' })
  })
})
