import { createTestApp } from './test-app.factory.js'

describe('Maintenance (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app']

  beforeEach(async () => {
    ;({ app } = await createTestApp())
  })

  it('POST /api/v1/maintenance/run returns success', async () => {
    const res = await app.request('/api/v1/maintenance/run', {
      method: 'POST',
      headers: { authorization: 'Bearer e2e-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, message: 'Maintenance completed' })
  })
})
