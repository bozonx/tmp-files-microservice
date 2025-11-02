# CHANGELOG

## 0.2.0 - 2025-11-02

- Migrated business logic for temporary file storage from legacy service (`_old`) into boilerplate
- Implemented REST-only API: upload, info, download, delete, list, stats, exists
- Added Storage, Files, and Cleanup modules (Nest Schedule-based cleanup)
- Wired Fastify multipart and global API prefix using boilerplate config
- Added storage configuration (`src/config/storage.config.ts`) and env examples
- Brought essential developer docs to `dev_docs/STORAGE_MODULE.md`
- Expanded Jest config and added a basic StorageService unit test
