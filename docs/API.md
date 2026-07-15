# Personal Toolbox API

默认地址为 `http://localhost:3001`，交互式 OpenAPI 位于 `/docs`。

## 系统接口

### 健康检查

```http
GET /api/v1/health
```

响应会说明 API 是否已配置文档服务，但不会暴露其地址。

### 文档工具目录

```http
GET /api/v1/document-tools
```

返回工具 ID、名称、说明、允许扩展名、文件数量、输出扩展名和表单字段。新前端应以此结果或 `@personal-toolbox/contracts` 为准。

## 运行文档工具

```http
POST /api/v1/document-tools/{toolId}/run
Content-Type: multipart/form-data
```

- 每个文件都使用字段名 `fileInput`。
- 多文件工具通过重复 `fileInput` 保持上传顺序。
- 其他字段来自目录中的 `fields`。
- 成功响应为二进制下载，并通过 `Content-Disposition` 提供安全文件名。

示例：

```bash
curl -f \
  -F "fileInput=@first.pdf" \
  -F "fileInput=@second.pdf" \
  http://localhost:3001/api/v1/document-tools/pdf-merge/run \
  --output merged.pdf
```

## 错误格式

```json
{
  "code": "missing_files",
  "message": "至少需要 2 个文件。",
  "requestId": "req-1"
}
```

常见错误码：`unknown_tool`、`multipart_required`、`unsupported_file_type`、`file_too_large`、`request_too_large`、`too_many_files`、`missing_files`、`missing_field`、`invalid_field`、`rate_limited`、`document_service_disabled`、`request_cancelled`、`busy`、`unsupported_option`、`upstream_rejected`、`upstream_auth_failed`、`upstream_contract_mismatch`、`upstream_invalid_response`、`upstream_output_too_large`、`upstream_timeout`、`upstream_unavailable`。

## 兼容原则

- `/api/v1` 内已有字段只做向后兼容变更。
- 新增工具可以扩展目录，不应让前端硬编码上游路径。
- 上游错误统一映射为稳定的本地错误结构。

供应商路径、字段转换、真实服务测试和替换适配器的方法见 [文档引擎接入说明](DOCUMENT-ENGINE.md)。
