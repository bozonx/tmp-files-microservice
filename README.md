# Microservice Boilerplate (NestJS + Fastify)

Minimal NestJS microservice starter with Fastify, health checks, centralized error handling, and structured logging.

## Features

- 🏥 Health checks (readiness, liveness) via Terminus
- 📊 Pino logging (pretty in dev, JSON in prod)
- 🛡️ Global exception filter
- ⚡ Fastify adapter, CORS, Helmet
- 🐳 Docker-friendly

## Quick Start

Requirements:

- Node.js 22+
- pnpm 10+

```bash
# 1) Install
pnpm install

# 2) Configure env
cp env.development.example .env.development
cp env.production.example .env.production

# 3) Dev run
pnpm start:dev

# 4) Prod build/run
pnpm build
NODE_ENV=production pnpm start:prod
```

Default URL: `http://localhost:3000/api/v1`

## Configuration

Environment files:

- `.env.production`
- `.env.development`

Key variables:

- `NODE_ENV` (production|development|test)
- `LISTEN_HOST` (e.g. `0.0.0.0` or `localhost`)
- `LISTEN_PORT` (e.g. `80` or `3000`)
- `API_BASE_PATH` (default `api`)
- `API_VERSION` (default `v1`)
- `LOG_LEVEL` (trace|debug|info|warn|error|fatal|silent)

## API Endpoints

- `GET /{API_BASE_PATH}/{API_VERSION}/health`
- `GET /{API_BASE_PATH}/{API_VERSION}/health/ready`
- `GET /{API_BASE_PATH}/{API_VERSION}/health/live`

## Logging

- Dev: pretty logs
- Prod: JSON logs with `@timestamp` (ISO 8601 UTC)

## License

MIT
