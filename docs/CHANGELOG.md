# CHANGELOG

## Unreleased

- Breaking: Migrated HTTP layer from NestJS/Fastify to **Hono**.
- Feature: Dual runtime support:
  - Node.js/Docker: **S3-compatible storage** + **Redis metadata**.
  - Cloudflare Workers: **R2 storage** + **KV metadata**.
- Feature: Web UI is served at `/{BASE_PATH}/ui` in both runtimes.
- Change: Multipart handling is runtime-specific:
  - Node.js: streaming parser (Busboy)
  - Workers: `Request.formData()`
- Change: Scheduled cleanup is supported in both runtimes:
  - Node.js: interval via `CLEANUP_INTERVAL_MINS`
  - Workers: cron trigger (Wrangler)

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
