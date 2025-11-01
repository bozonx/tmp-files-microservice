# n8n-nodes-bozonx-tmp-files

Это пакет community-ноды для n8n. Нода отправляет бинарный файл или URL на файл в микросервис временного хранения и возвращает временную ссылку (URL).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Установка](#installation)
[Использование](#использование)
[Поля](#поля)
[Credentials](#credentials)
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

Базовый URL и авторизация берутся из Credentials. Если в кредах задан токен, заголовок `Authorization: Bearer <token>` будет добавлен автоматически.

## Поля

- **Source Type** — выбор источника данных: `Binary` или `URL`.
- **Binary Property** — имя бинарного поля из входящих данных (по умолчанию `data`). Видно только при `Binary`.
- **File URL** — URL файла (видно только при `URL`).
- **TTL (minutes)** — время жизни файла в минутах (обязательное поле, минимум `1`, по умолчанию `60`).

## Credentials

Используются кастомные креды `Tmp Files API`:

- **Base URL** — базовый URL микросервиса (обязательное поле).
- **Bearer Token** — токен авторизации (опционально, если сервис требует авторизацию).

Поддерживаются выражения, поэтому можно использовать переменные окружения при настройке кредов:

- Для Base URL: `{{$env.TMP_FILES_BASE_URL}}`
- Для Bearer Token: `{{$env.TMP_FILES_TOKEN}}`

## Совместимость

Поддерживается n8n версии `1.60.0` и выше.

## Ресурсы

- [Документация по community-нодам n8n](https://docs.n8n.io/integrations/#community-nodes)
