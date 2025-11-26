import appConfig from '@/config/app.config'

describe('app.config', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('returns normalized config from env', () => {
    process.env.LISTEN_PORT = '8080'
    process.env.LISTEN_HOST = '127.0.0.1'
    process.env.API_BASE_PATH = '/api/'
    process.env.NODE_ENV = 'test'
    process.env.LOG_LEVEL = 'info'
    const cfg = appConfig()
    expect(cfg.port).toBe(8080)
    expect(cfg.host).toBe('127.0.0.1')
    expect(cfg.apiBasePath).toBe('api')
    expect(cfg.nodeEnv).toBe('test')
    expect(cfg.logLevel).toBe('info')
  })

  it('throws on invalid log level', () => {
    process.env.LOG_LEVEL = 'verbose'
    expect(() => appConfig()).toThrow()
  })
})
