# Логирование в Micro STT

## Обзор

Микросервис Micro STT использует **Pino** — высокопроизводительный логгер для Node.js приложений. Pino обеспечивает структурированное JSON логирование, отличную производительность и удобную интеграцию с системами мониторинга.

## Архитектура

### Компоненты логирования

1. **nestjs-pino** — интеграция Pino с NestJS фреймворком
2. **pino-http** — автоматическое логирование HTTP запросов
3. **pino-pretty** — красивый форматированный вывод для development

### Конфигурация

Логирование настраивается в `src/app.module.ts` через `LoggerModule.forRootAsync()`:

```typescript
LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const appConfig = configService.get<AppConfig>('app')!;
    const isDev = appConfig.nodeEnv === 'development';

    return {
      pinoHttp: {
        level: appConfig.logLevel,
        transport: isDev ? { target: 'pino-pretty', options: {...} } : undefined,
        serializers: {...},
        redact: {...},
        customLogLevel: {...},
        autoLogging: {...}
      },
    };
  },
})
```

## Уровни логирования

Уровень логирования управляется через переменную окружения `LOG_LEVEL`:

| Уровень | Описание                        | Использование                |
| ------- | ------------------------------- | ---------------------------- |
| `debug` | Детальная отладочная информация | Development, troubleshooting |
| `log`   | Общие логи                      | Development                  |
| `warn`  | Предупреждения                  | Production (рекомендуется)   |
| `error` | Ошибки                          | Production (минимальный)     |

### Настройка уровня логов

**.env.development:**

```env
LOG_LEVEL=debug
```

**.env.production:**

```env
LOG_LEVEL=warn
```

## Форматы вывода

### Development режим

В development используется `pino-pretty` для читаемого вывода с полной датой и временем в UTC формате (ISO 8601):

```
[2025-10-17T14:30:45.123Z] INFO [TranscriptionController]: Transcription request received for URL: https://example.com/audio.mp3
[2025-10-17T14:30:47.456Z] INFO [AssemblyAiProvider]: Transcription request created with ID: abc123
[2025-10-17T14:30:50.789Z] INFO [TranscriptionController]: Transcription request completed. Provider: assemblyai, Processing time: 5666ms
```

### Production режим

В production логи выводятся в JSON формате с полем `@timestamp` (ISO 8601, UTC):

```json
{
  "level": 30,
  "@timestamp": "2025-10-17T14:30:45.123Z",
  "service": "micro-stt",
  "environment": "production",
  "pid": 12345,
  "hostname": "app-server-01",
  "req": {
    "id": "req-1",
    "method": "POST",
    "url": "/api/v1/transcriptions/file",
    "path": "/api/v1/transcriptions/file",
    "remoteAddress": "192.168.1.100",
    "remotePort": 52341
  },
  "res": {
    "statusCode": 200
  },
  "responseTime": 5666,
  "msg": "request completed"
}
```

## Безопасность логирования

### Redaction чувствительных данных

Pino автоматически скрывает чувствительную информацию:

```typescript
redact: {
  paths: ['req.headers.authorization', 'req.headers["x-api-key"]'],
  censor: '[REDACTED]',
}
```

**Пример:**

```json
{
  "req": {
    "headers": {
      "authorization": "[REDACTED]",
      "x-api-key": "[REDACTED]"
    }
  }
}
```

### Удаление query параметров

Query параметры автоматически удаляются из URL в логах:

```typescript
serializers: {
  req: req => ({
    url: req.url,
    path: req.url?.split('?')[0], // Только путь без query params
  });
}
```

## Использование в коде

### Инжекция Logger через DI

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class MyService {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    logger.setContext(MyService.name);
  }

  someMethod() {
    this.logger.debug('Debug message');
    this.logger.info('Info message');
    this.logger.warn('Warning message');
    this.logger.error('Error message', error.stack);
  }
}
```

### Structured Logging

Для передачи дополнительных данных используйте объект:

```typescript
this.logger.info({
  msg: 'Transcription completed',
  transcriptionId: result.id,
  processingTime: result.processingMs,
  textLength: result.text.length,
});
```

**Вывод в production:**

```json
{
  "level": 30,
  "@timestamp": "2025-10-17T14:30:45.123Z",
  "service": "micro-stt",
  "environment": "production",
  "msg": "Transcription completed",
  "transcriptionId": "abc123",
  "processingTime": 5666,
  "textLength": 1234
}
```

## Автоматическое логирование HTTP

### Request/Response логирование

Pino автоматически логирует все HTTP запросы:

- **Входящий запрос**: метод, URL, IP адрес
- **Ответ**: status code, время выполнения
- **Request ID**: автоматически генерируется для трейсинга

### Фильтрация эндпоинтов

Health check эндпоинты не логируются в production:

```typescript
autoLogging: {
  ignore: (req) => {
    if (appConfig.nodeEnv === 'production') {
      return req.url?.includes('/health') || false;
    }
    return false;
  },
}
```

### Динамический уровень логов

Уровень лога зависит от HTTP status code:

```typescript
customLogLevel: (req, res, err) => {
  if (res.statusCode >= 500 || err) return 'error';
  if (res.statusCode >= 400) return 'warn';
  return 'info';
};
```

## Интеграция с системами мониторинга

### ELK Stack (Elasticsearch, Logstash, Kibana)

JSON логи Pino идеально подходят для Logstash:

**logstash.conf:**

```ruby
input {
  file {
    path => "/var/log/micro-stt/app.log"
    codec => "json"
  }
}

