# Temporary Files Microservice (Hono)

Production-ready microservice for temporary file storage with TTL, content deduplication, search, and scheduled cleanup. Built with Hono and designed to run both on Node.js (Docker) and Cloudflare Workers.

## What’s included

- **Web UI** for file uploads at `/{BASE_PATH}/ui`
- Health-check endpoint `/{BASE_PATH}/api/v1/health`
- JSON logging (via internal logger adapter)
- Unified error handling with consistent JSON error responses
- **Full Streaming Support**: Efficiently handles large files via streams for both uploads and downloads (Node.js runtime)
- **Multi-file Upload**: Support for uploading multiple files in a single request
- Unit and E2E tests (Jest)
- Docker/Docker Compose support
- Cloudflare Workers + R2 + KV support (Wrangler)
- No built-in auth; expose behind your API Gateway

## Overview

The service accepts files via REST (`multipart/form-data`), stores them for a time limited by `ttlMins` (in minutes; default 1440 = 1 day), and provides endpoints for info, download, deletion, listing, stats, and existence checks. SHA-256 based deduplication prevents storing duplicate content.

### Architecture at a glance

- **Hono** for HTTP routing, compatible with both Node.js and Cloudflare Workers.
- **Node.js runtime (Docker)**:
  - File storage: **S3-compatible** (AWS S3 / Minio / Garage / etc.)
  - Metadata storage: **Redis**
  - Multipart upload parsing: streaming via Busboy (does not buffer entire upload)
- **Cloudflare Workers runtime**:
  - File storage: **R2**
  - Metadata storage: **KV**
  - UI assets served via Workers Assets binding
- **FilesService** validates inputs, enforces limits, and exposes application use-cases.
- **CleanupService** removes expired files (interval controlled by `CLEANUP_INTERVAL_MINS`; Workers cleanup is triggered by a cron schedule).

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
cp .env.production.example .env.production
docker run -d --name tmp-files-microservice \
  --env-file ./.env.production -p 8080:8080 \
  tmp-files-microservice:local

# 4) Health check
curl http://localhost:8080/api/v1/health
```

### Option C — Bare-metal (Node.js)

```bash
pnpm install
cp .env.production.example .env.production
pnpm build
pnpm start:prod
```

Default base URL: `http://localhost:8080/api/v1`

**Web UI**: After starting the service, open `http://localhost:8080/ui/` in your browser to access the upload interface.

## Environment variables

Source of truth: `.env.production.example`

- `NODE_ENV` — `production|development|test`
- `LISTEN_HOST` — e.g. `0.0.0.0` or `localhost`
- `LISTEN_PORT` — e.g. `8080`
- `BASE_PATH` — Base prefix for UI and API (default empty)
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`
- `TZ` — timezone (default `UTC`)
- Storage-related:
  - `MAX_FILE_SIZE_MB` — maximum upload size (MB). Single source of truth for upload limits; enforced by both Fastify multipart and service-level validation.
    - In Node.js runtime, streaming multipart parsing is used.
    - In Workers runtime, multipart parsing uses `Request.formData()`.
  - `ALLOWED_MIME_TYPES` — comma-separated list of allowed types (e.g. `image/png,image/jpeg`), empty = allow all
  - `ENABLE_DEDUPLICATION` — enable SHA-256 deduplication (`true|false`)
  - `MAX_TTL_MIN` — maximum TTL in minutes (default 44640 = 31 days)
  - `CLEANUP_INTERVAL_MINS` — cleanup interval in minutes (default 10, set 0 to disable)
  - `DOWNLOAD_BASE_URL` — Base URL for `downloadUrl` in responses (e.g. `https://files.example.com`). If not set, `downloadUrl` will be relative.
- Node.js runtime (Docker) — Redis (metadata storage):
  - `REDIS_ENABLED` — must be `true`
  - `REDIS_HOST` — Redis host
  - `REDIS_PORT` — Redis port
  - `REDIS_PASSWORD` — Redis password
  - `REDIS_DB` — Redis database index (default `0`)
  - `REDIS_KEY_PREFIX` — prefix for Redis keys (default `tmp_files:`)
- Node.js runtime (Docker) — S3 storage:
  - `S3_ENDPOINT`
  - `S3_REGION`
  - `S3_BUCKET`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
  - `S3_FORCE_PATH_STYLE`

## How uploads, limits and TTL work

- `ttlMins` is provided in minutes by clients (default 1440). Internally it is converted to seconds and clamped against `MAX_TTL_MIN`.
- The upload size limit is the smaller of:
  - `MAX_FILE_SIZE_MB` enforced at request parsing time (streaming in Node.js runtime), and
  - service-level validation in `FilesService`.
- Exceeding the limit returns HTTP 413.

## Storage and metadata

- Files are stored in an object storage backend:
  - Node.js: S3-compatible bucket
  - Cloudflare Workers: R2 bucket
- Metadata is stored in:
  - Node.js: Redis
  - Cloudflare Workers: KV
- Deduplication: if the same file content (by SHA-256) is uploaded again, existing metadata is reused to avoid duplicate storage.

