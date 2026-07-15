# 架构与信任边界

## 组件

```text
浏览器
  ├─ 本地图片 / 文件 / 文本工具（内容不离开浏览器）
  └─ 文档工具
       ↓ HTTPS multipart/form-data
apps/api
  ├─ CORS、限流、文件数量/大小/扩展名校验
  ├─ 固定工具白名单与字段校验
  ├─ 超时、错误归一化、下载文件名清洗
  └─ 上游密钥（仅服务端环境变量）
       ↓ 固定路径
文档处理服务
```

`apps/web`、`apps/api` 和 `packages/contracts` 是三个明确边界：

- Web 可以整体删除并替换，只要遵守 API 或共享契约。
- API 不导入 Web 代码，也不提供页面模板。
- Contracts 不包含上游地址、密钥或部署细节。

## 本地工具

以下操作只使用浏览器能力：

- Canvas 图片裁剪、旋转、翻转、缩放、格式转换和元数据清理。
- 文件头识别以及 MD5、SHA-256 分块计算。
- JSON/YAML/Base64/JWT/正则/SQL/XML/文本转换与随机生成。

## 文档工具

文档请求统一进入：

```text
POST /api/v1/document-tools/:toolId/run
```

API 不接受任意目标 URL。`toolId` 必须存在于共享目录，并映射到 `apps/api/src/document-upstream.ts` 的固定路径，从而避免把服务端变成开放代理。

## 部署选择

1. 同源部署：Web 反向代理 `/api`，浏览器无需 CORS，Compose 示例使用此方式。
2. 分域部署：前端设置完整 `VITE_API_BASE_URL`，API 的 `ALLOWED_ORIGINS` 只填写实际前端来源。
3. 仅前端部署：本地工具全部可用；把 `VITE_API_BASE_URL` 留空即可明确禁用文档功能。

生产环境应让 API 位于 HTTPS 反向代理后，不直接公开上游文档服务。
