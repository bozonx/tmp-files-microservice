# Настройка переменных окружения

Этот документ описывает настройку переменных окружения для микросервиса `micro-stt`.

## Обзор

Проект поддерживает различные файлы конфигурации для разных окружений:

- `.env.development` — для разработки (development)
- `.env.production` — для production окружения
- `.env.test` — для тестов
- `.env` — базовая конфигурация (fallback)

## Как это работает

При запуске приложения `ConfigModule` загружает файлы в следующем порядке:

1. `.env.${NODE_ENV}` (например, `.env.production` если `NODE_ENV=production`)
2. `.env` (как fallback, если переменная не найдена в специфичном файле)

Файл, загруженный первым, имеет приоритет. Это позволяет:

- Переопределить специфичные для окружения значения
- Использовать `.env` для общих значений по умолчанию

## Начальная настройка

### 1. Development окружение

```bash
# Скопируйте example файл
cp env.development.example .env.development

# Или создайте .env.development вручную
cat > .env.development <<EOF
NODE_ENV=development
LISTEN_HOST=localhost
LISTEN_PORT=3000
LOG_LEVEL=debug
AUTH_ENABLED=false
# ... остальные переменные
EOF
```

### 2. Production окружение

```bash
# Скопируйте example файл
cp env.production.example .env.production

# Обязательно настройте критичные переменные:
# - AUTH_TOKENS (если AUTH_ENABLED=true)
# - ASSEMBLYAI_API_KEY (если ALLOW_CUSTOM_API_KEY=false)
```

### 3. Базовый .env файл (опционально)

Создайте `.env` для общих значений:

```bash
cp .env.example .env
```

## Переменные окружения

### Основные настройки приложения

| Переменная      | Описание               | По умолчанию | Development   | Production   |
| --------------- | ---------------------- | ------------ | ------------- | ------------ |
| `NODE_ENV`      | Окружение              | `production` | `development` | `production` |
| `LISTEN_HOST`   | Хост для прослушивания | `0.0.0.0`    | `localhost`   | `0.0.0.0`    |
| `LISTEN_PORT`   | Порт                   | `80`         | `3000`        | `80`         |
| `API_BASE_PATH` | Базовый путь API       | `api`        | `api`         | `api`        |
| `API_VERSION`   | Версия API             | `v1`         | `v1`          | `v1`         |

### Логирование

| Переменная  | Описание                                       | Значения                        | Development | Production |
| ----------- | ---------------------------------------------- | ------------------------------- | ----------- | ---------- |
| `LOG_LEVEL` | Уровень логирования                            | `debug`, `log`, `warn`, `error` | `debug`     | `warn`     |
| `TZ`        | Таймзона процесса для логов (UTC рекомендуемо) | любой валидный TZ               | `UTC`       | `UTC`      |

**Рекомендации:**

- **Development:** используйте `debug` для подробного логирования
- **Production:** используйте `warn` или `error` для минимизации логов
- Всегда устанавливайте `TZ=UTC` чтобы время в логах было стабильно и независимо от окружения. В JSON логах используется ISO 8601 формат в поле `@timestamp`, а в pretty-логах формат `UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'`

### Авторизация

| Переменная     | Описание                                   | Тип     | Development | Production    |
| -------------- | ------------------------------------------ | ------- | ----------- | ------------- |
| `AUTH_ENABLED` | Включить Bearer token авторизацию          | boolean | `false`     | `true`        |
| `AUTH_TOKENS`  | Список разрешённых токенов (через запятую) | string  | —           | обязательно\* |

**Примечания:**

- `AUTH_TOKENS` обязателен только если `AUTH_ENABLED=true`
- В development можно отключить авторизацию для удобства тестирования
- В production **настоятельно рекомендуется** включить авторизацию

**Пример:**

```bash
AUTH_ENABLED=true
AUTH_TOKENS=prod-token-1,prod-token-2,prod-token-3
```

### STT настройки

| Переменная                | Описание                               | По умолчанию | Рекомендации                                  |
| ------------------------- | -------------------------------------- | ------------ | --------------------------------------------- |
| `STT_DEFAULT_PROVIDER`    | Провайдер STT по умолчанию             | `assemblyai` | `assemblyai`                                  |
| `STT_ALLOWED_PROVIDERS`   | Разрешённые провайдеры (через запятую) | `assemblyai` | `assemblyai`                                  |
| `STT_MAX_FILE_SIZE_MB`    | Макс. размер файла (MB)                | `100`        | `100`                                         |
| `STT_REQUEST_TIMEOUT_SEC` | Таймаут запроса (сек)                  | `15`         | `15-30`                                       |
| `STT_POLL_INTERVAL_MS`    | Интервал опроса (мс)                   | `1500`       | `1500`                                        |
| `STT_MAX_SYNC_WAIT_MIN`   | Макс. время синхронного ожидания (мин) | `3`          | `3-5`                                         |
| `ALLOW_CUSTOM_API_KEY`    | Разрешить custom API ключи             | `false`      | dev: `true`, prod: `false`                    |
| `ASSEMBLYAI_API_KEY`      | API ключ AssemblyAI                    | —            | обязательно если `ALLOW_CUSTOM_API_KEY=false` |

## Запуск в разных окружениях

### Development

```bash
# Способ 1: использовать NODE_ENV
NODE_ENV=development pnpm start:dev

# Способ 2: через npm скрипт (по умолчанию development)
pnpm start:dev
```

