# ⚡ Быстрые примеры использования

Коллекция готовых примеров для быстрого старта с micro-file-cache.

## 🚀 Запуск сервиса

```bash
# Установка зависимостей
pnpm install

# Запуск в режиме разработки
pnpm run start:dev

# Или через Docker
docker-compose up -d
```

## 🏥 Проверка работоспособности

```bash
# Health check (не требует аутентификации)
curl http://localhost:3000/api/v1/health
```

**Ожидаемый ответ:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 123,
    "version": "1.0.1"
  }
}
```

## 📤 Загрузка файла

```bash
# Загрузка файла с TTL 1 час
curl -H "Authorization: Bearer dev-secret-key-for-micro-file-cache-12345678901234567890" \
  -X POST http://localhost:3000/api/v1/files \
  -F "file=@document.pdf" \
  -F "ttlMinutes=60"
```

**Ответ:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "http://localhost:3000/api/v1/files/550e8400-e29b-41d4-a716-446655440000/download",
    "originalName": "document.pdf",
    "size": 1024000,
    "mimeType": "application/pdf",
    "ttlMinutes": 60
  }
}
```

## 📥 Скачивание файла

```bash
# Скачивание файла по ID
curl -H "Authorization: Bearer dev-secret-key-for-micro-file-cache-12345678901234567890" \
  -X GET http://localhost:3000/api/v1/files/FILE_ID/download \
  -O downloaded_file.pdf
```

## 💻 JavaScript/TypeScript

### Базовый пример

```javascript
// Загрузка файла
async function uploadFile(file, ttlMinutes = 60) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ttlMinutes', ttlMinutes.toString());

  const response = await fetch('/api/v1/files', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer dev-secret-key-for-micro-file-cache-12345678901234567890',
    },
    body: formData,
  });

  return response.json();
}

// Использование
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];
uploadFile(file, 60).then((result) => {
  console.log('File uploaded:', result.data.id);
});
```

### React Hook

```typescript
import { useState } from 'react';

function useFileCache() {
  const [loading, setLoading] = useState(false);

  const uploadFile = async (file: File, ttlMinutes: number) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ttlMinutes', ttlMinutes.toString());

      const response = await fetch('/api/v1/files', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer dev-secret-key-for-micro-file-cache-12345678901234567890',
        },
        body: formData,
      });

      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  return { uploadFile, loading };
}
```

## 🐍 Python

### Синхронный клиент

```python
import requests

def upload_file(file_path, ttl_minutes=10080):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {'ttl': ttl_minutes * 60}  # Конвертируем минуты в секунды
        headers = {'Authorization': 'Bearer dev-secret-key-for-micro-file-cache-12345678901234567890'}

        response = requests.post(
            'http://localhost:3000/api/v1/files',
            files=files, data=data, headers=headers
        )
    return response.json()

# Использование
result = upload_file('document.pdf', 60)
print(f"File ID: {result['data']['id']}")
```

### Асинхронный клиент

```python
import aiohttp
import aiofiles

async def upload_file_async(file_path, ttl_minutes=10080):
    data = aiohttp.FormData()
    data.add_field('ttl', str(ttl_minutes * 60))  # Конвертируем минуты в секунды

    async with aiofiles.open(file_path, 'rb') as f:
        file_content = await f.read()
        data.add_field('file', file_content, filename=file_path)

    async with aiohttp.ClientSession() as session:
        async with session.post(
            'http://localhost:3000/api/v1/files',
            data=data,
            headers={'Authorization': 'Bearer dev-secret-key-for-micro-file-cache-12345678901234567890'}
        ) as response:
            return await response.json()
```

## 🔧 Настройка аутентификации

### Включение аутентификации

```bash
# В .env файле
AUTH_ENABLED=true
AUTH_TOKEN=your-secret-key-change-in-production
```

### Отключение аутентификации

```bash
# В .env файле
AUTH_ENABLED=false
```

## 🐳 Docker

### Быстрый запуск

```bash
# Запуск с Docker Compose
docker-compose up -d

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f micro-file-cache
```

### Тестирование в Docker

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Загрузка файла
curl -X POST \
  -H "Authorization: Bearer production-secret-key-change-this-12345678901234567890" \
  -F "file=@test-file.txt" \
  -F "ttlMinutes=60" \
  http://localhost:3000/api/v1/files
```

## 📋 Полный цикл работы

```bash
# 1. Создайте тестовый файл
echo "Hello, micro-file-cache!" > test.txt

# 2. Загрузите файл
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer dev-secret-key-for-micro-file-cache-12345678901234567890" \
  -F "file=@test.txt" \
  -F "ttlMinutes=60" \
  http://localhost:3000/api/v1/files)

# 3. Извлеките ID файла
FILE_ID=$(echo $RESPONSE | jq -r '.data.id')
echo "File ID: $FILE_ID"

# 4. Получите информацию о файле
curl -H "Authorization: Bearer dev-secret-key-for-micro-file-cache-12345678901234567890" \
  http://localhost:3000/api/v1/files/$FILE_ID

# 5. Скачайте файл
curl -H "Authorization: Bearer dev-secret-key-for-micro-file-cache-12345678901234567890" \
  -O http://localhost:3000/api/v1/files/$FILE_ID/download

# 6. Удалите файл
curl -X DELETE \
  -H "Authorization: Bearer dev-secret-key-for-micro-file-cache-12345678901234567890" \
  http://localhost:3000/api/v1/files/$FILE_ID
```

## 📚 Дополнительные ресурсы

- **[Подробные примеры](USAGE_EXAMPLES.md)** - полные примеры на разных языках
- **[API Спецификация](api-specification.md)** - полное описание API
- **[Быстрый старт](QUICK_START.md)** - пошаговое руководство по установке

---

**Готово!** Теперь вы знаете основы работы с micro-file-cache. 🎉
