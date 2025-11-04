# Быстрый старт

Сервис — REST-only, без встроенной авторизации. Swagger/GraphQL отсутствуют. Для защиты используйте API Gateway.

## Установка

```bash
pnpm install
cp env.development.example .env.development
# Укажите STORAGE_DIR в .env.development перед запуском
pnpm start:dev
```

Внимание: переменная окружения STORAGE_DIR обязательна. Приложение завершит запуск с ошибкой, если она не указана.

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
  -F "ttl=60" \
  http://localhost:3000/api/v1/files
```

- `ttl` в минутах (например, 60 = 1 час; значение по умолчанию — 1440 = 1 сутки)

## Другие операции

- Информация: `GET /api/v1/files/:id`
- Скачивание: `GET /api/v1/files/:id/download`
- Удаление: `DELETE /api/v1/files/:id`
- Листинг: `GET /api/v1/files` (фильтры и пагинация)
- Статистика: `GET /api/v1/files/stats`
- Существование: `GET /api/v1/files/:id/exists`

Подробности: см. `docs/api-specification.md` и `docs/usage-examples.md`.
