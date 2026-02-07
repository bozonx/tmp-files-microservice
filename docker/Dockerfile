ARG NODE_MAJOR=24
FROM node:${NODE_MAJOR}-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV LISTEN_HOST=0.0.0.0
ENV LISTEN_PORT=8080
ENV TZ=UTC
ENV LOG_LEVEL=warn
ENV CLEANUP_INTERVAL_MINS=10
ENV REDIS_ENABLED=false
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV REDIS_DB=0
ENV REDIS_KEY_PREFIX=tmp_files:

# Install tini for better signal handling
RUN apk add --no-cache tini

# Install pnpm
RUN corepack enable

# Copy runtime files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --prefer-offline || pnpm install --prod --prefer-offline

# Copy pre-built application
COPY dist ./dist

# Copy Web UI static files
COPY public ./public

EXPOSE 8080

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/src/entry-node.js"]
