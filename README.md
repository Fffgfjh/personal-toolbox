# Personal Toolbox

一个从零实现、前后端分离的个人工具网站。参考前端提供熟悉的侧栏、分类、搜索、收藏和深浅主题；独立 API 负责 PDF、Office 与 OCR 的安全接入。

## 项目特点

- 前后端可独立替换：`apps/web` 不掌握上游文档服务信息，`apps/api` 不依赖 React 页面。
- 稳定共享契约：15 项文档操作统一定义在 `packages/contracts`，API 同时提供 OpenAPI。
- 有界文档网关：服务端限制上传、输出、上传时长和单进程并发，并校验引擎返回的文件类型。
- 浏览器本地优先：互动图片编辑、文件摘要、文件类型、文本与开发工具不会上传内容。
- 易于定制：品牌、仓库链接、API 地址、分类和工具入口都有集中位置。
- 可直接发布：包含 pnpm workspace、测试、CI、双 Docker 镜像和 Compose 示例。

当前参考前端包含 43 个工具入口：5 项互动图片工具、2 项本地文件工具、15 项文档工具和 21 项常用开发/文本/生成工具。

## 目录

```text
apps/
  web/                 React 参考前端，可整体替换
  api/                 Fastify 独立 API
packages/
  contracts/           前后端共享类型与文档工具目录
docs/
  ARCHITECTURE.md       架构与信任边界
  API.md                API 使用说明
  DOCUMENT-ENGINE.md    文档引擎适配与真实服务测试
  FRONTEND-HANDOFF.md   给其他前端或 AI 工具的交接说明
  PUBLISHING.md         GitHub 与容器发布说明
```

## 本地开发

需要 Node.js 22+。项目固定使用 pnpm 10.13.1，可由 Corepack 管理。

```bash
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install
```

复制环境模板：

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

同时启动前端和 API：

```bash
pnpm dev
```

- 前端：`http://localhost:5173`
- API：`http://localhost:3001/api/v1/health`
- OpenAPI UI：`http://localhost:3001/docs`

未填写 `DOCUMENT_SERVICE_BASE_URL` 时，API 仍可启动、展示目录和文档，但文档处理会明确返回 `document_service_disabled`。

## Docker Compose

```bash
cp .env.docker.example .env
docker compose up --build
```

访问 `http://localhost:8080`。Web 容器把同源 `/api` 转发给独立 API 容器；API 再按固定白名单访问你配置的文档服务。

默认 Compose 只有一层可信 Nginx，因此设置 `TRUST_PROXY_HOPS=1`；如果改变代理拓扑，请同步调整该值。文档网关仍使用有界内存缓冲，公开承载大文件前请阅读 [文档引擎说明](docs/DOCUMENT-ENGINE.md) 的资源限制。

## 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

连接隔离的真实文档服务执行 15 项兼容性测试时，参考 [文档引擎说明](docs/DOCUMENT-ENGINE.md)，并运行 `pnpm test:documents:live`。该测试默认跳过且不会自动访问外部服务。

## 自定义入口

- 品牌默认值：`apps/web/src/config/defaults.ts`
- 构建时覆盖：`apps/web/.env.example`
- 工具分类和入口：`apps/web/src/tools/registry.tsx`
- 文档工具公开契约：`packages/contracts/src/index.ts`
- 上游服务白名单：`apps/api/src/document-upstream.ts`
- 文档引擎适配器：`apps/api/src/document-engine/`
- API 安全限制：`apps/api/.env.example`

如果准备让其他 AI 或团队重做前端，请先阅读 [前端交接说明](docs/FRONTEND-HANDOFF.md)，不要直接耦合 `apps/api` 内部实现。

准备创建独立 GitHub 仓库时，参考 [发布说明](docs/PUBLISHING.md)。

## 许可证

本项目的独立实现使用 [MIT License](LICENSE)。
