# 发布到 GitHub

## 首次创建仓库

在确认 GitHub 账号、仓库名和可见性后，可以使用 GitHub CLI：

```bash
gh auth status
gh repo create personal-toolbox --public --source . --remote origin --push
```

如需私有仓库，把 `--public` 改成 `--private`。不要从 VPS 运维仓库创建子目录历史，本项目已经是独立 Git 仓库。

## 发布前设置

1. 把 `VITE_REPOSITORY_URL` 设置为新仓库地址。
2. 在仓库 Actions 设置中允许读取内容和写入 Packages。
3. 不要把 `.env`、API Key 或服务器清单提交到仓库。
4. 运行 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`。

## 容器版本

推送语义化标签会触发 Web 和 API 两个 GHCR 镜像：

```bash
git tag v0.1.0
git push origin v0.1.0
```

镜像名称采用：

- `ghcr.io/<owner>/<repo>-web`
- `ghcr.io/<owner>/<repo>-api`

## 部署建议

- Web 与 API 可以分开部署；同源部署时把 `/api` 反向代理到 API。
- 文档服务地址和 API Key 只存在于 API 的运行环境。
- `TRUST_PROXY_HOPS` 必须等于 API 前方可信代理跳数；直连为 0，默认 Compose 为 1，避免限流共用代理 IP 或信任伪造来源。
- 提高上传大小或文档引擎超时后，同步调整 Web Nginx 的 `client_max_body_size` 与代理超时。
- 大文件部署先保持文档并发为 1，并根据输入、输出多份缓冲的峰值为 API 容器设置内存限制。
- 首次上线先保持原生产站不变，通过新域名或临时端口做验收，再切换流量。
