# Security Policy

## 报告问题

请不要在公开 Issue 中提交密钥、Token、Cookie、服务器地址或包含私人文件的复现材料。仓库发布后，可通过仓库的私密安全报告功能提交漏洞。

## 部署注意

- `DOCUMENT_SERVICE_API_KEY` 只配置在 API 环境中，不能使用 `VITE_*` 前缀。
- 生产环境请把 `ALLOWED_ORIGINS` 限定为实际前端来源，不建议使用 `*`。
- API 应放在 HTTPS 反向代理后；不要直接暴露上游文档服务。
- 根据服务器资源调整上传限制、限流和超时。
- 本项目不会把密码、私钥或 Token 写入仓库。
