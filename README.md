
# Temporary Files Microservice (NestJS + Fastify)

Production-ready microservice for temporary file storage with TTL, content deduplication, search, and scheduled cleanup. Built with NestJS + Fastify.

## What’s included

- Health-check endpoint `/{API_BASE_PATH}/v1/health`
- JSON logging via Pino (minimal in production)
- Global error filter and validation
- Fast and lightweight Fastify HTTP server
- Unit and E2E tests (Jest)
- Docker/Docker Compose support
- No built-in auth; expose behind your API Gateway

## Overview

The service accepts files via REST (`multipart/form-data`), stores them for a time limited by `ttlMinutes` (in minutes; default 1440 = 1 day), and provides endpoints for info, download, deletion, listing, stats, and existence checks. SHA-256 based deduplication prevents storing duplicate content.

## Quick start

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
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`
- `HTTP_REQUEST_BODY_LIMIT_MB` — maximum size of the HTTP request body for Fastify body parser (default 10 MB)
- `TZ` — timezone (default `UTC`)
- Storage-related:
  - `STORAGE_DIR` — base directory for files and metadata. MANDATORY.
  - `MAX_FILE_SIZE_MB` — maximum upload size (MB). Source of truth for upload limits; affects both Fastify multipart and service-side validation.
  - `ALLOWED_MIME_TYPES` — comma-separated list of allowed types (e.g. `image/png,image/jpeg`), empty = allow all
  - `ENABLE_DEDUPLICATION` — enable SHA-256 deduplication (`true|false`)
  - `MAX_TTL_MIN` — maximum TTL in minutes (default 44640 = 31 days)
  - `CLEANUP_INTERVAL_MINUTES` — cleanup interval in minutes (default 10, set 0 to disable)

## Endpoints (summary)

- `GET /{base}/health` — service health
- `POST /{base}/files` — upload (multipart/form-data)
- `GET /{base}/files/:id` — file info
- `GET /{base}/files/:id/download` — file download
- `DELETE /{base}/files/:id` — delete file
- `GET /{base}/files` — list/search with filters
- `GET /{base}/files/stats` — aggregated stats
- `GET /{base}/files/:id/exists` — existence check
- `POST /{base}/cleanup/run` — run cleanup immediately

Details: [docs/api-specification.md](docs/api-specification.md)

## Errors

- 400 — validation errors (invalid ID/TTL/MIME, malformed JSON)
- 404 — file not found
- 413 — file too large (controlled by `MAX_FILE_SIZE_MB`)
- 500 — internal error

## cURL examples

Define base URL for your environment:

```bash
# For Docker Compose (default in this README)
BASE_URL="http://localhost:8080/api/v1"
# For dev mode
# BASE_URL="http://localhost:3000/api/v1"
```

- `ttlMinutes` is provided in minutes (default 1440 = 1 day). In responses, `ttlMinutes` is also returned in minutes.

- **Health**

```bash
curl -s "$BASE_URL/health"
```

- **Upload**

```bash
curl -s -X POST \
  -F "file=@./README.md" \
  -F "ttlMinutes=60" \
  "$BASE_URL/files" | jq
```

- **Info**

```bash
FILE_ID="<uuid>"
curl -s "$BASE_URL/files/$FILE_ID" | jq
```

- **Download**

```bash
curl -L -o downloaded.bin "$BASE_URL/files/$FILE_ID/download"
```

- **Delete**

```bash
curl -s -X DELETE "$BASE_URL/files/$FILE_ID" | jq
```


- **List/Search**

```bash
curl -s "$BASE_URL/files?mimeType=text/plain&limit=5&offset=0" | jq
```

- **Stats**

```bash
curl -s "$BASE_URL/files/stats" | jq
```

- **Existence check**

```bash
curl -s "$BASE_URL/files/$FILE_ID/exists" | jq
```

## More documentation

- REST API specification: [docs/api-specification.md](docs/api-specification.md)
- Storage module details: [dev_docs/STORAGE_MODULE.md](dev_docs/STORAGE_MODULE.md)
- Changelog: [docs/CHANGELOG.md](docs/CHANGELOG.md)

## Development

For full development setup, testing, linting, formatting, and debugging instructions, see the guide: [docs/dev.md](docs/dev.md)

## License

MIT
