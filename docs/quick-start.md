# Быстрый старт

Сервис — REST-only, без встроенной авторизации. Swagger/GraphQL отсутствуют. Для защиты используйте API Gateway.

## Установка

```bash
pnpm install
cp env.development.example .env.development
pnpm start:dev
```

По умолчанию dev URL: `http://localhost:3000/api/v1`

## Проверка

```bash
curl http://localhost:3000/api/v1/health
```

Ожидаемо: `{ "status": "ok" }`

## Загрузка файла (cURL)

```bash
curl -X POST \
  -F "file=@./README.md" \
  -F "ttl=3600" \
  http://localhost:3000/api/v1/files
```

- `ttl` в секундах (например, 3600 = 1 час)

## Другие операции

- Информация: `GET /api/v1/files/:id`
- Скачивание: `GET /api/v1/files/:id/download`
- Удаление: `DELETE /api/v1/files/:id`
- Листинг: `GET /api/v1/files` (фильтры и пагинация)
- Статистика: `GET /api/v1/files/stats`
- Существование: `GET /api/v1/files/:id/exists`

Подробности: см. `docs/api-specification.md` и `docs/usage-examples.md`.
