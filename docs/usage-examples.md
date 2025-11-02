# Примеры использования (cURL)

Все примеры без авторизации (на уровне сервиса её нет). При необходимости используйте API Gateway.

Определим переменные:

```bash
BASE_URL="http://localhost:3000/api/v1"
```

## Health
```bash
curl -s "$BASE_URL/health"
```

## Загрузка файла
```bash
curl -s -X POST \
  -F "file=@./README.md" \
  -F "ttl=3600" \
  "$BASE_URL/files" | jq
```

## Информация о файле
```bash
FILE_ID="<uuid>"
curl -s "$BASE_URL/files/$FILE_ID" | jq
```

С истёкшими:
```bash
curl -s "$BASE_URL/files/$FILE_ID?includeExpired=true" | jq
```

## Скачивание файла
```bash
curl -L -o downloaded.bin "$BASE_URL/files/$FILE_ID/download"
```

## Удаление файла
```bash
curl -s -X DELETE "$BASE_URL/files/$FILE_ID" | jq
```

Принудительное удаление истёкшего:
```bash
curl -s -X DELETE "$BASE_URL/files/$FILE_ID?force=true" | jq
```

## Листинг/поиск
```bash
curl -s "$BASE_URL/files?mimeType=text/plain&limit=5&offset=0" | jq
```

## Статистика
```bash
curl -s "$BASE_URL/files/stats" | jq
```

## Проверка существования
```bash
curl -s "$BASE_URL/files/$FILE_ID/exists" | jq
```

Примечание: `ttl` указывается в секундах.
