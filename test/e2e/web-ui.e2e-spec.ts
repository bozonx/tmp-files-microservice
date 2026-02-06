import { createTestApp } from './test-app.factory.js'

describe('Web UI (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app']

  beforeEach(async () => {
    ;({ app } = await createTestApp())
  })

  it('GET / - redirects to /ui/', async () => {
    const res = await app.request('/', { method: 'GET', redirect: 'manual' })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/ui/')
  })

  it('GET /ui/ - serves index.html', async () => {
    const res = await app.request('/ui/', { method: 'GET' })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('<!DOCTYPE html>')
  })

  it('GET /ui/public/app.js - serves static file', async () => {
    const res = await app.request('/ui/public/app.js', { method: 'GET' })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('javascript')
    const body = await res.text()
    expect(body).toContain('API_BASE_URL')
  })
})
