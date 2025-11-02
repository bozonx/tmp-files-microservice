# Примеры использования micro-file-cache

Этот документ содержит практические примеры использования API микросервиса micro-file-cache.

## Содержание

- [JavaScript/TypeScript](#javascripttypescript)
- [Python](#python)
- [cURL](#curl)
- [Postman](#postman)
- [Интеграция с другими сервисами](#интеграция-с-другими-сервисами)

## JavaScript/TypeScript

### Базовый клиент

```typescript
class FileCacheClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Загрузка файла
  async uploadFile(file: File, ttlMinutes: number): Promise<FileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ttlMinutes', ttlMinutes.toString());

    return this.request<FileResponse>('/files', {
      method: 'POST',
      body: formData,
    });
  }

  // Получение информации о файле
  async getFileInfo(id: string): Promise<FileResponse> {
    return this.request<FileResponse>(`/files/${id}`);
  }

  // Скачивание файла
  async downloadFile(id: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/v1/files/${id}/download`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.blob();
  }

  // Удаление файла
  async deleteFile(id: string): Promise<void> {
    await this.request(`/files/${id}`, {
      method: 'DELETE',
    });
  }

  // Проверка состояния сервиса
  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/health`);
    return response.json();
  }
}

// Использование
const client = new FileCacheClient('http://localhost:3000', 'your-token');

// Загрузка файла
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const file = fileInput.files[0];
const ttlMinutes = 60; // 1 час

try {
  const result = await client.uploadFile(file, ttlMinutes);
  console.log('File uploaded:', result);

  // Скачивание файла
  const blob = await client.downloadFile(result.data.id);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = result.data.originalName;
  link.click();

  URL.revokeObjectURL(url);
} catch (error) {
  console.error('Error:', error);
}
```

### React Hook

```typescript
import { useState, useCallback } from 'react';

interface UseFileCacheOptions {
  baseUrl: string;
  token: string;
}

export function useFileCache({ baseUrl, token }: UseFileCacheOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File, ttlMinutes: number) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ttlMinutes', ttlMinutes.toString());

      const response = await fetch(`${baseUrl}/api/v1/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [baseUrl, token]);

  const downloadFile = useCallback(async (id: string, filename: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/files/${id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [baseUrl, token]);

  return {
    uploadFile,
    downloadFile,
    loading,
    error,
  };
}

// Использование в компоненте
function FileUploadComponent() {
  const { uploadFile, downloadFile, loading, error } = useFileCache({
    baseUrl: 'http://localhost:3000',
    token: 'your-token',
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadFile(file, 60); // 1 час
      console.log('File uploaded:', result);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileUpload} disabled={loading} />
      {loading && <p>Uploading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
}
```

## Python

### Базовый клиент

```python
import requests
import json
from typing import Optional, Dict, Any
from pathlib import Path

class FileCacheClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {token}'
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[Any, Any]:
        url = f"{self.base_url}/api/v1{endpoint}"
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()

        if response.headers.get('content-type', '').startswith('application/json'):
            return response.json()
        return response

    def upload_file(self, file_path: str, ttl_minutes: int) -> Dict[Any, Any]:
        """Загрузка файла в кэш"""
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'ttl': ttl_minutes * 60}  # Конвертируем минуты в секунды
            return self._request('POST', '/files', files=files, data=data)

    def get_file_info(self, file_id: str) -> Dict[Any, Any]:
        """Получение информации о файле"""
        return self._request('GET', f'/files/{file_id}')

    def download_file(self, file_id: str, save_path: Optional[str] = None) -> str:
        """Скачивание файла"""
        response = self._request('GET', f'/files/{file_id}/download')

        if save_path is None:
            # Получаем имя файла из заголовков или используем ID
            content_disposition = response.headers.get('content-disposition', '')
            if 'filename=' in content_disposition:
                filename = content_disposition.split('filename=')[1].strip('"')
            else:
                filename = f"{file_id}.bin"
            save_path = filename

        with open(save_path, 'wb') as f:
            f.write(response.content)

        return save_path

    def delete_file(self, file_id: str) -> None:
        """Удаление файла"""
        self._request('DELETE', f'/files/{file_id}')

    def get_health(self) -> Dict[Any, Any]:
        """Проверка состояния сервиса"""
        response = requests.get(f"{self.base_url}/api/v1/health")
        response.raise_for_status()
        return response.json()

# Использование
client = FileCacheClient('http://localhost:3000', 'your-token')

# Загрузка файла
try:
    result = client.upload_file('document.pdf', 60)  # 1 час
    print(f"File uploaded: {result['data']['id']}")

    # Скачивание файла
    downloaded_path = client.download_file(result['data']['id'], 'downloaded_document.pdf')
    print(f"File downloaded to: {downloaded_path}")

    # Удаление файла
    client.delete_file(result['data']['id'])
    print("File deleted")

except requests.exceptions.RequestException as e:
    print(f"Error: {e}")
```

### Асинхронный клиент с aiohttp

```python
import aiohttp
import aiofiles
import asyncio
from typing import Optional, Dict, Any

class AsyncFileCacheClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip('/')
        self.token = token

    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[Any, Any]:
        url = f"{self.base_url}/api/v1{endpoint}"
        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f'Bearer {self.token}'

        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, headers=headers, **kwargs) as response:
                response.raise_for_status()

                if response.headers.get('content-type', '').startswith('application/json'):
                    return await response.json()
                return await response.read()

    async def upload_file(self, file_path: str, ttl_minutes: int) -> Dict[Any, Any]:
        """Асинхронная загрузка файла"""
        data = aiohttp.FormData()
        data.add_field('ttl', str(ttl_minutes * 60))  # Конвертируем минуты в секунды

        async with aiofiles.open(file_path, 'rb') as f:
            file_content = await f.read()
            data.add_field('file', file_content, filename=Path(file_path).name)

        return await self._request('POST', '/files', data=data)

    async def download_file(self, file_id: str, save_path: str) -> str:
        """Асинхронное скачивание файла"""
        content = await self._request('GET', f'/files/{file_id}/download')

        async with aiofiles.open(save_path, 'wb') as f:
            await f.write(content)

        return save_path

# Использование
async def main():
    client = AsyncFileCacheClient('http://localhost:3000', 'your-token')

    try:
        # Загрузка файла
        result = await client.upload_file('document.pdf', 60)
        print(f"File uploaded: {result['data']['id']}")

        # Скачивание файла
        await client.download_file(result['data']['id'], 'downloaded_document.pdf')
        print("File downloaded")

    except Exception as e:
        print(f"Error: {e}")

# Запуск
asyncio.run(main())
```

## cURL

### Базовые команды

```bash
# Настройка переменных
BASE_URL="http://localhost:3000"
TOKEN="your-secret-token"

# Проверка состояния сервиса (не требует аутентификации)
curl -X GET "${BASE_URL}/api/v1/health" | jq

# Загрузка файла
curl -H "Authorization: Bearer ${TOKEN}" \
  -X POST "${BASE_URL}/api/v1/files" \
  -F "file=@document.pdf" \
  -F "ttlMinutes=60" | jq

# Получение информации о файле
FILE_ID="550e8400-e29b-41d4-a716-446655440000"
curl -H "Authorization: Bearer ${TOKEN}" \
  -X GET "${BASE_URL}/api/v1/files/${FILE_ID}" | jq

# Скачивание файла
curl -H "Authorization: Bearer ${TOKEN}" \
  -X GET "${BASE_URL}/api/v1/files/${FILE_ID}/download" \
  -O "downloaded_document.pdf"

# Удаление файла
curl -H "Authorization: Bearer ${TOKEN}" \
  -X DELETE "${BASE_URL}/api/v1/files/${FILE_ID}" | jq
```

### Скрипт для автоматизации

```bash
#!/bin/bash

# Конфигурация
BASE_URL="http://localhost:3000"
TOKEN="your-secret-token"
TEMP_DIR="/tmp/file-cache-examples"

# Создание временной директории
mkdir -p "$TEMP_DIR"

# Функция для загрузки файла
upload_file() {
    local file_path="$1"
    local ttl_minutes="${2:-10080}"

    echo "Uploading file: $file_path"
    response=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
        -X POST "${BASE_URL}/api/v1/files" \
        -F "file=@${file_path}" \
        -F "ttl=$((ttl_minutes * 60))")  # Конвертируем минуты в секунды

    if [ $? -eq 0 ]; then
        file_id=$(echo "$response" | jq -r '.data.id')
        echo "File uploaded successfully. ID: $file_id"
        echo "$file_id" > "$TEMP_DIR/last_uploaded_id"
    else
        echo "Upload failed"
        return 1
    fi
}

# Функция для скачивания файла
download_file() {
    local file_id="$1"
    local output_path="$2"

    echo "Downloading file: $file_id"
    curl -s -H "Authorization: Bearer ${TOKEN}" \
        -X GET "${BASE_URL}/api/v1/files/${file_id}/download" \
        -o "$output_path"

    if [ $? -eq 0 ]; then
        echo "File downloaded to: $output_path"
    else
        echo "Download failed"
        return 1
    fi
}

# Функция для получения информации о файле
get_file_info() {
    local file_id="$1"

    echo "Getting file info: $file_id"
    curl -s -H "Authorization: Bearer ${TOKEN}" \
        -X GET "${BASE_URL}/api/v1/files/${file_id}" | jq
}

# Функция для удаления файла
delete_file() {
    local file_id="$1"

    echo "Deleting file: $file_id"
    curl -s -H "Authorization: Bearer ${TOKEN}" \
        -X DELETE "${BASE_URL}/api/v1/files/${file_id}" | jq
}

# Пример использования
echo "=== File Cache API Examples ==="

# Проверка состояния сервиса
echo "1. Checking service health..."
curl -s -X GET "${BASE_URL}/api/v1/health" | jq '.data.status'

# Создание тестового файла
echo "2. Creating test file..."
echo "This is a test file content" > "$TEMP_DIR/test.txt"

# Загрузка файла
echo "3. Uploading test file..."
upload_file "$TEMP_DIR/test.txt" 30

# Получение ID загруженного файла
if [ -f "$TEMP_DIR/last_uploaded_id" ]; then
    file_id=$(cat "$TEMP_DIR/last_uploaded_id")

    # Получение информации о файле
    echo "4. Getting file info..."
    get_file_info "$file_id"

    # Скачивание файла
    echo "5. Downloading file..."
    download_file "$file_id" "$TEMP_DIR/downloaded_test.txt"

    # Удаление файла
    echo "6. Deleting file..."
    delete_file "$file_id"
fi

# Очистка
echo "7. Cleaning up..."
rm -rf "$TEMP_DIR"

echo "=== Examples completed ==="
```

## Postman

### Коллекция Postman

Создайте коллекцию с следующими запросами:

#### 1. Health Check

- **Method**: GET
- **URL**: `{{baseUrl}}/api/v1/health`
- **Headers**: (нет)

#### 2. Upload File

- **Method**: POST
- **URL**: `{{baseUrl}}/api/v1/files`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
- **Body**: form-data
  - `file`: (выберите файл)
  - `ttlMinutes`: `60`

#### 3. Get File Info

- **Method**: GET
- **URL**: `{{baseUrl}}/api/v1/files/{{fileId}}`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`

#### 4. Download File

- **Method**: GET
- **URL**: `{{baseUrl}}/api/v1/files/{{fileId}}/download`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`

#### 5. Delete File

- **Method**: DELETE
- **URL**: `{{baseUrl}}/api/v1/files/{{fileId}}`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`

### Переменные окружения

Создайте переменные окружения в Postman:

```json
{
  "baseUrl": "http://localhost:3000",
  "token": "your-secret-token",
  "fileId": ""
}
```

### Pre-request Script для автоматического извлечения fileId

Добавьте в запрос "Get File Info" следующий pre-request script:

```javascript
// Извлекаем fileId из предыдущего ответа загрузки
if (pm.response && pm.response.json() && pm.response.json().data) {
  pm.environment.set('fileId', pm.response.json().data.id);
}
```

## Интеграция с другими сервисами

### Node.js Express сервер

```javascript
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Конфигурация
const FILE_CACHE_URL = 'http://localhost:3000';
const FILE_CACHE_TOKEN = 'your-secret-token';

// Прокси для загрузки файлов в кэш
app.post('/proxy/upload', upload.single('file'), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path));
    formData.append('ttlMinutes', req.body.ttlMinutes || '60');

    const response = await axios.post(`${FILE_CACHE_URL}/api/v1/files`, formData, {
      headers: {
        Authorization: `Bearer ${FILE_CACHE_TOKEN}`,
        ...formData.getHeaders(),
      },
    });

    // Очистка временного файла
    fs.unlinkSync(req.file.path);

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Прокси для скачивания файлов из кэша
app.get('/proxy/download/:fileId', async (req, res) => {
  try {
    const response = await axios.get(
      `${FILE_CACHE_URL}/api/v1/files/${req.params.fileId}/download`,
      {
        headers: {
          Authorization: `Bearer ${FILE_CACHE_TOKEN}`,
        },
        responseType: 'stream',
      },
    );

    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Proxy server running on port 3001');
});
```

### Python Flask сервер

```python
from flask import Flask, request, jsonify, send_file
import requests
import io
import os

app = Flask(__name__)

# Конфигурация
FILE_CACHE_URL = 'http://localhost:3000'
FILE_CACHE_TOKEN = 'your-secret-token'

@app.route('/proxy/upload', methods=['POST'])
def proxy_upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    ttl_seconds = request.form.get('ttl', 3600)  # По умолчанию 1 час

    try:
        # Подготовка данных для загрузки
        files = {'file': (file.filename, file.stream, file.content_type)}
        data = {'ttl': ttl_seconds}
        headers = {'Authorization': f'Bearer {FILE_CACHE_TOKEN}'}

        # Загрузка в кэш
        response = requests.post(
            f'{FILE_CACHE_URL}/api/v1/files',
            files=files,
            data=data,
            headers=headers
        )
        response.raise_for_status()

        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/proxy/download/<file_id>')
def proxy_download(file_id):
    try:
        headers = {'Authorization': f'Bearer {FILE_CACHE_TOKEN}'}
        response = requests.get(
            f'{FILE_CACHE_URL}/api/v1/files/{file_id}/download',
            headers=headers,
            stream=True
        )
        response.raise_for_status()

        # Создание файлового объекта в памяти
        file_obj = io.BytesIO(response.content)

        return send_file(
            file_obj,
            as_attachment=True,
            download_name=f'file_{file_id}',
            mimetype=response.headers.get('content-type', 'application/octet-stream')
        )
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

### Docker Compose интеграция

```yaml
version: '3.8'

services:
  micro-file-cache:
    build: .
    ports:
      - '3000:80'
    environment:
      - NODE_ENV=production
      - AUTH_ENABLED=true
      - AUTH_TOKEN=your-production-secret-key-minimum-32-chars
      - STORAGE_DIR=/app/storage
    volumes:
      - file-storage:/app/storage
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:80/api/v1/health']
      interval: 30s
      timeout: 10s
      retries: 3

  web-app:
    build: ./web-app
    ports:
      - '8080:8080'
    environment:
      - FILE_CACHE_URL=http://micro-file-cache:80
      - FILE_CACHE_TOKEN=your-production-secret-key
    depends_on:
      - micro-file-cache

volumes:
  file-storage:
```

## Заключение

Эти примеры демонстрируют различные способы интеграции с микросервисом micro-file-cache. Выберите подходящий подход в зависимости от ваших потребностей и технологического стека.

Для получения дополнительной информации см.:

- [API документацию](api-specification.md)
- [Руководство по быстрому старту](QUICK_START.md)
- [Настройка переменных окружения](ENV_SETUP.md)
- [Быстрые примеры](QUICK_EXAMPLES.md)
