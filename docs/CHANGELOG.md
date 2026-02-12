# CHANGELOG

## Unreleased

- Breaking: Migrated HTTP layer from NestJS/Fastify to **Hono**.
- Breaking: Removed deduplication logic and `ENABLE_DEDUPLICATION` configuration.
- Breaking: Switched `POST /files` upload from `multipart/form-data` to raw body (`application/octet-stream`) with upload parameters passed via headers.
- Feature: Dual runtime support:
  - Node.js/Docker: **S3-compatible storage** + **Storage-based metadata**.
  - Cloudflare Workers: **R2 storage** + **Storage-based metadata**.
- Feature: Web UI moved to root path `/{BASE_PATH}/` and is now disabled by default.
- Feature: Added `ENABLE_UI` environment variable to toggle Web UI availability (default: `false`).
- Change: Maintenance/Cleanup is manually triggered via `/maintenance/run` endpoint (compatible with both runtimes).
- Change: Unified default bucket name to `tmp-files-microservice` across all configs and scripts.
- Change: Improved `setup-dev.sh` to handle `docker-compose.yml` generation and numbering.
- Change: Updated `ENABLE_UI=true` by default in production `docker-compose.yml`.
- Feature: Added optional built-in authentication:
  - API: Basic/Bearer auth required when configured (download endpoint remains public)
  - UI: optional Basic auth

## 0.2.1 - 2025-11-02

- Unified storage configuration usage via `@config/storage.config` in `StorageService` (no direct env reads)
- Fixed `FilesService.fileExists` to respect `includeExpired`
- Switched docker-compose to build local image from Dockerfile (`tmp-files-service`) instead of pulling external image
- Removed unused `sqlite3` dependency
- Minor: dynamic import for `file-type` to avoid ESM/CJS interop issues under Jest

## 0.2.0 - 2025-11-02

- Migrated business logic for temporary file storage from legacy service (`_old`) into boilerplate
- Implemented REST-only API: upload, info, download, delete, list, stats, exists
- Added Storage, Files, and Cleanup modules (Nest Schedule-based cleanup)
- Wired Fastify multipart and global API prefix using boilerplate config
- Added storage configuration (`src/config/storage.config.ts`) and env examples
- Brought essential developer docs to `dev_docs/STORAGE_MODULE.md`
- Expanded Jest config and added a basic StorageService unit test
