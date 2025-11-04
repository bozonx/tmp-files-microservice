# API Спецификация (REST-only)

Сервис предоставляет REST API без встроенной авторизации. Если требуется защита, используйте API Gateway. Swagger/OpenAPI и GraphQL отсутствуют.

## Базовый путь

- Базовый URL формируется как: `/{API_BASE_PATH}/v1`
- По умолчанию: `/api/v1`

## Форматы данных

- Загрузка файлов: `multipart/form-data`
- Остальные запросы: `application/json`

## Типы и единицы

- `ttl` — целое число в минутах (во входящих запросах). По умолчанию — `1440` (1 сутки).
- Даты в ISO-8601 (UTC).

## Endpoints

### Health
- GET `/{base}/health`
- Ответ: `{ "status": "ok" }`

### Загрузка файла
- POST `/{base}/files`
- Тело (multipart/form-data):
  - `file` — бинарное содержимое (обязательно)
  - `ttl` — integer (минуты, по умолчанию 1440 на уровне контроллера)
  - `metadata` — string (JSON), опционально
  - `allowDuplicate` — `true|false`, опционально (по умолчанию false)
  - `customFilename` — string, опционально
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
    "timeRemaining": 3599
  },
  "downloadUrl": "/api/v1/files/uuid/download",
  "infoUrl": "/api/v1/files/uuid",
  "deleteUrl": "/api/v1/files/uuid",
  "message": "File uploaded successfully"
}
```

### Информация о файле
- GET `/{base}/files/:id`
- Query: `includeExpired=true|false`
- Ответ 200: как `file` объект из примера выше + `downloadUrl`, `deleteUrl`.

### Скачивание файла
- GET `/{base}/files/:id/download`
- Query: `includeExpired=true|false`
- Ответ: бинарные данные файла + заголовки `Content-Type`, `Content-Length`, `Content-Disposition`.

### Удаление файла
- DELETE `/{base}/files/:id`
- Query: `force=true|false` (при истечении TTL)
- Ответ 200:
```json
{ "fileId": "uuid", "message": "File deleted successfully", "deletedAt": "2025-11-02T10:00:00.000Z" }
```

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
- Query: `includeExpired=true|false`
- Ответ 200:
```json
{ "exists": true, "fileId": "uuid", "isExpired": false }
```

## Ошибки
- 400: ошибки валидации (ID, TTL, размер и MIME)
- 404: файл не найден или истёк (если не указан `includeExpired`/`force`)
- 413: файл слишком большой
- 500: внутренняя ошибка

## Примечания
- Авторизация отсутствует на уровне сервиса. Применяйте её на API Gateway.
- Входной параметр `ttl` указывается в минутах. В ответах поле `ttl` возвращается в секундах (отражает фактическое время жизни на стороне сервера).
