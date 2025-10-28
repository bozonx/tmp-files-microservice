# Бойлерплейт микросервиса (NestJS + Fastify)

Минимальный шаблон сервиса на NestJS с Fastify, готовый для быстрого старта проектов.

## Что включено

- 🏥 Простой health-check эндпоинт `/health`
- 📊 Логирование через Pino (JSON в prod)
- 🛡️ Глобальный фильтр ошибок
- ⚡ Fastify
- 🧪 Настроенные Jest-тесты (unit и e2e)
- 🐳 Готовность к работе в Docker

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

- `GET /{API_BASE_PATH}/{API_VERSION}/health`

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
