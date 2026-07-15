FROM node:22-alpine AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages/contracts packages/contracts

ARG VITE_APP_NAME=个人工具箱
ARG VITE_APP_SHORT_NAME=工具箱
ARG VITE_APP_DESCRIPTION=常用开发、文件、图片与文档工具
ARG VITE_API_BASE_URL=/api
ARG VITE_REPOSITORY_URL=
ARG VITE_OWNER_NAME=
ARG VITE_OWNER_URL=
ARG VITE_SUPPORT_URL=

ENV VITE_APP_NAME=$VITE_APP_NAME \
    VITE_APP_SHORT_NAME=$VITE_APP_SHORT_NAME \
    VITE_APP_DESCRIPTION=$VITE_APP_DESCRIPTION \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_REPOSITORY_URL=$VITE_REPOSITORY_URL \
    VITE_OWNER_NAME=$VITE_OWNER_NAME \
    VITE_OWNER_URL=$VITE_OWNER_URL \
    VITE_SUPPORT_URL=$VITE_SUPPORT_URL

RUN pnpm --filter @personal-toolbox/contracts build \
    && pnpm --filter @personal-toolbox/web build

FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