## Cleanup behavior

- Controlled by `CLEANUP_INTERVAL_MINS`. Set `0` or less to disable scheduling.
- Expired files are removed from storage and metadata; logs include delete count and freed bytes.
- Orphaned objects (objects in storage but missing from metadata) are automatically identified and removed to reclaim space.
- Processing is done in batches of 1000 files (`CLEANUP_BATCH_SIZE`) to manage memory usage.

## Graceful Shutdown

- The service handles `SIGTERM` and `SIGINT` signals.
- It stops accepting new connections and gives active requests (including uploads) up to 25 seconds to complete before forcing exit.
- Cleanup tasks are paused during shutdown to prevent consistency issues.
- You can trigger cleanup manually via `POST /{base}/cleanup/run`.

## Web UI

The service includes a simple web interface for uploading files, accessible at `/ui/`.

- **URL**: `http://localhost:8080/ui/` (adjust host/port based on your configuration)
- **Features**:
  - Drag & drop file upload
  - Upload files from URL
  - Configure TTL (time to live) in minutes
  - Add optional JSON metadata
  - View upload results with download, info, and delete links
  - Priority: local files take precedence over URL uploads when both are provided
- **Security**: The UI has no built-in authentication. In production, protect it using your reverse proxy (e.g., Basic Auth, IP whitelist, or OAuth).

The UI is served from the `public/` directory and uses vanilla HTML/CSS/JavaScript with no external dependencies.

**Technical details**:
- Static files (CSS, JS) are served via runtime-specific adapters:
  - Node.js: `@hono/node-server/serve-static`
  - Cloudflare Workers: Assets binding (`[assets]` in `wrangler.toml`)
- The UI makes requests to the REST API relative to its own URL path (computed from `window.location.pathname`), but strips the `/ui` segment first. For example:
  - If UI is served at `/ui/`, API calls go to `/api/v1/files`
  - If UI is served at `/tmp-files/ui/`, API calls go to `/tmp-files/api/v1/files`
- All client-side code is in `public/` directory (not included in the build output)
- The UI does not use `BASE_PATH` directly; it derives the API base path from the current browser URL

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

## REST API specification (REST-only)

The service exposes a REST API with no built-in authentication. If protection is required, use an API Gateway. Swagger/OpenAPI and GraphQL are not provided.

### Base path

- The base URL for API is formed as: `/{BASE_PATH}/api/v1`
- The base URL for UI is: `/{BASE_PATH}/ui`
- Default: `/api/v1` (API) and `/ui` (UI)
- The `BASE_PATH` variable is set via environment (`.env`), without leading or trailing slashes. It is empty by default.

### Data formats

- File upload: `multipart/form-data`
- Other requests: `application/json`

### Types and units

- `ttlMins` — integer in minutes. Default is `1440` (1 day).
- Dates use ISO-8601 (UTC).
- Upload size limit is defined by `MAX_FILE_SIZE_MB` (single source of truth). This value is enforced by both Fastify multipart and service-level validation.

### Endpoints

#### Health
- GET `/{base}/health`
- Response: `{ "status": "ok" }`

#### Upload file
- POST `/{base}/files`
- Body (multipart/form-data):
  - `file` — binary content (required). Can be provided multiple times for multi-file upload.
  - `ttlMins` — integer (minutes, controller default is 1440)
  - `metadata` — string (JSON), optional. Arbitrary custom metadata
- Success 201 response:
  - If a single file is uploaded, returns a single file object (see below).
  - If multiple files are uploaded, returns an array of file objects.
```json
{
  "file": {
    "id": "uuid",
    "originalName": "file.txt",
    "mimeType": "text/plain",
    "size": 12,
    "uploadedAt": "2025-11-02T10:00:00.000Z",
    "ttlMins": 60,
    "expiresAt": "2025-11-02T11:00:00.000Z",
    "metadata": {},
    "hash": "sha256...",
    "isExpired": false,
    "timeRemainingMins": 60
  },
  "downloadUrl": "https://api.example.com/api/v1/download/uuid",
  "downloadPath": "/api/v1/download/uuid",
  "infoUrl": "/api/v1/files/uuid",
  "deleteUrl": "/api/v1/files/uuid",
  "message": "File uploaded successfully"
}
```

- Errors:
  - 400 — validation errors (e.g., invalid MIME, negative size, malformed JSON in `metadata`)
  - 413 — file exceeds the maximum allowed size (`MAX_FILE_SIZE_MB`)
  - 500 — internal error

Example 413 response:
```json
{
  "statusCode": 413,
  "timestamp": "2025-11-02T10:00:00.000Z",
  "path": "/api/v1/files",
  "method": "POST",
  "message": "File size exceeds the maximum allowed limit",
  "error": "PayloadTooLargeException"
}
```

#### Upload file by URL
- POST `/{base}/files/url`
- Body (application/json):
  - `url` — string (required). Direct link to the file to be downloaded and stored
  - `ttlMins` — integer (minutes, default 1440)
  - `metadata` — string (JSON) or object, optional. Arbitrary custom metadata
