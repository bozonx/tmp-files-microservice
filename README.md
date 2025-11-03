
# Temporary Files Microservice (NestJS + Fastify)

Production-ready microservice for temporary file storage with TTL, content deduplication, search, and scheduled cleanup. Built with NestJS + Fastify.

## What’s included

- Health-check endpoint `/{API_BASE_PATH}/{API_VERSION}/health`
- JSON logging via Pino (minimal in production)
- Global error filter and validation
- Fast and lightweight Fastify HTTP server
- Unit and E2E tests (Jest)
- Docker/Docker Compose support
- No built-in auth; expose behind your API Gateway

## Overview

The service accepts files via REST (`multipart/form-data`), stores them for a time limited by `ttl` (in seconds), and provides endpoints for info, download, deletion, listing, stats, and existence checks. SHA-256 based deduplication prevents storing duplicate content.

## Quick start (production)

Choose one of the options below.

### Option A — Docker Compose (prebuilt image)

```bash
# Start service
docker compose -f docker/docker-compose.yml up -d

# Health check
curl http://localhost:8080/api/v1/health
```

Default base URL with Compose: `http://localhost:8080/api/v1`

Notes:
- The provided Compose file uses a prebuilt image. Replace the image reference if you maintain a private registry.
- To customize environment variables, edit `docker/docker-compose.yml` (environment section) or switch to using an `env_file` and point it to `.env.production`.

### Option B — Build your own Docker image

```bash
# 1) Build application
pnpm install
pnpm build

# 2) Build image (Dockerfile expects prebuilt dist/)
docker build -f docker/Dockerfile -t tmp-files-microservice:local .

# 3) Run container (reads env from .env.production)
cp env.production.example .env.production
docker run -d --name tmp-files-microservice \
  --env-file ./.env.production -p 8080:80 \
  tmp-files-microservice:local

# 4) Health check
curl http://localhost:8080/api/v1/health
```

### Option C — Bare-metal (Node.js)

```bash
pnpm install
cp env.production.example .env.production
pnpm build
pnpm start:prod
```

Default base URL: `http://localhost:80/api/v1`

## Environment variables

Source of truth: `.env.production.example`

- `NODE_ENV` — `production|development|test`
- `LISTEN_HOST` — e.g. `0.0.0.0` or `localhost`
- `LISTEN_PORT` — e.g. `80` or `3000`
- `API_BASE_PATH` — API prefix (default `api`)
- `API_VERSION` — API version (default `v1`)
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`
- `TZ` — timezone (default `UTC`)
- Storage-related:
  - `STORAGE_DIR` — base directory for files and metadata. REQUIRED. If missing, the service fails to start.
  - `MAX_FILE_SIZE_MB` — maximum upload size (MB)
  - `ALLOWED_MIME_TYPES` — comma-separated list of allowed types (e.g. `image/png,image/jpeg`), empty = allow all
  - `ENABLE_DEDUPLICATION` — enable SHA-256 deduplication (`true|false`)
  - `MAX_TTL_MIN` — maximum TTL in minutes (default 10080 = 7 days)
  - `CLEANUP_CRON` — cleanup schedule (default every 10 minutes)

## Endpoints (summary)

- `GET /{base}/health` — service health
- `POST /{base}/files` — upload (multipart/form-data)
- `GET /{base}/files/:id` — file info
- `GET /{base}/files/:id/download` — file download
- `DELETE /{base}/files/:id` — delete file
- `GET /{base}/files` — list/search with filters
- `GET /{base}/files/stats` — aggregated stats
- `GET /{base}/files/:id/exists` — existence check

Details: `docs/api-specification.md`

## cURL examples

Upload (no auth at service level):

```bash
curl -X POST \
  -F "file=@./README.md" \
  -F "ttl=3600" \
  http://localhost:8080/api/v1/files | jq
```

Info:

```bash
FILE_ID="<uuid>"
curl -s http://localhost:8080/api/v1/files/$FILE_ID | jq
```

Download:

```bash
curl -L -o downloaded.bin http://localhost:8080/api/v1/files/$FILE_ID/download
```

Delete:

```bash
curl -s -X DELETE http://localhost:8080/api/v1/files/$FILE_ID | jq
```

More examples: `docs/usage-examples.md`.

## Documentation

- `docs/quick-start.md` — quick start
- `docs/api-specification.md` — REST API specification
- `docs/usage-examples.md` — cURL examples
- `dev_docs/STORAGE_MODULE.md` — storage module details
- `docs/dev.md` — development guide
- `docs/CHANGELOG.md` — changes

## License

MIT
