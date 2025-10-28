# Docker Deployment Guide

Полное руководство по развёртыванию микросервиса `micro-stt` с использованием Docker.

## Содержание

- [Обзор](#обзор)
- [Структура Docker конфигурации](#структура-docker-конфигурации)
- [Использование готового образа](#использование-готового-образа)
- [Сборка собственного образа](#сборка-собственного-образа)
- [Конфигурация через docker-compose](#конфигурация-через-docker-compose)
- [Запуск через docker run](#запуск-через-docker-run)
- [Health Checks](#health-checks)
- [Логирование](#логирование)
- [Обновление сервиса](#обновление-сервиса)
- [Troubleshooting](#troubleshooting)
- [Production рекомендации](#production-рекомендации)

## Обзор

Микросервис `micro-stt` доступен в виде готового Docker образа на Docker Hub:

- **Образ:** `bozonx/micro-stt:latest`
- **Порт по умолчанию:** 80 (внутри контейнера)
- **Рекомендуемый внешний порт:** 8080
- **База:** Node.js 22 Alpine Linux

## Структура Docker конфигурации

Docker конфигурация находится в директории `docker/`:

```
micro-stt/
├── docker/
│   ├── Dockerfile           # Для сборки собственного образа
│   └── docker-compose.yml   # Готовая конфигурация для запуска
```

**Особенности:**

- `Dockerfile` использует **предварительно собранный** `dist/` каталог
- `docker-compose.yml` по умолчанию использует готовый образ из Docker Hub
- Healthcheck встроен в docker-compose.yml
- Используется Alpine Linux для минимального размера образа

## Использование готового образа

### Быстрый старт

```bash
# 1. Перейдите в директорию docker
cd micro-stt/docker

# 2. Настройте переменные окружения в docker-compose.yml
# Отредактируйте значения AUTH_TOKENS и ASSEMBLYAI_API_KEY

# 3. Запустите сервис
docker compose up -d

# 4. Проверьте статус
docker compose ps

# 5. Проверьте логи
docker compose logs -f
```

Сервис будет доступен по адресу: `http://localhost:8080/api/v1`

### Проверка работоспособности

```bash
# Health check
curl http://localhost:8080/api/v1/health

# API info
curl http://localhost:8080/api/v1

```

## Сборка собственного образа

Если вам нужно собрать кастомный образ (например, для тестирования изменений):

### Шаг 1: Соберите приложение

```bash
# Из корневой директории micro-stt/
pnpm install
pnpm build
```

Это создаст директорию `dist/` с собранным приложением.

### Шаг 2: Соберите Docker образ

```bash
cd docker

# Сборка с тегом
docker build -t micro-stt:custom -f Dockerfile ..

# Или с версией
docker build -t micro-stt:0.13.0 -f Dockerfile ..
```

**Примечание:** Контекст сборки (`..`) указывает на родительскую директорию, так как нужен доступ к `dist/`, `package.json` и другим файлам.

### Шаг 3: Используйте собственный образ

Измените `docker-compose.yml`:

```yaml
services:
  micro-stt:
    # Закомментируйте готовый образ
    # image: bozonx/micro-stt:latest

    # Используйте локальную сборку
    build:
      context: ..
      dockerfile: docker/Dockerfile
    # ... остальная конфигурация
```

Или запустите напрямую:

```bash
docker run -d \
  -p 8080:80 \
  -e AUTH_TOKENS=your-token \
  -e ASSEMBLYAI_API_KEY=your-key \
  --name micro-stt \
  micro-stt:custom
```

## Конфигурация через docker-compose

### Вариант 1: Прямое указание значений

Отредактируйте `docker/docker-compose.yml`:

```yaml
services:
  micro-stt:
    image: bozonx/micro-stt:latest
    container_name: micro-stt
    ports:
      - '8080:80'
    environment:
      # Базовые настройки
      - NODE_ENV=production
      - LISTEN_HOST=0.0.0.0
      - LISTEN_PORT=80
      - TZ=UTC

      # API конфигурация
      - API_BASE_PATH=api
      - API_VERSION=v1

      # Логирование
      - LOG_LEVEL=warn

      # Авторизация
      - AUTH_ENABLED=true
      - AUTH_TOKENS=prod-token-1,prod-token-2

      # STT настройки
      - ASSEMBLYAI_API_KEY=your-assemblyai-key-here
      - STT_DEFAULT_PROVIDER=assemblyai
      - STT_MAX_FILE_SIZE_MB=100
      - STT_REQUEST_TIMEOUT_SEC=15
      - STT_MAX_SYNC_WAIT_MIN=3
      - ALLOW_CUSTOM_API_KEY=false
    restart: unless-stopped
```

### Вариант 2: Использование .env файла

1. **Создайте файл `.env` в директории `docker/`:**

```bash
# docker/.env
AUTH_TOKENS=prod-token-1,prod-token-2
ASSEMBLYAI_API_KEY=your-assemblyai-key-here
LOG_LEVEL=warn
```

2. **Обновите `docker-compose.yml`:**

```yaml
services:
  micro-stt:
    environment:
      - AUTH_TOKENS=${AUTH_TOKENS}
      - ASSEMBLYAI_API_KEY=${ASSEMBLYAI_API_KEY}
      - LOG_LEVEL=${LOG_LEVEL:-warn}
```

3. **Запустите:**

```bash
cd docker
docker compose up -d
```

### Управление сервисом

```bash
# Запустить сервис
docker compose up -d

# Остановить сервис
docker compose down

# Перезапустить сервис
docker compose restart

# Просмотр логов (real-time)
docker compose logs -f

# Просмотр логов за последние 100 строк
docker compose logs --tail=100

# Просмотр статуса
docker compose ps

# Обновить образ и перезапустить
docker compose pull
docker compose up -d
```

### Изменение портов

По умолчанию используется порт `8080:80`. Для изменения:

```yaml
ports:
  - '3000:80' # Внешний порт 3000
```

## Запуск через docker run

Для быстрого тестирования или развёртывания без docker-compose:

### Базовый запуск

```bash
docker run -d \
  --name micro-stt \
  -p 8080:80 \
  -e AUTH_ENABLED=true \
  -e AUTH_TOKENS=your-token-here \
  -e ASSEMBLYAI_API_KEY=your-key-here \
  bozonx/micro-stt:latest
```

### С полной конфигурацией

```bash
docker run -d \
  --name micro-stt \
  -p 8080:80 \
  -e NODE_ENV=production \
  -e LISTEN_HOST=0.0.0.0 \
  -e LISTEN_PORT=80 \
  -e TZ=UTC \
  -e API_BASE_PATH=api \
  -e API_VERSION=v1 \
  -e LOG_LEVEL=warn \
  -e AUTH_ENABLED=true \
  -e AUTH_TOKENS=token1,token2 \
  -e ASSEMBLYAI_API_KEY=your-key \
  -e STT_DEFAULT_PROVIDER=assemblyai \
  -e STT_MAX_FILE_SIZE_MB=100 \
  -e STT_REQUEST_TIMEOUT_SEC=15 \
  -e STT_MAX_SYNC_WAIT_MIN=3 \
  -e ALLOW_CUSTOM_API_KEY=false \
  --restart unless-stopped \
  bozonx/micro-stt:latest
```

### Управление контейнером

```bash
# Остановить контейнер
docker stop micro-stt

# Запустить контейнер
docker start micro-stt

# Перезапустить контейнер
docker restart micro-stt

# Просмотр логов
docker logs -f micro-stt

# Удалить контейнер
docker rm -f micro-stt
```

## Health Checks

### В docker-compose

Health check настроен автоматически в `docker-compose.yml`:

```yaml
healthcheck:
  test:
    [
      'CMD',
      'node',
      '-e',
      "require('http').get('http://localhost:80/api/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))",
    ]
  interval: 30s # Проверка каждые 30 секунд
  timeout: 10s # Таймаут проверки 10 секунд
  retries: 3 # 3 попытки перед пометкой как unhealthy
  start_period: 40s # Ожидание 40 секунд после старта
```

### Проверка статуса

```bash
# Статус контейнера (включая health status)
docker compose ps

# Или с docker inspect
docker inspect micro-stt --format='{{.State.Health.Status}}'

# Просмотр истории health checks
docker inspect micro-stt --format='{{json .State.Health}}' | jq
```

### Ручная проверка

```bash
# Health endpoint
curl http://localhost:8080/api/v1/health

# Readiness probe
curl http://localhost:8080/api/v1/health/ready

# Liveness probe
curl http://localhost:8080/api/v1/health/live
```

## Логирование

### Формат логов

В production режиме (`NODE_ENV=production`) логи выводятся в JSON формате:

```json
{
  "level": 30,
  "@timestamp": "2025-10-18T14:30:45.123Z",
  "service": "micro-stt",
  "environment": "production",
  "msg": "request completed"
}
```

### Просмотр логов

```bash
# Real-time логи
docker compose logs -f

# Последние 100 строк
docker compose logs --tail=100

# Логи с временными метками
docker compose logs -f -t

# Только errors (если используется LOG_LEVEL=error)
docker compose logs | grep '"level":50'
```

### Логи в файл

```bash
# Сохранить логи в файл
docker compose logs > micro-stt.log

# Real-time логи в файл
docker compose logs -f > micro-stt.log
```

### Интеграция с системами логирования

Docker логи можно интегрировать с внешними системами:

**ELK Stack (Elasticsearch, Logstash, Kibana):**

```yaml
services:
  micro-stt:
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

**Syslog:**

```yaml
logging:
  driver: 'syslog'
  options:
    syslog-address: 'tcp://logs.example.com:514'
```

**Fluentd:**

```yaml
logging:
  driver: 'fluentd'
  options:
    fluentd-address: 'localhost:24224'
```

## Обновление сервиса

### Обновление готового образа

```bash
cd docker

# Получить последнюю версию образа
docker compose pull

# Перезапустить с новым образом
docker compose up -d

# Проверить версию
curl http://localhost:8080/api/v1 | jq .version
```

### Обновление с сохранением данных

Если используются volumes для данных:

```bash
# Остановить без удаления
docker compose stop

# Обновить образ
docker compose pull

# Запустить заново
docker compose up -d
```

### Откат к предыдущей версии

```bash
# Остановить текущую версию
docker compose down

# Указать конкретную версию в docker-compose.yml
# image: bozonx/micro-stt:0.12.0

# Запустить
docker compose up -d
```

## Troubleshooting

### Контейнер не запускается

**Проверьте логи:**

```bash
docker compose logs

# Или для конкретного контейнера
docker logs micro-stt
```

**Частые проблемы:**

1. **Порт уже занят:**

   ```bash
   # Найти процесс на порту 8080
   lsof -i :8080

   # Или изменить порт в docker-compose.yml
   ports:
     - '8081:80'
   ```

2. **Отсутствуют обязательные переменные:**
   - Проверьте `AUTH_TOKENS` (если `AUTH_ENABLED=true`)
   - Проверьте `ASSEMBLYAI_API_KEY` (если `ALLOW_CUSTOM_API_KEY=false`)

3. **Проблемы с правами:**
   ```bash
   # Запустите с sudo (Linux)
   sudo docker compose up -d
   ```

### Health check failed

```bash
# Проверьте детали
docker inspect micro-stt --format='{{json .State.Health}}' | jq

# Проверьте доступность вручную
docker exec micro-stt curl http://localhost:80/api/v1/health

# Проверьте логи
docker logs micro-stt --tail=50
```

### Медленная работа

1. **Проверьте ресурсы:**

   ```bash
   docker stats micro-stt
   ```

2. **Увеличьте ресурсы Docker** (Docker Desktop)
   - Settings → Resources → Memory/CPU

3. **Проверьте конфигурацию таймаутов:**
   - `STT_REQUEST_TIMEOUT_SEC`
   - `STT_MAX_SYNC_WAIT_MIN`

### Контейнер постоянно перезапускается

```bash
# Отключите автоматический перезапуск для отладки
docker update --restart=no micro-stt

# Проверьте логи
docker logs micro-stt

# Запустите в интерактивном режиме
docker run -it --rm \
  -e AUTH_TOKENS=test \
  -e ASSEMBLYAI_API_KEY=test-key \
  bozonx/micro-stt:latest
```

### Образ не скачивается

```bash
# Проверьте доступность Docker Hub
docker pull hello-world

# Попробуйте скачать конкретную версию
docker pull bozonx/micro-stt:latest

# Проверьте прокси настройки (если используется)
```

## Production рекомендации

### Безопасность

1. **Используйте secrets для чувствительных данных:**

   ```yaml
   services:
     micro-stt:
       secrets:
         - assemblyai_key
         - auth_tokens
       environment:
         - ASSEMBLYAI_API_KEY_FILE=/run/secrets/assemblyai_key
         - AUTH_TOKENS_FILE=/run/secrets/auth_tokens

   secrets:
     assemblyai_key:
       file: ./secrets/assemblyai_key.txt
     auth_tokens:
       file: ./secrets/auth_tokens.txt
   ```

2. **Ограничьте ресурсы контейнера:**

   ```yaml
   services:
     micro-stt:
       deploy:
         resources:
           limits:
             cpus: '2.0'
             memory: 1G
           reservations:
             cpus: '0.5'
             memory: 512M
   ```

3. **Используйте non-root пользователя:**

   Образ уже использует non-root пользователя `node` (UID 1000).

4. **Включите авторизацию:**
   ```yaml
   environment:
     - AUTH_ENABLED=true
     - AUTH_TOKENS=${AUTH_TOKENS}
   ```

### Мониторинг

1. **Health checks:** Уже настроены в docker-compose.yml

2. **Метрики:**

   ```bash
   # CPU и память
   docker stats micro-stt
   ```

3. **Логи:** Настройте агрегацию логов (ELK, Grafana Loki)

### Масштабирование

Для горизонтального масштабирования используйте:

- **Docker Swarm:**

  ```bash
  docker stack deploy -c docker-compose.yml micro-stt
  ```

- **Kubernetes:**
  Создайте Deployment с replica count > 1

- **Load Balancer:**
  Используйте nginx или Traefik перед несколькими инстансами

### Обновления

1. **Проверяйте CHANGELOG** перед обновлением
2. **Тестируйте в staging** окружении
3. **Используйте версионные теги** вместо `:latest` в production
4. **Настройте автоматические обновления** через CI/CD

### Backup

Если используются volumes:

```bash
# Создать backup
docker run --rm \
  -v micro-stt_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/micro-stt-backup.tar.gz /data

# Восстановить backup
docker run --rm \
  -v micro-stt_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/micro-stt-backup.tar.gz -C /
```

## Дополнительная информация

- [README.md](../README.md) - Общая информация о проекте
- [ENV_SETUP.md](./ENV_SETUP.md) - Настройка переменных окружения
- [AUTH.md](./AUTH.md) - Авторизация и безопасность
- [LOGGING.md](./LOGGING.md) - Конфигурация логирования
- [CHANGELOG.md](./CHANGELOG.md) - История изменений

---

**Версия документа:** 1.0  
**Последнее обновление:** 2025-10-18
