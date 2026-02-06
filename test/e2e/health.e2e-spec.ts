import { createTestApp } from './test-app.factory.js'

describe('Health (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app']

  beforeEach(async () => {
    // Create fresh app instance for each test for better isolation
    ;({ app } = await createTestApp())
  })

  describe('GET /api/v1/health', () => {
    it('returns simple ok status', async () => {
      const response = await app.request('/api/v1/health', { method: 'GET' })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ status: 'ok' })
    })
  })
})
