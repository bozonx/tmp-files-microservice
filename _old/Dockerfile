# Используем официальный образ Node.js 22 Alpine для минимального размера
FROM node:22-alpine

# Устанавливаем timezone данные
RUN apk add --no-cache tzdata

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package.json pnpm-lock.yaml ./

# Устанавливаем pnpm и только продакшн зависимости
RUN npm install -g pnpm@10.13.1 && \
    pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# Копируем собранное приложение
COPY dist ./dist

# Создаем директории для хранения файлов
RUN mkdir -p /app/storage

# Устанавливаем timezone по умолчанию
ENV TZ=UTC

# Открываем порт
EXPOSE 80

# Добавляем health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const basePath = process.env.API_BASE_PATH || 'api'; const version = process.env.API_VERSION || 'v1'; const url = \`http://localhost:80/\${basePath}/\${version}/health\`; require('http').get(url, (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Запускаем приложение
CMD ["node", "dist/main.js"]
