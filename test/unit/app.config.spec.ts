import { loadAppEnv } from '@/config/env.js'

describe('loadAppEnv', () => {
  it('returns normalized config from env', () => {
    const cfg = loadAppEnv({
      LISTEN_PORT: '8080',
      LISTEN_HOST: '127.0.0.1',
      BASE_PATH: '/subpath/',
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      DOWNLOAD_BASE_URL: 'https://cdn.example.com/',
      AUTH_BASIC_USER: 'user',
      AUTH_BASIC_PASS: 'pass',
      AUTH_BEARER_TOKENS: 't1, t2',
    })

    expect(cfg.LISTEN_PORT).toBe(8080)
    expect(cfg.LISTEN_HOST).toBe('127.0.0.1')
    expect(cfg.BASE_PATH).toBe('subpath')
    expect(cfg.NODE_ENV).toBe('test')
    expect(cfg.LOG_LEVEL).toBe('info')
    expect(cfg.DOWNLOAD_BASE_URL).toBe('https://cdn.example.com')
    expect(cfg.AUTH_BASIC_USER).toBe('user')
    expect(cfg.AUTH_BASIC_PASS).toBe('pass')
    expect(cfg.AUTH_BEARER_TOKENS).toEqual(['t1', 't2'])
  })

  it('uses fallbacks for invalid inputs', () => {
    const cfg = loadAppEnv({
      LISTEN_PORT: 'not-a-number',

      NODE_ENV: 'invalid',
    })

    expect(cfg.LISTEN_PORT).toBe(8080)

    expect(cfg.NODE_ENV).toBe('production')
  })
})
