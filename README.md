# Бойлерплейт микросервиса (NestJS + Fastify)

Минимальный шаблон сервиса на NestJS с Fastify, готовый для быстрого старта проектов.

## Что включено

- 🏥 Простой health-check эндпоинт `/health`
- 📊 Логирование через Pino (pretty в dev, JSON в prod)
- 🛡️ Глобальный фильтр ошибок
- ⚡ Fastify + CORS + Helmet
- 🧪 Настроенные Jest-тесты (unit и e2e)
- 🐳 Готовность к работе в Docker

## Быстрый старт

Требования:

- Node.js 22+
- pnpm 10+

```bash
# 1) Установка зависимостей
pnpm install

# 2) Окружение
cp env.development.example .env.development
cp env.production.example .env.production

# 3) Запуск в разработке
pnpm start:dev

# 4) Сборка и запуск в прод-режиме
pnpm build
NODE_ENV=production pnpm start:prod
```

URL по умолчанию: `http://localhost:3000/api/v1`

## Переменные окружения

Файлы окружения:

- `.env.production`
- `.env.development`

Ключевые переменные:

- `NODE_ENV` — `production|development|test`
- `LISTEN_HOST` — например, `0.0.0.0` или `localhost`
- `LISTEN_PORT` — например, `80` или `3000`
- `API_BASE_PATH` — префикс API (по умолчанию `api`)
- `API_VERSION` — версия API (по умолчанию `v1`)
- `LOG_LEVEL` — `trace|debug|info|warn|error|fatal|silent`

## Эндпоинты

- `GET /{API_BASE_PATH}/{API_VERSION}/health`

## Тесты

```bash
# Все тесты
pnpm test

# Unit-тесты
pnpm test:unit

# E2E-тесты
pnpm test:e2e
```

## Docker

- Dockerfile ожидает уже собранный `dist/`
- Пример запуска — `docker/docker-compose.yml`

```bash
# Сборка приложения и локальный запуск через compose
pnpm build
cd docker
docker compose up -d --build
```

## Лицензия

MIT
