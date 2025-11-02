# API Спецификация micro-file-cache

## Обзор

Данный документ описывает REST API микросервиса `micro-file-cache` для временного кэширования файлов с автоматической очисткой.

## Базовый URL

```
http://localhost:3000
```

## Базовый путь API

По умолчанию API доступен по пути `/api/v1/`. Для размещения нескольких микросервисов на одном хосте можно настроить базовый путь через переменные окружения:

```env
API_BASE_PATH=file-cache
API_VERSION=v1
```

В этом случае все endpoints будут доступны по пути `/file-cache/v1/` вместо `/api/v1/`.

## Аутентификация

Сервис использует Bearer токен аутентификацию. Все API endpoints (кроме `/api/health`) требуют передачи валидного токена в заголовке `Authorization`.

### Формат аутентификации

```http
Authorization: Bearer <token>
```

### Настройка токена

Токен настраивается через переменную окружения `AUTH_TOKEN`. Если переменная не установлена, аутентификация отключается.

### Примеры использования

```bash
# С токеном
curl -H "Authorization: Bearer your-secret-token" \
  -X POST http://localhost:3000/api/files \
  -F "file=@document.pdf" \
  -F "ttlMinutes=60"

# Без токена (если AUTH_ENABLED=false)
curl -X POST http://localhost:3000/api/files \
  -F "file=@document.pdf" \
  -F "ttlMinutes=60"
```

### Коды ошибок аутентификации

| Код             | Описание              |
| --------------- | --------------------- |
| `UNAUTHORIZED`  | Токен не предоставлен |
| `INVALID_TOKEN` | Неверный токен        |

## Форматы данных

### Content-Type

- **Загрузка файлов**: `multipart/form-data`
- **Остальные запросы**: `application/json`

### Формат ответов

Все ответы возвращаются в формате JSON с единообразной структурой:

```json
{
  "success": true,
  "data": { ... },
  "message": "Описание результата",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Формат ошибок

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Описание ошибки",
    "details": { ... }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Endpoints

### 1. Загрузка файла

**POST** `/api/v1/files`

Загружает файл в кэш с указанием времени жизни.

#### Параметры запроса

| Параметр | Тип    | Обязательный | Описание                                                          |
| -------- | ------ | ------------ | ----------------------------------------------------------------- |
| `file`   | File   | Да           | Загружаемый файл                                                  |
| `ttl`    | number | Да           | Время жизни файла в секундах (обязательно, не больше MAX_TTL_MIN) |

#### Ограничения

- Максимальный размер файла: 100MB (настраивается через `MAX_FILE_SIZE_MB`)
- Разрешенные MIME типы: любые (настраивается через `ALLOWED_MIME_TYPES`)
- Обязательный TTL: При загрузке файла обязательно указывать время жизни в секундах
- Максимальный TTL: 7 дней (настраивается через `MAX_TTL_MIN`)

#### Пример запроса

```bash
curl -H "Authorization: Bearer your-secret-token" \
  -X POST http://localhost:3000/api/v1/files \
  -F "file=@document.pdf" \
  -F "ttlMinutes=60"
```

#### Пример ответа

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "http://localhost:3000/api/v1/files/550e8400-e29b-41d4-a716-446655440000/download",
    "originalName": "document.pdf",
    "size": 1024000,
    "mimeType": "application/pdf",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "expiresAt": "2024-01-15T11:30:00.000Z",
    "ttlMinutes": 60,
    "isDuplicate": false
  },
  "message": "File uploaded successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Коды ошибок

| Код              | Описание                     |
| ---------------- | ---------------------------- |
| `FILE_TOO_LARGE` | Размер файла превышает лимит |
| `INVALID_TTL`    | Некорректное значение TTL    |
| `UPLOAD_FAILED`  | Ошибка при сохранении файла  |
| `UNAUTHORIZED`   | Токен не предоставлен        |
| `INVALID_TOKEN`  | Неверный токен               |

### 2. Получение информации о файле

**GET** `/api/v1/files/:id`

Возвращает метаданные файла по его ID.

#### Параметры пути

| Параметр | Тип    | Описание   |
| -------- | ------ | ---------- |
| `id`     | string | UUID файла |

#### Пример запроса

```bash
curl -H "Authorization: Bearer your-secret-token" \
  http://localhost:3000/api/v1/files/550e8400-e29b-41d4-a716-446655440000
