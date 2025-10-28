FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV LISTEN_HOST=0.0.0.0
ENV LISTEN_PORT=80
ENV TZ=UTC
ENV LOG_LEVEL=warn

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Copy runtime files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --prefer-offline || pnpm install --prod --prefer-offline

# Copy pre-built application
COPY dist ./dist

EXPOSE 80

CMD ["node", "dist/main.js"]
