# CHANGELOG

## 0.15.0 — Boilerplate refactor

- Полностью удалены функциональности STT, GraphQL и Auth
- Оставлен только модуль Health (простой health-check)
- Упрощены конфиги окружения (`.env.*`)
- Обновлён `AppModule` и логирование (service: `nestjs-boilerplate`)
- Очищены и пересобраны тесты (unit + e2e только для health)
- Переработан `docker-compose.yml` до минимального примера (локальная сборка)
- Обновлён `README.md` (рус.)
- Удалены устаревшие документы в `docs/` (STT/Auth/GraphQL)
