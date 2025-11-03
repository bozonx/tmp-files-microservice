# CHANGELOG

## Unreleased

- Breaking: STORAGE_DIR environment variable is now required; service fails to start if missing. Docs and env examples updated.
- Docs: README rewritten in English and focused on production usage (Docker/Compose/Bare-metal), env vars summary aligned with `.env.production.example`, cURL and endpoint sections clarified.
- Docs: `docs/dev.md` translated to English and focused on development workflows (scripts, tests, lint/format, debugging, notes).

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
