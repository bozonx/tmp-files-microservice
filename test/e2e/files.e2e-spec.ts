import * as http from 'http'
import { createTestApp } from './test-app.factory.js'

describe('Files (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app']

  beforeEach(async () => {
    ;({ app } = await createTestApp())
  })

  it('POST /api/v1/files (multipart) - honors provided ttlMins (e.g., 5)', async () => {
    const form = new FormData()
    form.set('ttlMins', '5')
    form.set('file', new File([new TextEncoder().encode('hello')], 'a.txt', { type: 'text/plain' }))

    const res = await app.request('/api/v1/files', { method: 'POST', body: form })
    if (res.status !== 201) {
      throw new Error(`Unexpected status ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as any
    expect(data?.file?.ttlMins).toBe(5)
  })

  it('POST /api/v1/files (multipart) - ttlMins=0 is treated as present and coerced to minimum 1', async () => {
    const form = new FormData()
    form.set('ttlMins', '0')
    form.set('file', new File([new TextEncoder().encode('hello')], 'a.txt', { type: 'text/plain' }))

    const res = await app.request('/api/v1/files', { method: 'POST', body: form })
    if (res.status !== 201) {
      throw new Error(`Unexpected status ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as any
    expect(data?.file?.ttlMins).toBe(1)
  })

  it('POST /api/v1/files/url - honors provided ttlMins (e.g., 5)', async () => {
    const server = http.createServer((req, res) => {
      if (req.url === '/file.bin') {
        const data = Buffer.from('hello')
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Length', data.length)
        res.end(data)
      } else {
        res.statusCode = 404
        res.end()
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const fileUrl = `http://127.0.0.1:${port}/file.bin`

    try {
      const res = await app.request('/api/v1/files/url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: fileUrl, ttlMins: 5 }),
      })
      expect(res.status).toBe(201)
      const data = (await res.json()) as any
      expect(data?.file?.ttlMins).toBe(5)
    } finally {
      server.close()
    }
  })

  it('POST /api/v1/files/url - ttlMins=0 is treated as present and coerced to minimum 1', async () => {
    const server = http.createServer((req, res) => {
      if (req.url === '/file.bin') {
        const data = Buffer.from('hello')
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Length', data.length)
        res.end(data)
      } else {
        res.statusCode = 404
        res.end()
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const fileUrl = `http://127.0.0.1:${port}/file.bin`

    try {
      const res = await app.request('/api/v1/files/url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: fileUrl, ttlMins: 0 }),
      })
      expect(res.status).toBe(201)
      const data = (await res.json()) as any
      expect(data?.file?.ttlMins).toBe(1)
    } finally {
      server.close()
    }
  })

  it('GET /api/v1/files - lists files', async () => {
    const res = await app.request('/api/v1/files', { method: 'GET' })
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data).toHaveProperty('files')
    expect(Array.isArray(data.files)).toBe(true)
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('pagination')
  })

  it('GET /api/v1/files/stats - returns stats', async () => {
    const res = await app.request('/api/v1/files/stats', { method: 'GET' })
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data).toHaveProperty('stats')
    expect(data).toHaveProperty('generatedAt')
  })

  it('GET /api/v1/files/:id - returns 404 for non-existing file', async () => {
    const res = await app.request('/api/v1/files/non-existing-id', { method: 'GET' })
    expect([404, 400]).toContain(res.status)
  })

  it('GET /api/v1/files/:id/exists - returns exists=false for non-existing', async () => {
    const id = 'non-existing-id'
    const res = await app.request(`/api/v1/files/${id}/exists`, { method: 'GET' })
    expect(res.status).toBe(200)
    const data = (await res.json()) as any

    // For non-existing files, the service can return either:
    // - 200 with exists=false (legacy behavior)
    // - 404 not found (newer behavior)
    // Here we validate the current contract used by this codebase:
    expect(data).toHaveProperty('exists', false)
    expect(data).toHaveProperty('fileId', id)
    expect(data).toHaveProperty('isExpired')
    expect(typeof data.isExpired).toBe('boolean')
  })

  it('GET /api/v1/files/:id/exists - returns 400 for invalid id', async () => {
    const badId = 'bad id!'
    const res = await app.request(`/api/v1/files/${badId}/exists`, { method: 'GET' })
    expect(res.status).toBe(400)
  })

  it('DELETE /api/v1/files/:id - returns 404 for non-existing file', async () => {
    const res = await app.request('/api/v1/files/non-existing-id', { method: 'DELETE' })
    expect([404, 400]).toContain(res.status)
  })

  it('POST /api/v1/files/url - uploads file by URL', async () => {
    // Start a tiny local HTTP server to serve a small payload
    const server = http.createServer((req, res) => {
      if (req.url === '/file.bin') {
        const data = Buffer.from('hello')
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Length', data.length)
        res.end(data)
      } else {
        res.statusCode = 404
        res.end()
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const fileUrl = `http://127.0.0.1:${port}/file.bin`

    try {
      const res = await app.request('/api/v1/files/url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: fileUrl, ttlMins: 1440, metadata: '{"source":"e2e"}' }),
      })
      expect(res.status).toBe(201)
      const data = (await res.json()) as any
      expect(data).toHaveProperty('file')
      expect(data.file).toHaveProperty('id')
      expect(data).toHaveProperty('downloadUrl')
      expect(data).toHaveProperty('infoUrl')
      expect(data).toHaveProperty('deleteUrl')

      // Verify the download endpoint responds and returns the expected content
      const downloadRes = await app.request(String(data.downloadUrl), { method: 'GET' })
      expect(downloadRes.status).toBe(200)
      const downloaded = await downloadRes.text()
      expect(downloaded).toBe('hello')
    } finally {
      server.close()
    }
  })

  it('POST /api/v1/files/url - returns 400 when url is missing', async () => {
    const res = await app.request('/api/v1/files/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ttlMins: 1440 }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/v1/files/url - returns 400 when metadata is invalid JSON string', async () => {
    const server = http.createServer((req, res) => {
      if (req.url === '/file.bin') {
        const data = Buffer.from('hello')
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Length', data.length)
        res.end(data)
      } else {
        res.statusCode = 404
        res.end()
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const fileUrl = `http://127.0.0.1:${port}/file.bin`

    try {
      const res = await app.request('/api/v1/files/url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: fileUrl, ttlMins: 1440, metadata: 'not json' }),
      })
      expect(res.status).toBe(400)
    } finally {
      server.close()
    }
  })

  it('GET /api/v1/files - echoes x-request-id header', async () => {
    const res = await app.request('/api/v1/files', {
      method: 'GET',
      headers: {
        'x-request-id': 'e2e-request-id-123',
      },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toBe('e2e-request-id-123')
  })

  it('GET /api/v1/files - generates x-request-id header when not provided', async () => {
    const res = await app.request('/api/v1/files', { method: 'GET' })
    expect(res.status).toBe(200)
    const requestId = res.headers.get('x-request-id')
    expect(typeof requestId).toBe('string')
    expect((requestId ?? '').length).toBeGreaterThan(0)
  })

  it('POST /api/v1/files/url - returns masked message for internal errors (5xx)', async () => {
    const res = await app.request('/api/v1/files/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1:65534/file.bin' }),
    })
    expect(res.status).toBe(500)
    const data = (await res.json()) as any
    expect(data).toHaveProperty('message', 'Internal server error')
    expect(data).toHaveProperty('requestId')
  })
})
