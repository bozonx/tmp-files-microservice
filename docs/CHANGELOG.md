# CHANGELOG

## Unreleased

- Breaking: API parameter renamed to `ttlMinutes`. Both requests and responses use minutes (default 1440 = 1 day).
- Change: Increased default `MAX_TTL_MIN` from 10080 (7 days) to 44640 (31 days). Updated code defaults, env examples, and docker-compose.
- Breaking: STORAGE_DIR environment variable is now required; service fails to start if missing. Docs and env examples updated.
- Change: Switched cleanup scheduling from cron to interval via `CLEANUP_INTERVAL_MINUTES` (set `0` to disable). Replaces `CLEANUP_CRON`.
- Feature: Added REST endpoint `POST /{API_BASE_PATH}/v1/cleanup/run` to trigger cleanup on demand.
- Docs: README rewritten in English and focused on production usage (Docker/Compose/Bare-metal), env vars summary aligned with `.env.production.example`, cURL and endpoint sections clarified.
- Docs: `docs/dev.md` translated to English and focused on development workflows (scripts, tests, lint/format, debugging, notes).
- Change: Standardized 413 (Payload Too Large) for oversized uploads; `MAX_FILE_SIZE_MB` is the single source of truth for upload size across multipart and service validation.
- Change: `GET /files/:id/exists` now validates `id` and returns 400 on invalid values; response always includes boolean `isExpired`.
- Docs: Expanded `docs/api-specification.md` with detailed success and error examples, explicit error format, and cleanup endpoint documentation.
- Docs: README updated with error section and `MAX_FILE_SIZE_MB` notes.
- Tests: Added unit test for 413 behavior and E2E tests for `exists` validation and `isExpired` presence.
- Breaking: удалён параметр загрузки `customFilename`; он больше не поддерживается в API, коде и документации.
 - Breaking: удалён параметр `includeExpired` во всех эндпоинтах. Просроченные файлы всегда считаются недоступными: их нельзя получить, скачать или проверить существование (они считаются как "не найдены"). Исключения: листинг поддерживает `expiredOnly`, а удаление просроченных доступно без дополнительных параметров.

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
