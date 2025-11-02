# Бойлерплейт микросервиса (NestJS + Fastify)

Минимальный шаблон сервиса на NestJS с Fastify, готовый для быстрого старта проектов.

## Что включено

- 🏥 Простой health-check эндпоинт `/{API_BASE_PATH}/{API_VERSION}/health`
- 📊 Логирование через Pino (JSON в prod)
- 🛡️ Глобальный фильтр ошибок
- ⚡ Fastify
- 🧪 Настроенные Jest-тесты (unit и e2e)
- 🐳 Готовность к работе в Docker
- 🚫 Без встроенной авторизации; Swagger и GraphQL отсутствуют (аутентификация предполагается на уровне API Gateway)

## Быстрый старт

Требования:

- Node.js 22+
- pnpm 10+

```bash
# 1) Установка зависимостей
pnpm install

# 2) Окружение (prod)
cp env.production.example .env.production

# 3) Сборка и запуск (prod)
pnpm build
pnpm start:prod
```

URL по умолчанию (prod): `http://localhost:80/api/v1`
Для Docker Compose: `http://localhost:8080/api/v1`

## Переменные окружения

Файлы окружения:

- `.env.production`
- `.env` (опционально)

Источник истины для переменных: `.env.production.example`.

Ключевые переменные:

- `NODE_ENV` — `production|development|test`
- `LISTEN_HOST` — например, `0.0.0.0` или `localhost`
- `LISTEN_PORT` — например, `80` или `3000`
- `API_BASE_PATH` — префикс API (по умолчанию `api`)
- `API_VERSION` — версия API (по умолчанию `v1`)
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`
- `TZ` — таймзона (по умолчанию `UTC`)

## Эндпоинты

- `GET /{API_BASE_PATH}/{API_VERSION}/health` — проверка состояния
- `POST /{API_BASE_PATH}/{API_VERSION}/files` — загрузка файла (multipart/form-data)
  - Поля: `file` (binary), `ttl` (integer, секунды), `metadata` (string, JSON, опционально), `allowDuplicate` (`true|false`, опционально), `customFilename` (string, опционально)
- `GET /{API_BASE_PATH}/{API_VERSION}/files/:id` — информация о файле
  - Query: `includeExpired=true|false`
- `GET /{API_BASE_PATH}/{API_VERSION}/files/:id/download` — скачивание файла
  - Query: `includeExpired=true|false`
- `DELETE /{API_BASE_PATH}/{API_VERSION}/files/:id` — удаление файла
  - Query: `force=true|false`
- `GET /{API_BASE_PATH}/{API_VERSION}/files` — поиск/листинг файлов
  - Query: `mimeType`, `minSize`, `maxSize`, `uploadedAfter`, `uploadedBefore`, `expiredOnly`, `limit`, `offset`
- `GET /{API_BASE_PATH}/{API_VERSION}/files/stats` — агрегированная статистика
- `GET /{API_BASE_PATH}/{API_VERSION}/files/:id/exists` — проверка существования файла
  - Query: `includeExpired=true|false`

Подробнее: `docs/api-specification.md`

## Тесты
См. инструкции в `docs/dev.md`.

## Docker

- Dockerfile ожидает уже собранный `dist/`
- Пример запуска — `docker/docker-compose.yml`

```bash
# Сборка приложения
pnpm build

# Локальный запуск через compose (без cd)
docker compose -f docker/docker-compose.yml up -d --build
```

После запуска (compose): `http://localhost:8080/api/v1/health`

## Лицензия

MIT
