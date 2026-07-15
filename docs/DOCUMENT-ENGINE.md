# 文档引擎接入与兼容性

`apps/api` 通过内部适配器调用文档处理引擎，浏览器和 `packages/contracts` 不接触供应商路径、密钥或部署细节。

## 当前边界

```text
公开工具契约
    ↓ DocumentToolId + 公共字段
API 上传校验
    ↓ ParsedDocumentRequest
DocumentEngineAdapter
    ↓ 供应商路径、字段转换、认证、超时
外部文档处理引擎
```

关键文件：

- `apps/api/src/document-engine/adapter.ts`：可替换引擎接口和 transport 错误类型。
- `apps/api/src/document-engine/http-adapter.ts`：默认 HTTP multipart 实现。
- `apps/api/src/document-upstream.ts`：15 项操作的私有路径和字段转换。
- `apps/api/src/document-engine/http-adapter.test.ts`：全部操作的离线兼容性测试。
- `apps/api/src/document-engine/live-document-engine.test.ts`：显式启用的真实引擎测试。

默认绑定按 Stirling PDF Processing API 2.x 的公开 HTTP 契约实现。这里只调用外部服务，不复制或分发其代码和镜像。该项目当前为 open-core，官方默认镜像不能笼统视为纯 MIT；部署前必须核对固定版本、实际 flavor、镜像来源及对应许可证。本仓库因此不在 Compose 中自动拉取或重新发布第三方引擎镜像。

## 配置

```dotenv
DOCUMENT_SERVICE_BASE_URL=http://document-engine:8080
DOCUMENT_SERVICE_API_KEY=
DOCUMENT_SERVICE_TIMEOUT_MS=180000
DOCUMENT_SERVICE_MAX_CONCURRENCY=1
MAX_OUTPUT_BYTES=262144000
REQUEST_TIMEOUT_MS=300000
TRUST_PROXY_HOPS=0
```

- 地址只存在于 API 环境变量中，不得使用前端 `VITE_*` 变量暴露。
- API Key 只通过服务端 `X-API-KEY` 请求头发送。
- 未设置地址时，API 正常提供健康检查和工具目录，处理请求返回 `document_service_disabled`。
- `DOCUMENT_SERVICE_MAX_CONCURRENCY` 是单个 API 进程的并发上限；默认 1，超过时立即返回 `busy`。横向运行多个 API 实例时，总并发会相应增加。
- `MAX_OUTPUT_BYTES` 同时检查可信的 `Content-Length` 和实际读取字节数，防止上游省略或伪造长度。
- `REQUEST_TIMEOUT_MS` 限制客户端完成上传的时间，避免慢速上传长期占用并发槽。
- `TRUST_PROXY_HOPS` 只应填写 API 前方可信反向代理的跳数；直连保持 0，仓库 Compose 的单层 Nginx 使用 1。不要笼统信任任意 `X-Forwarded-For`。

生产环境建议让文档引擎只加入容器私有网络，不映射公网端口，并限制 CPU、内存、临时目录和出站网络。

## 资源与响应保护

当前 API 会在解析 multipart 前占用并发槽，并在客户端中断或响应关闭时释放；客户端断开也会向文档引擎传播取消信号。上游请求禁止自动重定向，只有 HTTP 200 会被当作成功。输出会按扩展名校验规范 MIME 与 PDF/ZIP 文件头，再以固定安全 MIME 返回，避免反射 HTML、JSON 或脚本类型。

这些措施是对现有内存缓冲实现的生产缓解，不代表完整流式处理：上传、multipart 转发和最终下载仍可能同时保留多份二进制数据。公开承载大文件或提高并发前，应继续改为临时文件或端到端流式管道，并按最坏峰值给 API 容器配置内存上限。文件头校验也只是快速边界检查，不等同于完整 PDF/ZIP 结构验证。

参考 Web 的 Nginx 当前限制为 250 MiB、代理读写超时 190 秒。若提高 `MAX_REQUEST_BYTES` 或 `DOCUMENT_SERVICE_TIMEOUT_MS`，还必须同步调整 `apps/web/nginx.conf`，否则请求会先被反向代理拒绝或超时。

## 字段适配

公共契约在前端开发期间保持冻结。引擎差异由 `document-upstream.ts` 处理，例如：

- PDF 转 Word补充 `outputFormat=docx`。
- 图片适应值转换为引擎当前接受的值。
- OCR 语言从 `chi_sim+eng` 转成重复的 `languages` 字段。
- OCR、水印和 PDF 转图片补充引擎必需的默认字段。
- 页面提取使用页面重排操作，元数据清除使用更新元数据操作。

当前 HTTP 引擎的水印接口使用居中平铺间距模型，不能严格表达公共契约的左上、右下单点定位。`center` 会映射到该平铺模型；选择 `top-left` 或 `bottom-right` 时 API 明确返回 `unsupported_option`，不会静默生成位置不符的结果。如果产品要求精确位置，应新增支持该语义的适配器实现。

## 离线测试

常规测试不会访问网络：

```bash
pnpm --filter @personal-toolbox/api test
```

参数化用例会逐项验证 15 个工具的固定路径、文件字段、顺序、公共字段转换、API Key 和 requestId。

## 真实服务测试

真实测试默认跳过，只有显式提供专用变量时才执行：

```bash
LIVE_DOCUMENT_SERVICE_BASE_URL=http://127.0.0.1:8080 \
LIVE_DOCUMENT_SERVICE_API_KEY=your-test-key \
pnpm test:documents:live
```

PowerShell：

```powershell
$env:LIVE_DOCUMENT_SERVICE_BASE_URL = 'http://127.0.0.1:8080'
$env:LIVE_DOCUMENT_SERVICE_API_KEY = 'your-test-key'
corepack pnpm test:documents:live
```

测试会运行时生成最小 PDF、PNG 和 TXT，验证全部 15 项操作；加密产生的 PDF 会继续用于解锁测试。元数据清除会检查标记确实消失，水印和页码会检查输出不再是原始 PDF。只对隔离的测试实例运行，不要把真实生产密钥写入仓库、日志或命令历史。

## 替换引擎

新的实现只需满足 `DocumentEngineAdapter`：

- `id`：内部标识。
- `configured`：是否具备最小配置。
- `execute()`：接收稳定工具定义、已校验文件、字段、requestId 和取消信号，完成供应商请求与响应标准化，返回统一的二进制结果、内容类型和下载头。

同步二进制、异步任务轮询或 JSON 包装都应在适配器内部归一化。替换实现通过 `buildApp({ documentEngine })` 注入，不要让新适配器修改公共工具 ID，也不要在前端加入供应商判断。

## 官方兼容性依据

- [Stirling PDF API 与认证](https://docs.stirlingpdf.com/API/)
- [Stirling PDF Processing OpenAPI](https://registry.scalar.com/@stirlingpdf/apis/stirling-pdf-processing-api/)
- [Stirling PDF v2.14.2](https://github.com/Stirling-Tools/Stirling-PDF/releases/tag/v2.14.2)
- [v2.14.2 根许可证](https://raw.githubusercontent.com/Stirling-Tools/Stirling-PDF/v2.14.2/LICENSE)
- [v2.14.2 Engine 许可证](https://raw.githubusercontent.com/Stirling-Tools/Stirling-PDF/v2.14.2/engine/LICENSE)