```

#### Пример ответа

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "originalName": "document.pdf",
    "size": 1024000,
    "mimeType": "application/pdf",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "expiresAt": "2024-01-15T11:30:00.000Z",
    "ttlMinutes": 60,
    "remainingMinutes": 45
  },
  "message": "File information retrieved",
  "timestamp": "2024-01-15T10:45:00.000Z"
}
```

#### Коды ошибок

| Код              | Описание              |
| ---------------- | --------------------- |
| `FILE_NOT_FOUND` | Файл не найден        |
| `UNAUTHORIZED`   | Токен не предоставлен |
| `INVALID_TOKEN`  | Неверный токен        |

### 3. Скачивание файла

**GET** `/api/v1/files/:id/download`

Возвращает файл для скачивания.

#### Параметры пути

| Параметр | Тип    | Описание   |
| -------- | ------ | ---------- |
| `id`     | string | UUID файла |

#### Пример запроса

```bash
curl -H "Authorization: Bearer your-secret-token" \
  -O http://localhost:3000/api/v1/files/550e8400-e29b-41d4-a716-446655440000/download
```

#### Ответ

- **Content-Type**: Соответствует MIME типу файла
- **Content-Disposition**: `attachment; filename="original-name"`
- **Content-Length**: Размер файла в байтах

#### Коды ошибок

| Код              | Описание              |
| ---------------- | --------------------- |
| `FILE_NOT_FOUND` | Файл не найден        |
| `UNAUTHORIZED`   | Токен не предоставлен |
| `INVALID_TOKEN`  | Неверный токен        |

### 4. Удаление файла

**DELETE** `/api/v1/files/:id`

Удаляет файл из кэша.

#### Параметры пути

| Параметр | Тип    | Описание   |
| -------- | ------ | ---------- |
| `id`     | string | UUID файла |

#### Пример запроса

```bash
curl -H "Authorization: Bearer your-secret-token" \
  -X DELETE http://localhost:3000/api/v1/files/550e8400-e29b-41d4-a716-446655440000
```

