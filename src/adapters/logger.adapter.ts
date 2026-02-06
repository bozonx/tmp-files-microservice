export interface LoggerAdapter {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export class ConsoleLoggerAdapter implements LoggerAdapter {
  constructor(private readonly level: string) {}

  private shouldLog(level: string): boolean {
    const order = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']
    const cur = order.indexOf(this.level)
    const lvl = order.indexOf(level)
    if (cur === -1) return true
    if (lvl === -1) return true
    return lvl >= cur && this.level !== 'silent'
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return
    // eslint-disable-next-line no-console
    console.debug(JSON.stringify({ level: 'debug', message, ...meta }))
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: 'info', message, ...meta }))
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ level: 'warn', message, ...meta }))
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: 'error', message, ...meta }))
  }
}
