# n8n-nodes-bozonx-tmp-files

Это пакет community-ноды для n8n. Нода отправляет бинарный файл или URL на файл в микросервис временного хранения и возвращает временную ссылку (URL).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Установка](#installation)
[Использование](#использование)
[Поля](#поля)
[Переменные окружения](#переменные-окружения)
[Совместимость](#совместимость)
[Ресурсы](#ресурсы)

## Installation

Следуйте официальной инструкции по установке community-нод: [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Использование

Нода отправляет данные в эндпоинт `POST {{baseUrl}}/api/v1/tmp-files`.

- Если выбран источник `URL`, отправляется JSON `{ url: string, ttl: number }`.
- Если выбран источник `Binary`, отправляется `multipart/form-data` с полями:
  - `file` — содержимое бинарного поля из входящего item
  - `ttl` — строковое значение времени жизни в минутах

Авторизация: заголовок `Authorization: Bearer <token>` (если указан токен).

## Поля

- **Source Type** — выбор источника данных: `Binary` или `URL`.
- **Binary Property** — имя бинарного поля из входящих данных (по умолчанию `data`). Видно только при `Binary`.
- **File URL** — URL файла (видно только при `URL`).
- **Base URL** — базовый URL микросервиса (по умолчанию берётся из `TMP_FILES_BASE_URL`).
- **TTL (minutes)** — время жизни файла в минутах (по умолчанию `60`).
- **Bearer Token** — токен авторизации (по умолчанию из `TMP_FILES_TOKEN`).

## Переменные окружения

- `TMP_FILES_BASE_URL` — базовый URL микросервиса (например, `https://tmp-files.example.com`).
- `TMP_FILES_TOKEN` — Bearer-токен по умолчанию (опционально, если сервис требует авторизацию).

## Совместимость

Поддерживается n8n версии `1.60.0` и выше.

## Ресурсы

- [Документация по community-нодам n8n](https://docs.n8n.io/integrations/#community-nodes)