#### Пример ответа

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "deletedAt": "2024-01-15T10:45:00.000Z"
  },
  "message": "File deleted successfully",
  "timestamp": "2024-01-15T10:45:00.000Z"
}
```

#### Коды ошибок

| Код              | Описание                  |
| ---------------- | ------------------------- |
| `FILE_NOT_FOUND` | Файл не найден            |
| `DELETE_FAILED`  | Ошибка при удалении файла |
| `UNAUTHORIZED`   | Токен не предоставлен     |
| `INVALID_TOKEN`  | Неверный токен            |

### 5. Проверка состояния сервиса

**GET** `/api/v1/health`

Возвращает информацию о состоянии сервиса.

#### Пример запроса

```bash
curl http://localhost:3000/api/v1/health
```

#### Пример ответа

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600,
    "version": "1.0.0",
    "environment": "development",
    "storage": {
      "totalFiles": 15,
      "totalSize": 52428800,
      "availableSpace": 1073741824
    },
    "cleanup": {
      "lastRun": "2024-01-15T10:30:00.000Z",
      "nextRun": "2024-01-15T10:31:00.000Z",
      "filesDeleted": 3
    }
  },
  "message": "Service is healthy",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Модели данных

### FileInfo

```typescript
interface FileInfo {
  id: string; // UUID файла
  originalName: string; // Оригинальное имя файла
  size: number; // Размер файла в байтах
  mimeType: string; // MIME тип файла
  uploadedAt: string; // ISO-8601 дата загрузки
  expiresAt: string; // ISO-8601 дата истечения
  ttl: number; // TTL в секундах (обязательный)
  remainingMinutes?: number; // Оставшееся время в минутах (только для GET)
}
```

### UploadResponse

```typescript
interface UploadResponse {
  id: string;
  url: string; // URL для скачивания
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  expiresAt: string;
  ttlMinutes: number;
  isDuplicate: boolean; // Флаг дубликата
}
```

### HealthResponse

```typescript
interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  uptime: number; // Время работы в секундах
  version: string;
  environment: string;
  storage: {
    totalFiles: number;
    totalSize: number; // Общий размер в байтах
    availableSpace: number; // Доступное место в байтах
  };
  cleanup: {
    lastRun: string; // ISO-8601 дата последнего запуска
    nextRun: string; // ISO-8601 дата следующего запуска
    filesDeleted: number; // Количество удаленных файлов
  };
}
```

## Коды HTTP статусов

| Код | Описание                  |
| --- | ------------------------- |
| 200 | Успешный запрос           |
| 201 | Файл успешно загружен     |
| 400 | Некорректный запрос       |
| 404 | Файл не найден            |
| 413 | Файл слишком большой      |
| 500 | Внутренняя ошибка сервера |

## Примеры использования

### JavaScript/TypeScript

```typescript
// Загрузка файла
async function uploadFile(file: File, ttlMinutes: number, token: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ttlMinutes', ttlMinutes.toString());

  const response = await fetch('/api/v1/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return response.json();
}

// Получение информации о файле
async function getFileInfo(id: string, token: string) {
  const response = await fetch(`/api/v1/files/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}

// Скачивание файла
function downloadFile(id: string, filename: string) {
  const link = document.createElement('a');
  link.href = `/api/v1/files/${id}/download`;
  link.download = filename;
  link.click();
}
```

### Python

```python
import requests

# Загрузка файла
def upload_file(file_path: str, ttl_minutes: int, token: str):
    headers = {'Authorization': f'Bearer {token}'}
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {'ttl': ttl_minutes * 60}  # Конвертируем минуты в секунды
        response = requests.post('http://localhost:3000/api/v1/files',
                               files=files, data=data, headers=headers)
    return response.json()

# Получение информации о файле
def get_file_info(file_id: str, token: str):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f'http://localhost:3000/api/v1/files/{file_id}', headers=headers)
    return response.json()

# Скачивание файла
def download_file(file_id: str, save_path: str, token: str):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f'http://localhost:3000/api/v1/files/{file_id}/download', headers=headers)
    with open(save_path, 'wb') as f:
        f.write(response.content)
```

### cURL

```bash
# Загрузка файла
curl -H "Authorization: Bearer your-secret-token" \
  -X POST http://localhost:3000/api/v1/files \
  -F "file=@document.pdf" \
  -F "ttlMinutes=60"

# Получение информации
curl -H "Authorization: Bearer your-secret-token" \
  http://localhost:3000/api/v1/files/550e8400-e29b-41d4-a716-446655440000

# Скачивание файла
curl -H "Authorization: Bearer your-secret-token" \
  -O http://localhost:3000/api/v1/files/550e8400-e29b-41d4-a716-446655440000/download

# Удаление файла
curl -H "Authorization: Bearer your-secret-token" \
  -X DELETE http://localhost:3000/api/v1/files/550e8400-e29b-41d4-a716-446655440000

# Проверка состояния
curl http://localhost:3000/api/v1/health
```

## Ограничения и рекомендации

### Ограничения

- Максимальный размер файла: 100MB (настраивается через `MAX_FILE_SIZE_MB`)
- Максимальное количество файлов: 10000 (настраивается через `MAX_FILES_COUNT`)
- Максимальный размер хранилища: 1000MB (настраивается через `MAX_STORAGE_SIZE_MB`)
- Максимальный TTL: 7 дней (настраивается через `MAX_TTL_MIN`)
- Обязательный TTL: При загрузке файла обязательно указывать время жизни

### Рекомендации

- Используйте разумные значения TTL для экономии места
- Регулярно проверяйте состояние сервиса через `/api/health`
- Обрабатывайте ошибки и повторяйте запросы при необходимости
- Используйте HTTPS в продакшене

## Версионирование API

Текущая версия API: `v1`

## 📚 Дополнительные ресурсы

- **[Быстрый старт](QUICK_START.md)** - пошаговое руководство по установке
- **[Примеры использования](USAGE_EXAMPLES.md)** - подробные примеры на разных языках
- **[Быстрые примеры](QUICK_EXAMPLES.md)** - примеры основных операций
- **[Настройка переменных окружения](ENV_SETUP.md)** - конфигурация сервиса
- **[Архитектура системы](architecture.md)** - техническая архитектура
