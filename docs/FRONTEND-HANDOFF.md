# 前端重做交接说明

这份说明用于把 `apps/web` 交给其他团队或 AI 工具重新制作。参考前端不是后端依赖，可以完全替换。

## 必须保留的接口边界

1. 从 `GET /api/v1/document-tools` 读取文档工具目录，或直接使用 `@personal-toolbox/contracts`。
2. 文档处理请求发送到 `POST /api/v1/document-tools/:toolId/run`。
3. 所有上传文件字段名都是 `fileInput`，多文件按追加顺序处理。
4. 错误读取 `{ code, message, requestId }`，不要根据 HTTP 文本猜测。
5. 下载文件名从 `Content-Disposition` 读取，并保留本地后备名称。

## 不应放进新前端的内容

- `DOCUMENT_SERVICE_BASE_URL` 或任何上游服务路径。
- API Key、Token、Cookie 或服务器地址清单。
- 文件大小/数量的唯一校验逻辑。前端可以提前提示，但 API 校验才是最终边界。
- 任意 URL 代理功能。

## 本地工具要求

- 图片、摘要、文件类型和文本工具继续在浏览器执行。
- 图片编辑应保留互动预览、可拖动裁剪框、旋转、翻转、缩放、输出尺寸、格式、质量和结果预览。
- 大文件摘要使用分块处理，避免一次性读取整个文件。
- 对 JWT 明确说明“解码不等于验签”。

## 推荐页面结构

- 全局搜索、分类、收藏、主题切换。
- 首页显示工具名称、简短说明和“需要服务端”状态。
- 工具页把说明、隐私边界、输入、处理状态和下载结果分开。
- 手机端操作按钮和上传区必须可触控，裁剪交互不要依赖 hover。

## 构建时配置

- 以 `apps/web/.env.example` 为公开配置模板，不提交真实密钥。
- `VITE_APP_*` 控制站点名称和说明，`VITE_REPOSITORY_URL`、`VITE_OWNER_*`、`VITE_SUPPORT_URL` 控制“关于”页公开链接。
- 开发环境可用 `VITE_API_BASE_URL=/api` 走 Vite 代理；独立部署时可以填写 API 的完整公开地址。
- Compose 会从仓库根目录 `.env` 向 Web 镜像传递上述公开品牌变量，服务端变量仍只进入 API 容器。

## 验收清单

- API 未配置时，文档工具显示明确的可恢复错误，本地工具不受影响。
- 429、413、415、422、502、504 都能向用户显示可读消息。
- 取消请求会调用 `AbortController.abort()`。
- 多文件工具可调整顺序。
- 页面没有硬编码文档服务地址或密钥。
- 桌面与 375px 宽度均可完成主要流程。
- 键盘可以打开、操作并关闭搜索和手机侧栏；关闭的抽屉不能被 Tab 聚焦。
- 提交前运行 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`。
