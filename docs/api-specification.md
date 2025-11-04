# API Спецификация (REST-only)

Сервис предоставляет REST API без встроенной авторизации. Если требуется защита, используйте API Gateway. Swagger/OpenAPI и GraphQL отсутствуют.

## Базовый путь

- Базовый URL формируется как: `/{API_BASE_PATH}/v1`
- По умолчанию: `/api/v1`
- Переменная `API_BASE_PATH` задаётся через окружение (`.env`), без ведущих/замыкающих слешей.

## Форматы данных

- Загрузка файлов: `multipart/form-data`
- Остальные запросы: `application/json`

## Типы и единицы

- `ttl` — целое число в минутах (во входящих запросах). По умолчанию — `1440` (1 сутки).
- Даты в ISO-8601 (UTC).
- Ограничение размера загрузки задаётся переменной `MAX_FILE_SIZE_MB` (источник истины). Это значение применяется и в Fastify multipart, и в сервисной валидации.

## Endpoints

### Health
- GET `/{base}/health`
- Ответ: `{ "status": "ok" }`

### Загрузка файла
- POST `/{base}/files`
- Тело (multipart/form-data):
  - `file` — бинарное содержимое (обязательно)
  - `ttl` — integer (минуты, по умолчанию 1440 на уровне контроллера)
  - `metadata` — string (JSON), опционально. Любые свои метаданные
- Успешный ответ 201:
```json
{
  "file": {
    "id": "uuid",
    "originalName": "file.txt",
    "mimeType": "text/plain",
    "size": 12,
    "uploadedAt": "2025-11-02T10:00:00.000Z",
    "ttl": 3600,
    "expiresAt": "2025-11-02T11:00:00.000Z",
    "metadata": {},
    "hash": "sha256...",
    "isExpired": false,
    "timeRemainingMinutes": 3599
  },
  "downloadUrl": "/api/v1/files/uuid/download",
  "infoUrl": "/api/v1/files/uuid",
  "deleteUrl": "/api/v1/files/uuid",
  "message": "File uploaded successfully"
}
```

- Ошибки:
  - 400 — ошибки валидации (например, недопустимый MIME, отрицательный размер, некорректный JSON в `metadata`)
  - 413 — файл превышает максимальный допустимый размер (`MAX_FILE_SIZE_MB`)
  - 500 — внутренняя ошибка
  
Пример ответа 413:
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

### Информация о файле
- GET `/{base}/files/:id`
- Ответ 200: как `file` объект из примера выше + `downloadUrl`, `deleteUrl`.

Ошибки: 400 (невалидный `id`), 404 (не найден или истёк), 500.

### Скачивание файла
- GET `/{base}/files/:id/download`
- Ответ: бинарные данные файла + заголовки `Content-Type`, `Content-Length`, `Content-Disposition`.

Ошибки: 400, 404, 500. В ответах также выставляются no-cache заголовки.

### Удаление файла
- DELETE `/{base}/files/:id`
- Query: `force=true|false` (при истечении TTL)
- Ответ 200:
```json
{ "fileId": "uuid", "message": "File deleted successfully", "deletedAt": "2025-11-02T10:00:00.000Z" }
```

Ошибки: 400, 404 (не найден или истёк без `force`), 500.

### Листинг/поиск файлов
- GET `/{base}/files`
- Query (все опциональны):
  - `mimeType`
  - `minSize`, `maxSize` (байты)
  - `uploadedAfter`, `uploadedBefore` (ISO дата)
  - `expiredOnly` (true|false)
  - `limit`, `offset`
- Ответ 200:
```json
{
  "files": [ { "id": "uuid", "originalName": "file.txt", "mimeType": "text/plain", "size": 12, "uploadedAt": "...", "ttl": 3600, "expiresAt": "...", "hash": "...", "isExpired": false, "timeRemaining": 3599 } ],
  "total": 1,
  "pagination": { "page": 1, "limit": 10, "totalPages": 1, "hasNext": false, "hasPrev": false }
}
```

### Статистика
- GET `/{base}/files/stats`
- Ответ 200:
```json
{ "stats": { /* агрегаты */ }, "generatedAt": "2025-11-02T10:00:00.000Z" }
```

### Проверка существования
- GET `/{base}/files/:id/exists`
- Ответ 200:
```json
{ "exists": true, "fileId": "uuid", "isExpired": false }
```

- Поведение:
  - Поле `isExpired` всегда присутствует и имеет тип boolean
  - При невалидном `id` возвращается 400

### Ручная очистка
- POST `/{base}/cleanup/run`
- Описание: запускает процесс очистки просроченных файлов немедленно.
- Ответ 200:
```json
{ "success": true, "message": "Cleanup completed" }
```

Ошибки: 500 (если очистка завершилась ошибкой)

## Ошибки
- 400: ошибки валидации (ID, TTL, размер и MIME, некорректный JSON)
- 404: файл не найден или истёк (при удалении можно указать `force` для просроченных)
- 413: файл слишком большой (источник лимита — `MAX_FILE_SIZE_MB`)
- 500: внутренняя ошибка

Структура ошибки (унифицированный формат):
```json
{
  "statusCode": 400,
  "timestamp": "2025-11-02T10:00:00.000Z",
  "path": "/api/v1/files/invalid",
  "method": "GET",
  "message": "File ID validation failed: File ID must contain only alphanumeric characters, hyphens, and underscores",
  "error": { /* оригинальный ответ исключения или имя */ }
}
```

## Примечания
- Авторизация отсутствует на уровне сервиса. Применяйте её на API Gateway.
- Входной параметр `ttl` указывается в минутах. В ответах поле `ttl` возвращается в секундах (отражает фактическое время жизни на стороне сервера).
