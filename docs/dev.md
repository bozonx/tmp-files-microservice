# Development Guide (dev)

## Requirements

- Node.js 22+
- pnpm 10+
- STORAGE_DIR

## Quick start (dev)

```bash
# 1) Install dependencies
pnpm install

# 2) Configure environment (dev)
cp env.development.example .env.development
# ВАЖНО: укажите STORAGE_DIR в .env.development перед запуском

# 3) Run in development (watch mode)
pnpm start:dev
```

- Базовый URL (dev) по умолчанию: `http://localhost:3000/api/v1`
- ВАЖНО: `STORAGE_DIR` обязательна; приложение не запустится, если переменная не задана.

## Tests

Jest projects are split into `unit` and `e2e`.

```bash
# All tests
pnpm test

# Unit tests
pnpm test:unit

# E2E tests
pnpm test:e2e

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov

# Debug tests
pnpm test:unit:debug
pnpm test:e2e:debug
```

## Code quality

```bash
# Lint
pnpm lint

# Format
pnpm format
```

## Debugging the app

```bash
# Start Nest in debug with watch
pnpm start:debug
```

Attach your debugger to the Node.js inspector port output by the command.

## Useful notes

- Global `ValidationPipe` is enabled (whitelist, forbidNonWhitelisted, transform).
- Dev uses `pino-pretty` with more verbose logs; prod uses JSON logs.
- Health route auto-logging is minimized in prod.
- Sensitive headers are redacted in logs (`authorization`, `x-api-key`).
- Path aliases for TypeScript/Jest: `@/*`, `@common/*`, `@modules/*`, `@config/*`, `@test/*`.
