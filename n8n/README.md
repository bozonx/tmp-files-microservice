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

Базовый URL и авторизация берутся из Credentials. Используется Basic Auth (username/password).

## Поля

- **Source Type** — выбор источника данных: `Binary` или `URL`.
- **Binary Property** — имя бинарного поля из входящих данных (по умолчанию `data`). Видно только при `Binary`.
- **File URL** — URL файла (видно только при `URL`).
- **TTL (minutes)** — время жизни файла в минутах (обязательное поле, минимум `1`, по умолчанию `60`).

## Credentials

Используются кастомные креды `Tmp Files API`:

- **Base URL** — базовый URL микросервиса (обязательное поле).
- **Username** — имя пользователя для Basic Auth.
- **Password** — пароль для Basic Auth.

Поддерживаются выражения, поэтому можно использовать переменные окружения при настройке кредов:

- Для Base URL: `{{$env.TMP_FILES_BASE_URL}}`
- Для Username: `{{$env.TMP_FILES_USERNAME}}`
- Для Password: `{{$env.TMP_FILES_PASSWORD}}`

## Continue On Fail

Если включить опцию “Continue On Fail” в настройках ноды, обработка не прервётся на первом ошибочном элементе:

- Ошибочные элементы будут возвращены с полем `json.error` и с сохранением ссылки на исходный элемент через `pairedItem`.
- Успешные элементы вернут обычный `json`-ответ сервиса.

Где включать:

- Откройте ноду → вкладка Settings → переключатель “Continue On Fail”.

Когда полезно:

- При батчевой загрузке файлов/URL, чтобы единичная ошибка не останавливала весь процесс.

Когда не стоит включать:

## Совместимость

Поддерживается n8n версии `1.60.0` и выше.

## Ресурсы

- [Документация по community-нодам n8n](https://docs.n8n.io/integrations/#community-nodes)
