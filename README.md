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

The service accepts files via REST (`multipart/form-data`), stores them for a time limited by `ttlMins` (in minutes; default 1440 = 1 day), and provides endpoints for info, download, deletion, listing, stats, and existence checks. SHA-256 based deduplication prevents storing duplicate content.

### Architecture at a glance

- **NestJS + Fastify** for a high-performance HTTP layer.
- **StorageService** persists files on the filesystem and maintains metadata in a JSON file.
- **FilesService** validates inputs, enforces limits, and exposes application use-cases.
- **CleanupService** periodically removes expired files (interval controlled by `CLEANUP_INTERVAL_MINS`).
- **Pino logger** with JSON logs in production and pretty logs in development.

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
  --env-file ./.env.production -p 8080:8080 \
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

Default base URL: `http://localhost:8080/api/v1`

## Environment variables

Source of truth: `.env.production.example`

- `NODE_ENV` — `production|development|test`
- `LISTEN_HOST` — e.g. `0.0.0.0` or `localhost`
- `LISTEN_PORT` — e.g. `8080`
- `API_BASE_PATH` — API prefix (default `api`)
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`
- `TZ` — timezone (default `UTC`)
- Storage-related:
  - `STORAGE_DIR` — base directory for files and metadata. MANDATORY.
  - `MAX_FILE_SIZE_MB` — maximum upload size (MB). Single source of truth for upload limits; enforced by both Fastify multipart and service-level validation.
    - Fastify `bodyLimit` is computed internally as `MAX_FILE_SIZE_MB` (bytes) + overhead for multipart boundaries/headers/fields.
    - Overhead size is controlled by `HTTP_CONSTANTS.MULTIPART_OVERHEAD_MB` in code and defaults to 2 MiB.
  - `ALLOWED_MIME_TYPES` — comma-separated list of allowed types (e.g. `image/png,image/jpeg`), empty = allow all
  - `ENABLE_DEDUPLICATION` — enable SHA-256 deduplication (`true|false`)
  - `MAX_TTL_MIN` — maximum TTL in minutes (default 44640 = 31 days)
  - `CLEANUP_INTERVAL_MINS` — cleanup interval in minutes (default 10, set 0 to disable)

## How uploads, limits and TTL work

- `ttlMins` is provided in minutes by clients (default 1440). Internally it is converted to seconds and clamped against `MAX_TTL_MIN`.
- The upload size limit is the smaller of:
  - `MAX_FILE_SIZE_MB` enforced by Fastify multipart (streaming), and
  - service-level validation in `FilesService`.
- Exceeding the limit returns HTTP 413.

## Storage layout and metadata

- Files are stored under `STORAGE_DIR` grouped by month (e.g. `YYYY-MM`).
- Metadata is kept in `data.json` in the storage root and updated atomically.
- Deduplication: if the same file content (by SHA-256) is uploaded again, existing metadata is reused to avoid duplicate storage.

## Cleanup behavior

- Controlled by `CLEANUP_INTERVAL_MINS`. Set `0` or less to disable scheduling.
- Expired files are removed from disk and metadata; logs include delete count and freed bytes.
- You can trigger cleanup manually via `POST /{base}/cleanup/run`.

## Endpoints (summary)

- `GET /{base}/health` — service health
- `POST /{base}/files` — upload (multipart/form-data)
- `POST /{base}/files/url` — upload by providing a direct file URL (JSON)
- `GET /{base}/files/:id` — file info
- `GET /{base}/download/:id` — file download
- `DELETE /{base}/files/:id` — delete file
- `GET /{base}/files` — list/search with filters
- `GET /{base}/files/stats` — aggregated stats
- `GET /{base}/files/:id/exists` — existence check
- `POST /{base}/cleanup/run` — run cleanup immediately

Details: [docs/api-specification.md](docs/api-specification.md)

## Security and hardening

- The service has no built-in auth; put it behind your API Gateway or reverse proxy.
- Example Caddy config exposes `/download/:id` publicly while guarding other routes with Bearer auth.
- Validate inputs at the gateway if needed (rate limits, WAF rules).
- Consider antivirus/malware scanning in your ingestion pipeline depending on your risk profile.
- Sensitive headers are redacted in logs.

## Logging

- Production: structured JSON via Pino (level via `LOG_LEVEL`).
- Development: pretty logs with more verbosity.
- Health route logs are minimized in production to reduce noise.

## Deployment and reverse proxy

- See Docker Compose and Dockerfile in `docker/` for reference setups.
- The included Caddyfile shows how to:
  - expose `GET /download/:id` publicly; and
  - guard other routes under `/tmp-files` with Bearer tokens.
- Ensure `STORAGE_DIR` is a persistent volume and has read/write permissions for the container user.

## Troubleshooting

- 413 Payload Too Large: increase `MAX_FILE_SIZE_MB` (and restart) or upload smaller files.
- 400 Validation errors: check `ttlMins`, JSON `metadata`, or file ID format.
- 404 Not Found: the file does not exist or has expired.
- Startup fails with storage error: set `STORAGE_DIR` and ensure the path is writable.
- Permission denied on writes: fix host directory ownership/permissions or run the container with appropriate user.

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
# BASE_URL="http://localhost:8080/api/v1"
```

- `ttlMins` is provided in minutes (default 1440 = 1 day). In responses, `ttlMins` is also returned in minutes.

- **Health**

```bash
curl -s "$BASE_URL/health"
```

- **Upload**

```bash
curl -s -X POST \
  -F "file=@./README.md" \
  -F "ttlMins=60" \
  "$BASE_URL/files" | jq
```

- **Upload by URL**

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/file.bin","ttlMins":1440, "metadata":"{\"source\":\"example\"}"}' \
  "$BASE_URL/files/url" | jq
```

- **Info**

```bash
FILE_ID="<uuid>"
curl -s "$BASE_URL/files/$FILE_ID" | jq
```

- **Download**

```bash
curl -L -o downloaded.bin "$BASE_URL/download/$FILE_ID"
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

## FAQ

- Why not keep metadata in a database?
  - This service aims to be lightweight and self-contained. For large-scale needs, you can replace the storage layer with a DB-backed implementation.
- How do I change the API base path?
  - Set `API_BASE_PATH` (without slashes). The final base is `/{API_BASE_PATH}/v1`.
- Can I disable deduplication?
  - Yes, set `ENABLE_DEDUPLICATION=false`.

## Development

For full development setup, testing, linting, formatting, and debugging instructions, see the guide: [docs/dev.md](docs/dev.md)

## License

MIT
