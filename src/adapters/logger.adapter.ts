export interface LoggerAdapter {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export class ConsoleLoggerAdapter implements LoggerAdapter {
  private readonly normalizedLevel: string

  constructor(level: string) {
    this.normalizedLevel = level.toLowerCase()
  }

  private shouldLog(level: string): boolean {
    const order = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']
    const cur = order.indexOf(this.normalizedLevel)
    const lvl = order.indexOf(level)
    if (cur === -1) return true
    if (lvl === -1) return true
    return lvl >= cur && this.normalizedLevel !== 'silent'
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return
    // eslint-disable-next-line no-console
    console.debug(
      JSON.stringify({ timestamp: new Date().toISOString(), level: 'debug', message, ...meta })
    )
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message, ...meta })
    )
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({ timestamp: new Date().toISOString(), level: 'warn', message, ...meta })
    )
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', message, ...meta })
    )
  }
}
