# API Specification (REST-only)

The service exposes a REST API with no built-in authentication. If protection is required, use an API Gateway. Swagger/OpenAPI and GraphQL are not provided.

## Base path

- The base URL is formed as: `/{API_BASE_PATH}/v1`
- Default: `/api/v1`
- The `API_BASE_PATH` variable is set via environment (`.env`), without leading or trailing slashes.

## Data formats

- File upload: `multipart/form-data`
- Other requests: `application/json`

## Types and units

- `ttlMinutes` — integer in minutes. Default is `1440` (1 day).
- Dates use ISO-8601 (UTC).
- Upload size limit is defined by `MAX_FILE_SIZE_MB` (single source of truth). This value is enforced by both Fastify multipart and service-level validation.

## Endpoints

### Health
- GET `/{base}/health`
- Response: `{ "status": "ok" }`

### Upload file
- POST `/{base}/files`
- Body (multipart/form-data):
  - `file` — binary content (required)
  - `ttlMinutes` — integer (minutes, controller default is 1440)
  - `metadata` — string (JSON), optional. Arbitrary custom metadata
- Success 201 response:
```json
{
  "file": {
    "id": "uuid",
    "originalName": "file.txt",
    "mimeType": "text/plain",
    "size": 12,
    "uploadedAt": "2025-11-02T10:00:00.000Z",
    "ttlMinutes": 60,
    "expiresAt": "2025-11-02T11:00:00.000Z",
    "metadata": {},
    "hash": "sha256...",
    "isExpired": false,
    "timeRemainingMinutes": 60
  },
  "downloadUrl": "/api/v1/files/uuid/download",
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

### Загрузка файла по URL
- POST `/{base}/files/url`
- Тело запроса (application/json):
  - `url` — строка (обязательно). Прямая ссылка на файл, который нужно скачать и сохранить
  - `ttlMinutes` — целое число (в минутах, по умолчанию 1440)
  - `metadata` — строка (JSON) или объект, опционально. Произвольные метаданные
- Успешный ответ 201: такой же, как для обычной загрузки
- Ошибки:
  - 400 — некорректный URL или неверный формат `metadata`
  - 413 — файл превышает максимальный допустимый размер (`MAX_FILE_SIZE_MB`)
  - 500 — внутренняя ошибка

### File info
- GET `/{base}/files/:id`
- 200 response: same `file` object as above plus `downloadUrl`, `deleteUrl`.

Errors: 400 (invalid `id`), 404 (not found or expired), 500.

### Download file
- GET `/{base}/files/:id/download`
- Response: file binary data with `Content-Type`, `Content-Length`, `Content-Disposition` headers.

Errors: 400, 404, 500. Responses also include no-cache headers.

### Delete file
- DELETE `/{base}/files/:id`
- 200 response:
```json
{ "fileId": "uuid", "message": "File deleted successfully", "deletedAt": "2025-11-02T10:00:00.000Z" }
```

Errors: 400, 404 (not found), 500.

### List/search files
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
  "files": [ { "id": "uuid", "originalName": "file.txt", "mimeType": "text/plain", "size": 12, "uploadedAt": "...", "ttlMinutes": 60, "expiresAt": "...", "hash": "...", "isExpired": false, "timeRemainingMinutes": 60 } ],
  "total": 1,
  "pagination": { "page": 1, "limit": 10, "totalPages": 1, "hasNext": false, "hasPrev": false }
}
```

### Stats
- GET `/{base}/files/stats`
- 200 response:
```json
{ "stats": { /* aggregates */ }, "generatedAt": "2025-11-02T10:00:00.000Z" }
```

### Existence check
- GET `/{base}/files/:id/exists`
- 200 response:
```json
{ "exists": true, "fileId": "uuid", "isExpired": false }
```

- Behavior:
  - The `isExpired` field is always present and is a boolean
  - 400 is returned for an invalid `id`

### Manual cleanup
- POST `/{base}/cleanup/run`
- Description: triggers cleanup of expired files immediately.
- 200 response:
```json
{ "success": true, "message": "Cleanup completed" }
```

Errors: 500 (if cleanup failed)

## Errors
- 400: validation errors (ID, TTL, size and MIME, malformed JSON)
- 404: file not found or expired
- 413: file too large (limit source — `MAX_FILE_SIZE_MB`)
- 500: internal error

Error structure (unified format):
```json
{
  "statusCode": 400,
  "timestamp": "2025-11-02T10:00:00.000Z",
  "path": "/api/v1/files/invalid",
  "method": "GET",
  "message": "File ID validation failed: File ID must contain only alphanumeric characters, hyphens, and underscores",
  "error": { /* original exception response or name */ }
}
```