### Production

```bash
# Сначала собрать
pnpm build

# Запустить с production конфигурацией
NODE_ENV=production pnpm start:prod

# Или напрямую
NODE_ENV=production node dist/main.js
```

### Test

Тесты используют программную установку переменных окружения в коде тестов:

```typescript
beforeAll(async () => {
  process.env.AUTH_ENABLED = 'true';
  process.env.AUTH_TOKENS = 'test-token';
  // ...
});
```

**Не рекомендуется** использовать `.env.test` файл, так как:

- Каждый тест может требовать разные конфигурации
- Программная установка обеспечивает изоляцию между тестами
- Явная настройка в коде делает тесты более понятными

## Docker

При использовании Docker передавайте переменные окружения через:

### docker-compose.yml

Docker конфигурация находится в директории `docker/`. Файл `docker-compose.yml` использует готовый образ `bozonx/micro-stt:latest`.

**Вариант 1: Прямое указание значений в docker-compose.yml**

```yaml
services:
  micro-stt:
    image: bozonx/micro-stt:latest
    ports:
      - '8080:80'
    environment:
      - NODE_ENV=production
      - LISTEN_HOST=0.0.0.0
      - LISTEN_PORT=80
      - TZ=UTC
      - AUTH_ENABLED=true
      - AUTH_TOKENS=your-token-1,your-token-2
      - ASSEMBLYAI_API_KEY=your-api-key-here
      - LOG_LEVEL=warn
```

**Вариант 2: Использование .env файла**

Создайте файл `.env` в директории `docker/`:

```bash
# docker/.env
AUTH_TOKENS=your-token-here
ASSEMBLYAI_API_KEY=your-api-key-here
LOG_LEVEL=warn
```

Обновите `docker-compose.yml`:

```yaml
services:
  micro-stt:
    environment:
      - AUTH_TOKENS=${AUTH_TOKENS}
      - ASSEMBLYAI_API_KEY=${ASSEMBLYAI_API_KEY}
      - LOG_LEVEL=${LOG_LEVEL:-warn}
```

### Запуск через docker-compose

```bash
# Перейдите в директорию docker
cd docker

# Запустите сервис
docker compose up -d

# Просмотр логов
docker compose logs -f

# Остановка сервиса
docker compose down
```

### Docker Run напрямую

Переменные окружения устанавливаются при запуске контейнера:

```bash
docker run -d \
  -p 8080:80 \
  -e NODE_ENV=production \
  -e TZ=UTC \
  -e AUTH_ENABLED=true \
  -e AUTH_TOKENS=token1,token2 \
  -e ASSEMBLYAI_API_KEY=your-key-here \
  --name micro-stt \
  bozonx/micro-stt:latest
```

### Сборка собственного образа

Если нужно собрать кастомный образ:

```bash
# 1. Соберите приложение (из корня micro-stt/)
pnpm install
pnpm build

# 2. Соберите Docker образ
cd docker
docker build -t micro-stt:custom -f Dockerfile ..

# 3. Запустите
docker run -d -p 8080:80 \
  -e AUTH_TOKENS=your-tokens \
  -e ASSEMBLYAI_API_KEY=your-key \
  micro-stt:custom
```

## Валидация

При запуске приложение автоматически валидирует все переменные окружения:

- Проверяет типы данных (число, строка, boolean)
- Проверяет допустимые значения (например, `NODE_ENV` должен быть `development`, `production` или `test`)
- Проверяет обязательные поля (например, `AUTH_TOKENS` обязателен если `AUTH_ENABLED=true`)

Если валидация не проходит, приложение **не запустится** и выведет детальное сообщение об ошибке.

## Безопасность

⚠️ **Важно:**

1. **Никогда не коммитьте** файлы `.env*` в git (кроме `.example` файлов)
2. Используйте `.gitignore` для исключения всех `.env` файлов
3. В production всегда используйте сложные токены авторизации
4. Храните sensitive данные (токены, API ключи) в безопасном месте
5. Регулярно ротируйте токены и ключи

## Приоритет конфигурации

Порядок приоритета (от высшего к низшему):

1. Переменные окружения ОС (runtime)
2. `.env.${NODE_ENV}` файл
3. `.env` файл
4. Значения по умолчанию в коде

**Пример:**

```bash
# В .env
PORT=3000

# В .env.production
PORT=8080

# В командной строке
PORT=9000 NODE_ENV=production node dist/main.js

# Результат: приложение запустится на порту 9000
```

## Troubleshooting

### Приложение не видит переменные

1. Проверьте, что файл называется правильно (`.env.development`, не `env.development`)
2. Проверьте, что `NODE_ENV` установлен корректно
3. Убедитесь, что файл находится в корне проекта `micro-stt/`

### Ошибка валидации при запуске

1. Проверьте формат значений (числа должны быть числами, не строками в кавычках)
2. Убедитесь, что все обязательные переменные установлены
3. Проверьте, что значения попадают в допустимые диапазоны

### Конфигурация не применяется

1. Перезапустите приложение после изменения `.env` файлов
2. Проверьте приоритет: переменные ОС переопределяют файлы
3. Убедитесь, что используется правильное окружение (`NODE_ENV`)

## Дополнительная информация

- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [Авторизация](./AUTH.md)
