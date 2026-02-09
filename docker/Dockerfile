ARG NODE_MAJOR=24

FROM node:${NODE_MAJOR}-alpine AS build

WORKDIR /app

ENV NODE_ENV=development

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prefer-offline || pnpm install --prefer-offline

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN pnpm build:node

ENV NODE_ENV=production
RUN pnpm prune --prod

FROM node:${NODE_MAJOR}-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV LISTEN_HOST=0.0.0.0
ENV LISTEN_PORT=8080
ENV TZ=UTC
ENV LOG_LEVEL=warn

RUN apk add --no-cache tini

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8080

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/src/index.node.js"]
