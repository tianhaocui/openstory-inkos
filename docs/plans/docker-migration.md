# Docker 化迁移方案（OpenStory + InkOS 同时迁）

> 只读评估，未改文件/未执行 docker/未停服务。依据 release agent 方案。
> 用户决策：两个服务**同时容器化**；构建/lint 需限内存（另见 QA 测试策略）。

## 关键结论

**依赖单向：InkOS → OpenStory**（不是互相依赖）

- nginx `auth_request` 把每个 `/inkos/` 请求先打到 OpenStory `/api/internal/inkos-session`（`deploy/inkos-nginx.conf:2-12,22-29`）→ OpenStory 不健康则 `/inkos/` 502，**硬依赖**。
- InkOS 主动同步到 OpenStory（`inkos/packages/studio/src/api/server.ts:3331-3346,3714-3723`），失败排队重试 → 软依赖。
- 两边共享 `INKOS_SYNC_SECRET`（各 env 文件，值不变）。

因此：`inkos` 加 `depends_on: { openstory: { condition: service_healthy } }`，OpenStory 不加反向依赖。

## compose 骨架（要点）

| 服务      | 网络                                                                | 端口 | 卷                                                                                 | 限额           |
| --------- | ------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------- | -------------- |
| openstory | bridge + `--host 0.0.0.0`（publish 到宿主 `127.0.0.1:3001`）        | 3001 | `.wrangler/state`（D1/R2/DO/Workflows/observability，实测 369MB）、`.env.local:ro` | 2g / 1 cpu     |
| inkos     | **host 网络**（`server.ts:5200` 硬编码 `127.0.0.1`，bridge 不可达） | 4567 | 两个 inkos 数据目录                                                                | 512m / 0.5 cpu |

- healthcheck：openstory `/health`，inkos `/inkos/`。
- `.dockerignore` 必须排除 `.env.local`、`**/.dev.vars`（实测 `dist/server/.dev.vars` 318B）、`.wrangler/state`、`node_modules`、`.git`、`e2e/.auth`——密钥绝不进镜像。
- 日志 `max-size:50m max-file:3`（observability 已 291MB 且增长，磁盘比内存更早成瓶颈）。

## 迁移顺序（逐服务切，总停机 ~20–60s）

1. **准备**：备份 `.wrangler/state` + InkOS 两数据目录；记录基线；构建两个镜像（现网无影响）。绝不拿同一 `.wrangler/state` 起第二个 Miniflare（SQLITE_BUSY）。预检用临时端口 3099 + 状态副本。
2. **切 InkOS**：`stop && disable inkos.service` → 确认 4567 空闲 → `docker compose up -d inkos` → 验 `/inkos/`（此时 systemd OpenStory 仍在，auth_request 正常）。
3. **切 OpenStory**：`stop && disable openstory.service` → 确认 3001 空闲 → `docker compose up -d openstory` → 验 `/health`、`/`、`/r2/<对象>`、登录。
4. **端到端**：外网验 `/health`、`/inkos/`、`/_inkos_auth`、Launch InkOS 302、一次 sync。
5. **观察 24–48h**；systemd unit 保留不删。开机自启改为 `docker.service` enabled + 容器 `restart: unless-stopped`，不让两个 systemd unit 抢端口。

**停止顺序**：compose 按依赖反向自动先停 inkos 再停 openstory，避免 sync 打到关闭中的 OpenStory。

**回滚**：`docker compose stop`（**绝不加 `--volumes`**）→ `systemctl enable --now openstory.service inkos.service`。两运行时共用宿主卷，无需数据恢复；但必须完全停容器再启 systemd。

## 风险（要点）

| 风险                                                  | 缓解                                                   |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `.wrangler/state` 漏挂 → 账号/媒体/工作流丢失（致命） | bind mount + 切换前备份；`down` 不加 `--volumes`       |
| `Restart=always` 抢端口                               | 先 stop+disable，确认空闲；容器 `unless-stopped`       |
| 容器 loopback 不可达                                  | OpenStory `--host 0.0.0.0`；InkOS host 网络            |
| 依赖倒置启动即 502                                    | `depends_on: service_healthy`；停止顺序反向            |
| 镜像烘焙密钥                                          | `.dockerignore` 排除 `.env*`；密钥只走 mount/env_file  |
| 双 Miniflare SQLITE_BUSY                              | 两运行时不同时开；冒烟用状态副本                       |
| Node 版本（engines ≥24，现网 v22）                    | 容器 Node 24；切换前临时端口验证                       |
| AGPL（InkOS）                                         | 不改源码仅换运行方式 → 无 §13 新义务；镜像保留 LICENSE |
| AI key 缺失                                           | 容器化不解决；后续 `env_file` 注入                     |

## 内存预算（2 核 12GB）

实测运行期：openstory ~185MB（vite 55 + workerd 130）、inkos ~20MB、dockerd ~60MB。
容器限额 2g + 512m；构建/lint **不进运行容器**，在镜像构建阶段或宿主机做，单独限并发
（oxlint/tsgolint 单实例、`--max-old-space-size` ~1GB），避免叠加逼近 12GB。
磁盘余 42GB；observability 291MB 持续增长，需日志轮转 + 定期清理。
