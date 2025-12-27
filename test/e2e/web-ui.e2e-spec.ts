import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from './test-app.factory'

describe('Web UI (e2e)', () => {
  let app: NestFastifyApplication

  beforeEach(async () => {
    app = await createTestApp()
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  it('GET / - redirects to /ui/', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/',
    })

    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('/ui/')
  })

  it('GET /ui/ - serves index.html', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ui/',
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('<!DOCTYPE html>')
  })

  it('GET /ui/public/app.js - serves static file', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ui/public/app.js',
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/javascript')
    expect(res.body).toContain('API_BASE_URL')
  })
})
