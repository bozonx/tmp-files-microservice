# Руководство по разработке micro-file-cache

## Обзор микросервиса

`micro-file-cache` - это микросервис для временного кэширования файлов с автоматической очисткой по истечении времени жизни (TTL). Сервис позволяет загружать файлы, указывать время их хранения в минутах, и автоматически удаляет устаревшие файлы.

## Технический стек

- **Node.js** - среда выполнения
- **TypeScript** - язык программирования
- **NestJS** - фреймворк для создания масштабируемых серверных приложений
- **Fastify** - HTTP адаптер (вместо Express по умолчанию)
- **Jest** - фреймворк для тестирования
- **Multer** - middleware для загрузки файлов
- **@nestjs/schedule** - для периодических задач (cron jobs)
- **crypto** - встроенный модуль Node.js для хеширования

### Дополнительные пакеты для упрощения разработки

- **fs-extra** - расширенная версия fs с промисами и дополнительными методами
- **file-type** - для надежного определения MIME типа файла по содержимому
- **dayjs** - легковесная библиотека для работы с датами
- **supertest** - для HTTP тестирования API endpoints

## Архитектура микросервиса

### Основные компоненты

1. **FilesModule** - основной модуль для работы с файлами
2. **StorageModule** - модуль для работы с файловой системой
3. **CleanupModule** - модуль для автоматической очистки устаревших файлов

### Структура проекта

```
micro-file-cache/
├── src/
│   ├── main.ts                    # Точка входа приложения
│   ├── app.module.ts              # Корневой модуль
│   ├── modules/
│   │   ├── files/                 # Модуль работы с файлами
│   │   │   ├── files.module.ts
│   │   │   ├── files.controller.ts
│   │   │   ├── files.service.ts
│   │   │   └── dto/
│   │   │       ├── upload-file.dto.ts
│   │   │       └── file-response.dto.ts
│   │   ├── storage/               # Модуль файлового хранилища
│   │   │   ├── storage.module.ts
│   │   │   └── storage.service.ts
│   │   └── cleanup/               # Модуль очистки
│   │       ├── cleanup.module.ts
│   │       └── cleanup.service.ts
│   ├── common/
│   │   ├── interfaces/
│   │   │   ├── file.interface.ts
│   │   │   └── storage.interface.ts
│   │   └── utils/
│   │       ├── hash.util.ts
│   │       └── file.util.ts
│   └── config/
│       └── app.config.ts
├── test/                          # Тесты
├── docs/                          # Документация
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

## API Endpoints

### REST API

- `POST /api/v1/files` - загрузка файла с указанием TTL
- `GET /api/v1/files/:id` - получение информации о файле
- `GET /api/v1/files/:id/download` - скачивание файла
- `DELETE /api/v1/files/:id` - удаление файла
- `GET /api/v1/health` - проверка состояния сервиса

## Модели данных

### Интерфейс File

```typescript
interface FileInfo {
  id: string; // UUID файла
  originalName: string; // Оригинальное имя файла
  hash: string; // SHA-256 хеш файла
  size: number; // Размер файла в байтах
  mimeType: string; // MIME тип файла
  uploadedAt: string; // ISO-8601 дата загрузки
  expiresAt: string; // ISO-8601 дата истечения
  ttlMinutes: number; // TTL в минутах
  path: string; // Относительный путь в хранилище
}
```

### Формат data.json

```json
{
  "files": {
    "file-uuid-1": {
      "id": "file-uuid-1",
      "originalName": "example.pdf",
      "hash": "sha256-hash-string",
      "size": 1024,
      "mimeType": "application/pdf",
      "uploadedAt": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2024-01-15T11:30:00.000Z",
      "ttlMinutes": 60,
      "path": "2024-01/example-pdf-uuid-1.pdf"
    }
  }
}
```

## Логика работы с файлами

### Загрузка файла

1. Получение файла через Multer
2. Вычисление SHA-256 хеша файла
3. Проверка существования файла с таким хешем
4. Если файл существует:
   - Обновление TTL существующего файла
   - Возврат информации о существующем файле
5. Если файл новый:
   - Генерация уникального UUID
   - Сохранение файла в хранилище
   - Запись метаданных в data.json
   - Возврат информации о новом файле

### Дедупликация

Система использует SHA-256 хеширование для предотвращения дублирования файлов:

```typescript
import { createHash } from 'crypto';

function calculateFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
```

### Определение MIME типа файла

Для безопасного определения типа файла используется пакет `file-type`:

```typescript
import { fileTypeFromBuffer } from "file-type";

async function getFileMimeType(buffer: Buffer): Promise<string> {
  const type = await fileTypeFromBuffer(buffer);
  return type?.mime || "application/octet-stream";
}

// Использование в сервисе
async uploadFile(file: Express.Multer.File, ttlMinutes: number) {
  const buffer = file.buffer;
  const mimeType = await getFileMimeType(buffer);

  // Валидация MIME типа (если заданы ограничения)
  const allowedMimeTypes = this.configService.get<string[]>('ALLOWED_MIME_TYPES', []);
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(mimeType)) {
    throw new BadRequestException(`MIME type ${mimeType} is not allowed`);
  }

  // ... остальная логика
}
```

### Валидация MIME типов

Система поддерживает гибкую настройку разрешенных MIME типов через переменную окружения `ALLOWED_MIME_TYPES`:

#### Логика работы:

- **Пустая переменная или не задана** - разрешены все MIME типы
- **Задан массив типов** - разрешены только указанные типы

#### Примеры конфигурации:

```env
# Разрешить все типы (по умолчанию)
ALLOWED_MIME_TYPES=

# Только изображения
ALLOWED_MIME_TYPES=["image/jpeg","image/png","image/gif","image/webp"]

# Только документы
ALLOWED_MIME_TYPES=["application/pdf","text/plain","application/json","text/csv"]
```

#### Валидация в коде:

```typescript
// В ValidationUtil
static validateUploadedFile(file: UploadedFile, allowedMimeTypes: string[] = []): ValidationResult {
  // ... другие проверки ...

  // Проверяем MIME тип (только если заданы ограничения)
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
    errors.push(`MIME type '${file.mimetype}' is not allowed`);
  }

  return { isValid: errors.length === 0, errors };
}
```

### Работа с файловой системой

Для упрощения работы с файлами используется пакет `fs-extra`:

```typescript
import * as fs from 'fs-extra';
import * as path from 'path';

export class StorageService {
  async saveFile(buffer: Buffer, originalName: string, uuid: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Создание директории в формате YYYY-MM
    const dir = path.join(this.storageDir, `${year}-${month}`);

    // Автоматически создает директории если их нет
    await fs.ensureDir(dir);

    // Создание безопасного имени файла
    const shortName = this.createShortFilename(originalName);
    const extension = path.extname(originalName);
    const filename = `${shortName}-${uuid}${extension}`;

    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);

    return path.relative(this.storageDir, filePath);
  }

  // Создание короткого имени файла (до 30 символов)
  private createShortFilename(originalName: string): string {
    const nameWithoutExt = path.parse(originalName).name;

    // Замена неправильных символов на _
    const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9\-_]/g, '_');

    // Обрезка до 30 символов
    return sanitized.substring(0, 30);
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.storageDir, filePath);

    // Безопасное удаление - не выбросит ошибку если файл не существует
    await fs.remove(fullPath);
  }

  async getFile(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.storageDir, filePath);

    // Проверяет существование файла перед чтением
    if (!(await fs.pathExists(fullPath))) {
      throw new NotFoundException('File not found');
    }

    return await fs.readFile(fullPath);
  }
}
```

### Работа с датами

Для удобной работы с датами используется пакет `dayjs`:

```typescript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import duration from 'dayjs/plugin/duration';

dayjs.extend(utc);
dayjs.extend(duration);

export class FileService {
  calculateExpirationDate(ttlMinutes: number): string {
    return dayjs().add(ttlMinutes, 'minute').utc().toISOString();
  }