filter {
  json {
    source => "message"
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "micro-stt-%{+YYYY.MM.dd}"
  }
}
```

### Grafana Loki

```yaml
# promtail-config.yaml
scrape_configs:
  - job_name: micro-stt
    static_configs:
      - targets:
          - localhost
        labels:
          job: micro-stt
          __path__: /var/log/micro-stt/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            msg: msg
            context: context
```

### AWS CloudWatch

```typescript
// Используйте pino-cloudwatch для отправки логов в CloudWatch
import pinoCloudwatch from 'pino-cloudwatch';

const stream = pinoCloudwatch({
  logGroupName: '/aws/microservices/micro-stt',
  logStreamName: 'production-logs',
});
```

### Docker Logging

```yaml
# docker-compose.yml
services:
  micro-stt:
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
        labels: 'service,environment'
```

## Best Practices

### 1. Используйте правильные уровни

- **debug**: Детальная информация для разработки
- **info**: Важные события (старт транскрипции, завершение)
- **warn**: Нештатные ситуации (недоступен заголовок, превышен лимит)
- **error**: Ошибки требующие внимания

### 2. Добавляйте контекст

```typescript
// ❌ Плохо
this.logger.info('Request completed');

// ✅ Хорошо
this.logger.info({
  msg: 'Request completed',
  requestId: req.id,
  duration: 5666,
  status: 200,
});
```

### 3. Логируйте ошибки с stack trace

```typescript
try {
  await this.process();
} catch (error) {
  this.logger.error('Processing failed', error.stack);
  throw error;
}
```

### 4. Не логируйте чувствительные данные

```typescript
// ❌ Плохо
this.logger.debug(`API Key: ${apiKey}`);

// ✅ Хорошо
this.logger.debug('Using custom API key');
```

### 5. Используйте Request ID для трейсинга

Pino автоматически генерирует request ID для каждого запроса. Используйте его для связи логов:

```typescript
this.logger.info({
  msg: 'Starting background job',
  requestId: req.id, // Передавайте request ID в фоновые задачи
});
```

## Производительность

### Почему Pino?

| Характеристика    | Pino            | Winston      | Bunyan       |
| ----------------- | --------------- | ------------ | ------------ |
| Скорость          | ⚡ Очень быстро | 🐢 Медленно  | 🏃 Средне    |
| JSON по умолчанию | ✅              | ❌           | ✅           |
| Async logging     | ✅              | ⚠️ Частично  | ❌           |
| NestJS интеграция | ✅ Официальная  | ⚠️ Community | ⚠️ Community |
| Child loggers     | ✅              | ✅           | ✅           |

### Benchmark

На основе [официальных тестов Pino](https://github.com/pinojs/pino#benchmarks):

```
pino: 10,000 ops/sec
winston: 1,500 ops/sec
bunyan: 3,000 ops/sec
```

Pino в **6-7 раз быстрее** Winston!

## Troubleshooting

### Логи не отображаются

**Проблема:** Не видно логов в консоли

**Решение:**

1. Проверьте `LOG_LEVEL` в `.env`
2. Убедитесь что `bufferLogs: true` в `main.ts`
3. Проверьте что logger подключен: `app.useLogger(app.get(Logger))`

### Логи не в JSON формате в production

**Проблема:** В production логи отображаются как в development

**Решение:**

1. Убедитесь что `NODE_ENV=production`
2. Проверьте что `pino-pretty` используется только в development
3. Удалите `transport` опцию для production

### Слишком много логов

**Проблема:** Логи занимают много места

**Решение:**

1. Увеличьте `LOG_LEVEL` до `warn` или `error`
2. Добавьте больше эндпоинтов в `autoLogging.ignore`
3. Настройте log rotation в Docker/Kubernetes

## Миграция с старого Logger

### Изменения в API

| Старый API            | Новый API (Pino)                       |
| --------------------- | -------------------------------------- |
| `logger.log()`        | `logger.info()`                        |
| `logger.debug()`      | `logger.debug()`                       |
| `logger.warn()`       | `logger.warn()`                        |
| `logger.error()`      | `logger.error()`                       |
| `new Logger(context)` | `@Inject(PinoLogger)` + `setContext()` |

### Пример миграции

**До (старый Logger):**

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  process() {
    this.logger.log('Processing started');
  }
}
```

**После (Pino):**

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class MyService {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    logger.setContext(MyService.name);
  }

  process() {
    this.logger.info('Processing started');
  }
}
```

## Дополнительные ресурсы

- [Pino Documentation](https://getpino.io/)
- [nestjs-pino GitHub](https://github.com/iamolegga/nestjs-pino)
- [Pino Best Practices](https://getpino.io/#/docs/best-practices)
- [NestJS Logging](https://docs.nestjs.com/techniques/logger)
