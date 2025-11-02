# Документация DTO классов

## Обзор

Этап 7 плана разработки включает создание DTO (Data Transfer Objects) классов для валидации входных данных API и структурирования ответов. Все DTO используют `class-validator` для валидации и `class-transformer` для преобразования данных.

## Созданные DTO классы

### 1. UploadFileDto (`upload-file.dto.ts`)

**Назначение**: Валидация параметров загрузки файлов через multipart/form-data

**Основные поля**:

- `ttl?: number` - Время жизни файла в секундах (60-2592000, по умолчанию 3600)
- `metadata?: Record<string, any>` - Дополнительные метаданные файла
- `allowDuplicate?: boolean` - Разрешить дубликаты файлов (по умолчанию true)
- `customFilename?: string` - Пользовательское имя файла

**Дополнительные классы**:

- `FileValidationDto` - Для валидации файла в multipart запросе
- `UpdateFileMetadataDto` - Для обновления метаданных существующего файла

### 2. FileResponseDto (`file-response.dto.ts`)

**Назначение**: Структурирование ответов API с информацией о файлах

**Основные классы**:

- `FileResponseDto` - Базовая информация о файле
- `UploadFileResponseDto` - Ответ при загрузке файла
- `GetFileInfoResponseDto` - Ответ при получении информации о файле
- `DeleteFileResponseDto` - Ответ при удалении файла
- `ListFilesResponseDto` - Ответ при получении списка файлов
- `FileStatsResponseDto` - Ответ со статистикой файлов
- `BaseApiResponseDto<T>` - Базовый класс для API ответов

**Особенности**:

- Автоматическое вычисление `isExpired` и `timeRemaining`
- Трансформация дат в ISO строки
- Поддержка пагинации и метаданных

### 3. HealthResponseDto (`health-response.dto.ts`)

**Назначение**: Структурирование ответов health check

**Основные классы**:

- `HealthResponseDto` - Базовый ответ health check
- `DetailedHealthResponseDto` - Детальный ответ с проверками компонентов
- `HealthErrorResponseDto` - Ответ при ошибке health check
- `HealthCheckDto` - Результат проверки отдельного компонента
- `StorageHealthDto` - Информация о состоянии хранилища

**Статусы здоровья**:

- `HEALTHY` - Компонент работает нормально
- `UNHEALTHY` - Компонент не работает
- `DEGRADED` - Компонент работает с ограничениями

## Валидация

### Правила валидации

1. **TTL (Time To Live)**:
   - Минимум: 60 секунд (1 минута)
   - Максимум: 2592000 секунд (30 дней)
   - По умолчанию: 3600 секунд (1 час)

2. **Метаданные**:
   - Должны быть валидным JSON объектом
   - Автоматическое преобразование строки JSON в объект

3. **Даты**:
   - Должны быть в формате ISO 8601
   - Автоматическая валидация формата

4. **Файлы**:
   - Используется интерфейс `UploadedFile` из общих интерфейсов
   - Поддержка multipart/form-data

### Обработка ошибок

- **Валидация**: Используется `class-validator` с детальными сообщениями об ошибках
- **Трансформация**: Используется `class-transformer` с обработкой исключений
- **Типизация**: Строгая типизация TypeScript для всех полей

## Swagger документация

Все DTO классы аннотированы декораторами `@ApiProperty` и `@ApiPropertyOptional` для автоматической генерации Swagger документации:

- Описания полей
- Примеры значений
- Типы данных
- Ограничения валидации

## Тестирование

Создан файл `test/unit/dto-validation.spec.ts` с тестами для:

- Валидации корректных данных
- Проверки ограничений валидации
- Обработки ошибок
- Значений по умолчанию
- Трансформации данных

## Использование

### Импорт DTO

```typescript
import { UploadFileDto, FileResponseDto, HealthResponseDto } from './modules/files/dto';
```

### Валидация в контроллере

```typescript
@Post('upload')
async uploadFile(@Body() uploadDto: UploadFileDto) {
  // uploadDto автоматически валидируется
  // и содержит значения по умолчанию
}
```

### Трансформация ответов

```typescript
@Get(':id')
async getFileInfo(@Param('id') id: string): Promise<FileResponseDto> {
  const fileInfo = await this.filesService.getFileInfo(id);
  return plainToClass(FileResponseDto, fileInfo);
}
```

## Соответствие плану разработки

✅ **Этап 7 выполнен полностью**:

- Созданы DTO для загрузки файлов
- Созданы DTO для ответов API
- Созданы DTO для health check ответов
- Настроена валидация с class-validator
- Добавлена Swagger документация
- Написаны unit тесты
- Проверена компиляция и линтер

## Следующие этапы

Этап 7 готов для интеграции с:

- **Этап 8**: FilesService (использование DTO для валидации)
- **Этап 9**: FilesController (использование DTO в endpoints)
- **Этап 10**: FilesModule (настройка глобальных пайпов валидации)