  isFileExpired(expiresAt: string): boolean {
    return dayjs().utc().isAfter(dayjs(expiresAt).utc());
  }

  getRemainingMinutes(expiresAt: string): number {
    const now = dayjs().utc();
    const expiration = dayjs(expiresAt).utc();

    if (now.isAfter(expiration)) {
      return 0;
    }

    return expiration.diff(now, 'minute');
  }

  formatDuration(minutes: number): string {
    const duration = dayjs.duration(minutes, 'minute');

    if (duration.asDays() >= 1) {
      return `${Math.floor(duration.asDays())}d ${duration.hours()}h`;
    } else if (duration.asHours() >= 1) {
      return `${duration.hours()}h ${duration.minutes()}m`;
    } else {
      return `${duration.minutes()}m`;
    }
  }
}
```

### Автоматическая очистка

Каждую минуту выполняется проверка файлов на истечение TTL:

1. Чтение data.json
2. Поиск файлов с `expiresAt < currentTime`
3. Удаление файлов из файловой системы
4. Удаление записей из data.json
5. Логирование удаленных файлов

## Переменные окружения

```bash
# Основные настройки
NODE_ENV=development
LISTEN_HOST=localhost
LISTEN_PORT=3000

# Аутентификация
AUTH_ENABLED=true
AUTH_TOKEN=your-secret-key-change-in-production

# Пути к хранилищу
STORAGE_DIR=/app/storage                    # Продакшн
# STORAGE_DIR=../test-data/micro-file-cache/storage  # Разработка

DATA_DIR=/app/data                          # Продакшн
# DATA_DIR=../test-data/micro-file-cache/data        # Разработка

# Настройки загрузки файлов
MAX_FILE_SIZE_MB=100                        # Максимальный размер файла в мегабайтах
MAX_TTL_MIN=10080                           # Максимальный TTL в минутах (по умолчанию 7 дней)

# Настройки очистки
CLEANUP_CRON=0 */10 * * * *                # каждые 10 минут
```

## Разработка с помощью AI в Cursor

### Рекомендуемый подход

1. **Начните с создания базовой структуры проекта**
   - Создайте package.json с необходимыми зависимостями
   - Настройте TypeScript конфигурацию
   - Создайте базовую структуру папок

2. **Реализуйте модули поэтапно**
   - Сначала StorageModule (базовая работа с файлами)
   - Затем FilesModule (API endpoints)
   - В конце CleanupModule (автоматическая очистка)

3. **Используйте AI для генерации кода**
   - Запрашивайте создание конкретных файлов
   - Просите объяснения сложных частей
   - Используйте AI для написания тестов

### Примеры запросов к AI

```
"Создай FilesController с методами для загрузки, получения и удаления файлов"
"Напиши StorageService для работы с файловой системой и data.json"
"Создай CleanupService с cron job для удаления устаревших файлов"
"Напиши unit тесты для FilesService"
```

## Тестирование

### Структура тестов

```
test/
├── unit/                    # Unit тесты
│   ├── files.service.spec.ts
│   ├── storage.service.spec.ts
│   └── cleanup.service.spec.ts
├── integration/             # Интеграционные тесты
│   ├── files.controller.spec.ts
│   └── app.e2e-spec.ts
└── fixtures/                # Тестовые данные
    └── test-files/
