# E2E Тесты

Этот каталог содержит End-to-End (E2E) тесты для микросервиса `micro-file-cache`.

## Быстрый старт

```bash
# Запуск всех E2E тестов
pnpm run test:e2e

# Запуск конкретного теста
pnpm run test:e2e -- test/e2e/auth.e2e-spec.ts
```

## Файлы тестов

- `simple.e2e-spec.ts` - Простые тесты для проверки базовой функциональности
- `auth.e2e-spec.ts` - Специализированные тесты аутентификации
- `app.e2e-spec.ts` - Основные E2E тесты приложения
- `files.controller.e2e-spec.ts` - Детальные тесты FilesController
- `integration.e2e-spec.ts` - Интеграционные тесты
- `performance.e2e-spec.ts` - Тесты производительности

## Конфигурация

Тесты используют файл `env.test` в корне проекта с оптимизированными настройками для тестирования.

## Хранилище данных

Все данные хранятся в корне репозитория:

- `test-data/micro-file-cache/storage/` - основное хранилище
- `test-data/micro-file-cache/temp-*` - временные папки для тестов

## Утилиты

- `e2e-test-utils.ts` - Общие утилиты для создания тестового приложения
- `__mocks__/file-type.js` - Мок для библиотеки file-type

## Подробная документация

См. `docs/E2E_TESTING.md` для полной документации.
