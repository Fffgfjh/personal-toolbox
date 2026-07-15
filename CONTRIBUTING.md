# Contributing

## 开发流程

1. 使用 Node.js 22+ 与仓库指定的 pnpm 版本。
2. 修改共享契约后，同时检查 API 与 Web 类型。
3. 新增文档工具时，必须在共享目录和 API 白名单中显式登记。
4. 新增本地工具时，不应把用户内容发送到网络。
5. 提交前运行 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`。

## 工具入口

- 浏览器工具在 `apps/web/src/tools` 下实现，并在 `registry.tsx` 注册。
- API 路由在 `apps/api/src/app.ts`，上游白名单在 `document-upstream.ts`。
- 公共接口只放在 `packages/contracts`，不要把部署私有信息放进去。