- Success 201 response: same as for regular upload
- Errors:
  - 400 — invalid URL or malformed `metadata`
  - 413 — file exceeds the maximum allowed size (`MAX_FILE_SIZE_MB`)
  - 500 — internal error

#### File info
- GET `/{base}/files/:id`
- 200 response: same `file` object as above plus `downloadUrl`, `downloadPath`, `deleteUrl`.

Errors: 400 (invalid `id`), 404 (not found or expired), 500.

#### Download file
- GET `/{base}/download/:id`
- Response: file binary data with `Content-Type`, `Content-Length`, `Content-Disposition` headers.

Errors: 400, 404, 500. Responses also include no-cache headers.

#### Delete file
- DELETE `/{base}/files/:id`
- 200 response:
```json
{ "fileId": "uuid", "message": "File deleted successfully", "deletedAt": "2025-11-02T10:00:00.000Z" }
```

Errors: 400, 404 (not found), 500.

#### List/search files
- GET `/{base}/files`
- Query (all optional):
  - `mimeType`
  - `minSize`, `maxSize` (bytes)
  - `uploadedAfter`, `uploadedBefore` (ISO date)
  - `expiredOnly` (true|false)
  - `limit`, `offset`
- 200 response:
```json
{
  "files": [ { "id": "uuid", "originalName": "file.txt", "mimeType": "text/plain", "size": 12, "uploadedAt": "...", "ttlMins": 60, "expiresAt": "...", "hash": "...", "isExpired": false, "timeRemainingMins": 60 } ],
  "total": 1,
  "pagination": { "page": 1, "limit": 10, "totalPages": 1, "hasNext": false, "hasPrev": false }
}
```

#### Stats
- GET `/{base}/files/stats`
- 200 response:
```json
{ "stats": { /* aggregates */ }, "generatedAt": "2025-11-02T10:00:00.000Z" }
```

#### Existence check
- GET `/{base}/files/:id/exists`
- 200 response:
```json
{ "exists": true, "fileId": "uuid", "isExpired": false }
```

- Behavior:
  - The `isExpired` field is always present and is a boolean
  - 400 is returned for an invalid `id`

#### Manual cleanup
- POST `/{base}/cleanup/run`
- Description: triggers cleanup of expired files immediately.
- 200 response:
```json
{ "success": true, "message": "Cleanup completed" }
```

Errors: 500 (if cleanup failed)

### Error handling

- 400: validation errors (ID, TTL, size and MIME, malformed JSON)
- 404: file not found or expired
- 413: file too large (limit source — `MAX_FILE_SIZE_MB`)
- 500: internal error

Unified error structure:
```json
{
  "statusCode": 400,
  "timestamp": "2025-11-02T10:00:00.000Z",
  "path": "/api/v1/files/invalid",
  "method": "GET",
  "message": "File ID validation failed: File ID must contain only alphanumeric characters, hyphens, and underscores",
  "error": "HttpError"
}
```

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
- Startup fails with storage error: verify connectivity/credentials for your storage backends (S3/R2 and Redis/KV).

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

### Migration to Redis

If you are currently using the filesystem for metadata and want to switch to Redis:

1. Ensure Redis is running and accessible.
2. Set `REDIS_ENABLED=true` and other `REDIS_*` variables in your environment.
3. Run the migration script:
   ```bash
   pnpm ts-node src/scripts/migrate-to-redis.ts
   ```
4. Restart the service.

## More documentation

- Web UI usage guide: [docs/WEB_UI.md](docs/WEB_UI.md)
- Storage module details: [dev_docs/STORAGE_MODULE.md](dev_docs/STORAGE_MODULE.md)
- Changelog: [docs/CHANGELOG.md](docs/CHANGELOG.md)

## FAQ

- Why not keep metadata in a database?
  - This service aims to be lightweight and self-contained. For large-scale needs, you can replace the storage layer with a DB-backed implementation.
- How do I change the base path?
  - Set `BASE_PATH` (without slashes). The UI will be served at `/{BASE_PATH}/ui` and the API will be served at `/{BASE_PATH}/api/v1`. The Web UI does not read `BASE_PATH` directly; it derives the API base path from the current browser URL.
- Can I disable deduplication?
  - Yes, set `ENABLE_DEDUPLICATION=false`.

## Development

### Requirements

- Node.js 22+
- pnpm 10+

### Quick start (dev)

```bash
# 1) Install dependencies
pnpm install

# 2) Configure environment (dev)
cp env.development.example .env.development

# 3) Run in development (watch mode)
pnpm start:dev
```

- Default base URL (dev): `http://localhost:8080/api/v1`

### Tests

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

### Code quality

```bash
# Lint
pnpm lint

# Format
pnpm format
```

### Debugging the app

```bash
# Start Node entry in debug with watch
pnpm start:debug
```

Attach your debugger to the Node.js inspector port output by the command.

### Useful notes

- Sensitive headers are redacted in logs (`authorization`, `x-api-key`).
- Path aliases for TypeScript/Jest: `@/*`, `@test/*`.

## License

MIT
