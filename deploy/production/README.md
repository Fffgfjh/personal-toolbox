# 生产部署

这份 Compose 面向 `tool.766113.xyz` 当前的单机部署：Caddy 访问仅监听回环地址的 Web，Web 再通过内部网络访问 API；API 通过既有 `control-plane_default` 网络访问 Stirling PDF。

## 首次启动

```bash
cp deploy/production/.env.example deploy/production/.env
docker compose --env-file deploy/production/.env -f deploy/production/compose.yaml config
docker compose --env-file deploy/production/.env -f deploy/production/compose.yaml build
docker compose --env-file deploy/production/.env -f deploy/production/compose.yaml up -d
```

默认只发布 `127.0.0.1:8454`，API 不发布宿主机端口。上线前先检查：

```bash
curl --fail http://127.0.0.1:8454/healthz
curl --fail http://127.0.0.1:8454/api/v1/health
curl --fail http://127.0.0.1:8454/api/v1/document-tools
```

## 生产约束

- `.env` 不提交到 Git；即使当前 Stirling PDF 不需要密钥，也只在服务器环境中填写真实密钥。
- Caddy 和 Web Nginx 位于 API 前方，所以 `TRUST_PROXY_HOPS=2`。
- Web 与 API 使用只读根文件系统；临时目录使用有大小限制的 tmpfs。
- 文档处理并发默认保持 1；API 会对输入和输出进行有界内存缓冲，因此容器内存上限保守设置为 2 GiB。
- 切换 Caddy 前保留旧容器和完整 Caddyfile 备份，先验证配置再热重载。