```

### Примеры тестов

#### Unit тесты

```typescript
// files.service.spec.ts
describe('FilesService', () => {
  let service: FilesService;
  let storageService: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: StorageService,
          useValue: {
            saveFile: jest.fn(),
            getFile: jest.fn(),
            deleteFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    storageService = module.get<StorageService>(StorageService);
  });

  it('should upload file successfully', async () => {
    // Тест загрузки файла
  });

  it('should handle duplicate files', async () => {
    // Тест дедупликации
  });
});
```

#### E2E тесты с supertest

```typescript
// files.controller.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('FilesController (e2e)', () => {
  let app: INestApplication;
  const authToken = 'test-token';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/files', () => {
    it('should upload file successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test content'), 'test.txt')
        .field('ttlMinutes', '60')
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.data.originalName).toBe('test.txt');
          expect(res.body.data.ttlMinutes).toBe(60);
        });
    });

    it('should reject file without auth token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/files')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .field('ttlMinutes', '60')
        .expect(401);
    });

    it('should reject file that is too large', () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      return request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', largeBuffer, 'large.txt')
        .field('ttlMinutes', '60')
        .expect(413);
    });

    it('should reject invalid TTL', () => {
      return request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test content'), 'test.txt')
        .field('ttlMinutes', '0')
        .expect(400);
    });
  });

  describe('GET /api/v1/files/:id', () => {
    let fileId: string;

    beforeEach(async () => {
      // Загружаем файл для тестов
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test content'), 'test.txt')
        .field('ttlMinutes', '60');

      fileId = response.body.data.id;
    });

    it('should return file info', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe(fileId);
          expect(res.body.data.originalName).toBe('test.txt');
        });
    });

    it('should return 404 for non-existent file', () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      return request(app.getHttpServer())
        .get(`/api/v1/files/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/files/:id/download', () => {
    let fileId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test download content'), 'download.txt')
        .field('ttlMinutes', '60');

      fileId = response.body.data.id;
    });

    it('should download file', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/files/${fileId}/download`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect('Content-Type', /text\/plain/)
        .expect('Content-Disposition', /attachment/)
        .expect((res) => {
          expect(res.text).toBe('test download content');
        });
    });
  });

  describe('DELETE /api/v1/files/:id', () => {
    let fileId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/files')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test content'), 'delete.txt')
        .field('ttlMinutes', '60');

      fileId = response.body.data.id;
    });

    it('should delete file', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe(fileId);
        });
    });

    it('should return 404 when deleting non-existent file', () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      return request(app.getHttpServer())
        .delete(`/api/v1/files/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.status).toBe('healthy');
          expect(res.body.data).toHaveProperty('uptime');
          expect(res.body.data).toHaveProperty('storage');
          expect(res.body.data).toHaveProperty('cleanup');
        });
    });
  });
});
```

## Рекомендации по разработке

### 1. Обработка ошибок

- Используйте встроенные HTTP исключения NestJS
- Логируйте все ошибки с контекстом
- Возвращайте понятные сообщения об ошибках
- Реализуйте Bearer токен аутентификацию
- Валидируйте токены на всех защищенных endpoints

### 2. Валидация

- Используйте class-validator для DTO
- Проверяйте размер и тип файлов
- Валидируйте TTL (минимум 1 минута, максимум 7 дней)

### 3. Производительность

- Используйте стримы для больших файлов
- Кэшируйте метаданные в памяти
- Оптимизируйте операции с файловой системой

### 4. Безопасность

- Ограничивайте размер загружаемых файлов
- Проверяйте MIME типы
- Используйте безопасные имена файлов
- Валидируйте все входные данные
- Реализуйте Bearer токен аутентификацию
- Защищайте все API endpoints (кроме /api/v1/health)

## Развертывание

### Docker

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  micro-file-cache:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - STORAGE_DIR=/app/storage
      - DATA_DIR=/app/data
    volumes:
      - file-storage:/app/storage
      - file-data:/app/data

volumes:
  file-storage:
  file-data:
```

## Мониторинг и логирование

### Логирование

- Используйте встроенный Logger NestJS
- Логируйте все операции с файлами
- Добавьте метрики производительности

### Health Check

```typescript
@Get('health')
getHealth() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}
```

## Следующие шаги

1. Создайте базовую структуру проекта
2. Настройте package.json и зависимости
3. Реализуйте StorageModule
4. Создайте FilesModule с API endpoints
5. Добавьте CleanupModule с cron job
6. Напишите тесты
7. Создайте Dockerfile и docker-compose.yml
8. Настройте CI/CD pipeline
