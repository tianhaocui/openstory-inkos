---
title: 公共 API
description: 通过程序创建 AI 视频序列——一次请求即可创建并轮询状态，同时支持 HAL 链接、?wait 长轮询和 OpenAPI 3.1 规范
section: Developer Guide
order: 1
---

OpenStory 提供了一组精简的公共 HTTP API，让智能体和脚本无需操作 UI 即可创建视频序列。它具备**自描述能力**：智能体可通过两个无需身份验证的端点了解全部接口，无需阅读本页。

## 发现 API

- `GET /api/v1` — API 根端点：包含使用说明、创建请求的 JSON Schema，以及列出可用操作的 HAL `_links` 目录。
- `GET /api/v1/openapi.json` — 完整的 OpenAPI 3.1 规范，由 API 验证请求时使用的同一份 schema 生成。

两者都无需身份验证，因此工具可以在配置密钥之前发现 API。`https://openstory.so/llms.txt` 也会指向这里。

## 身份验证

除发现端点和设备登录端点对外，调用方需要发送 `osk_` 密钥**或** OAuth 访问令牌。获取密钥有两种方式：

- **设备代码登录**（适用于智能体/CLI，无需复制粘贴）：`POST /api/v1/device/code` 返回 `device_code`、简短的 `user_code` 和 `verification_url`。向用户展示代码和 URL（或打开 `verification_url_complete`），然后持续请求 `GET /api/v1/device/token?device_code=…&wait=60s`，直到返回 `200 { api_key, team }`。用户尚未决定时会收到 `428 authorization_pending`（继续轮询；`?wait` 会在服务端阻塞）；未使用 `?wait` 且轮询频率高于 `interval` 时会收到 `429 slow_down`；此外还可能收到 `403 access_denied` 或 `410 expired_token`（代码有效期为 10 分钟；过期后重新开始）。两个端点都按 IP 限流。
- **手动创建**：在控制面板的**设置 → 开发者**中创建密钥。

无论采用哪种方式，得到的都是普通密钥，用户可在设置 → 开发者中将其撤销。通过以下任一请求头发送：

```
Authorization: Bearer <key>
x-api-key: <key>
```

密钥限定在团队范围内，只能访问所属团队的序列，并限流为**每秒 10 个请求**；超过限制时会返回 `429`，并附带 `Retry-After` 请求头。

### OAuth 2.1（“使用 OpenStory 登录”）

能够执行授权码 + PKCE 流程的应用完全不需要密钥，例如 Claude 或 Cursor 等托管 MCP 客户端、提供“连接 OpenStory”功能的 OpenStory 分支，以及任何支持浏览器重定向的应用。OpenStory 本身就是 OAuth 2.1 授权服务器：

- **发现：**`GET /.well-known/oauth-authorization-server`（RFC 8414；也支持 `/.well-known/openid-configuration`）。API 的受保护资源文档位于 `GET /.well-known/oauth-protected-resource/api/v1`（RFC 9728），MCP 端点对应的文档位于 `/.well-known/oauth-protected-resource/mcp`。
- **动态注册**（RFC 7591）：向 `POST /api/auth/oauth2/register` 发送你的 `redirect_uris` 和 `client_name`，无需在控制面板中操作。该端点按 IP 限流。超过一周仍未使用的 DCR 客户端（未授权且无刷新令牌）会在后续注册请求到来时被删除。
- **授权：**将用户引导至 `/api/auth/oauth2/authorize`，携带 PKCE（`S256`）、所需作用域和 `resource=<origin>/api/v1`（RFC 8707），以便签发面向此 API 的令牌。用户会在需要时登录，然后在授权同意页面批准；该页面会显示你的应用名称以及授权计费所归属的团队。
- **令牌：**在 `/api/auth/oauth2/token` 用授权码换取令牌。访问令牌是有效期一小时的 JWT；如需刷新令牌，请申请 `offline_access`。

访问令牌的发送方式与密钥完全相同：

```
Authorization: Bearer <access_token>
```

与密钥不同，令牌受**作用域**限制：

| 作用域            | 授予的权限                                    |
| ----------------- | --------------------------------------------- |
| `sequences:read`  | 所有 `GET` 请求                               |
| `sequences:write` | 编辑和导出（`POST …/exports`、样式变更）      |
| `generate`        | 任何消耗额度的操作（`POST /sequences`、增强） |
| `credits:read`    | 额度余额（为 MCP 端点保留）                   |

令牌缺少路由所需作用域时，会收到 `403`，并附带 `WWW-Authenticate: Bearer error="insufficient_scope", scope="…"` 质询，指出重新授权所需的作用域；令牌无效或已过期时，会收到带有 `error="invalid_token"` 的 `401`。两种响应都会携带指向 RFC 9728 文档的 `resource_metadata="…"`，MCP 客户端据此进入授权流程。

用户可在**设置 → 开发者 → 已授权应用**中查看和撤销授权。撤销后刷新令牌会立即失效；已经签发的访问令牌将在一小时内到期。

## MCP (`POST /mcp`)

使用 Streamable HTTP 的托管 MCP 客户端（Claude、Cursor 等）和 CLI 应调用 `POST /mcp`，而不是 REST API。每个请求都相互独立（MCP 2026-07-28；无会话存储，也不使用 SSE 传输）。

- **OAuth：**`/mcp` 返回的 401 会携带 `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/mcp"`，`claude mcp add --transport http openstory https://<host>/mcp` 据此找到授权服务器。令牌的受众必须绑定到 `<origin>/mcp`（授权时使用 `resource=<origin>/mcp`）。
- **API 密钥：**`Authorization: Bearer osk_…` 可在不使用 OAuth 的情况下列出工具（Claude Code 的 `--header`）。密钥限流为每秒 10 个请求；OAuth JWT 则按用户限流。
- **来源：**浏览器客户端必须发送允许的 `Origin`（应用主机、已知的托管 MCP 客户端或环回地址）。不带 `Origin` 的请求（curl、CLI）允许通过。不允许的 `Origin` 会收到 `403`。

首个工具是 `whoami`（返回调用方用户和团队），客户端可在生产工具上线前用它验证连接。

## 创建序列

`POST /api/v1/sequences` 将脚本转换为视频序列。生成过程是异步的：调用会立即返回 `202`，其中包含已创建的序列 ID 和用于轮询的状态 URL。

```bash
curl -X POST https://openstory.so/api/v1/sequences \
  -H "Authorization: Bearer $OPENSTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "script": "A lighthouse keeper befriends a stranded whale.",
    "title": "Sea Tale",
    "style": "Cinematic Noir",
    "targetSeconds": 30,
    "motion": true,
    "music": true,
    "characters": ["Old Tom the keeper", { "name": "The whale", "isHuman": false }],
    "locations": ["Stormy lighthouse"]
  }'
```

请求体设计便于使用：可以按 ID 或名称引用样式、演员或地点，也可以传入内联对象来新建它们。`enhance`（`auto` | `always` | `off`）控制脚本扩展；`motion` 和 `music` 分别控制视频与配乐。完整请求 schema 请参阅 `GET /api/v1` 或 OpenAPI 规范。

响应（`202`）：

```json
{
  "sequences": [
    {
      "id": "seq_…",
      "status": "draft",
      "workflowRunId": "…",
      "statusUrl": "/api/v1/sequences/seq_…",
      "_links": {
        "self": { "href": "…", "method": "GET" },
        "poll": { "href": "…", "method": "GET", "templated": true }
      }
    }
  ],
  "enhancedScript": "…",
  "_links": { "self": { "…": "…" } }
}
```

## 轮询状态

`GET /api/v1/sequences/{id}` 返回从数据库派生的状态文档，其中包含总体状态、生成时使用的 `style` 和 `models`、宽高比、逐帧图像/视频状态及 URL、音乐、海报，以及就绪/失败计数。由于数据直接派生自数据库，即使稍后重新连接，结果也始终准确。

`style` 的结构为 `{ id, name }`（仅在极少数样式行无法解析的情况下，名称才会是 `null`），`models` 的结构为 `{ analysis, image, video, music }`，其中保存原始模型 ID。控制面板也使用这些值筛选和搜索序列。

即使最终状态为 `completed`，仍可能出现 `counts.videosFailed > 0`，因为单帧失败不会导致整个运行失败。因此请检查计数，以确认端到端生成是否成功。

## 列出你的序列

`GET /api/v1/sequences` 返回团队的序列，并按最新创建优先排序。每个条目都是状态文档的精简摘要，包含 `status`、`aspectRatio`、`style`、`models`、`poster`、`music` 和就绪/失败 `counts`，但**不包含**逐帧数组；同时提供指向完整状态文档的 `self` 链接。

```bash
curl "https://openstory.so/api/v1/sequences?limit=20" \
  -H "x-api-key: $OPENSTORY_API_KEY"
```

使用 `?limit`（默认 20，最大 100）和响应 `_links.next` 中返回的不透明 `?cursor` 进行分页。访问该链接即可获取下一页；若链接不存在，则表示已经到达末页。已归档的序列不会返回。

## 使用 `?wait` 长轮询

智能体通常没有休眠工具，因此每个可轮询端点都接受 `?wait=<duration>`（`60s`、`30`、`2m`、`1500ms`；上限为 90 秒）。服务器会保持请求连接，并在序列发生变化或进入最终状态时立即返回：

```bash
curl "https://openstory.so/api/v1/sequences/seq_…?wait=60s" \
  -H "x-api-key: $OPENSTORY_API_KEY"
```

响应会携带 `X-Wait-Changed`（是否有进展？）和 `X-Wait-Done`（是否已进入最终状态？）请求头。对于 `POST`，`?wait` 还会嵌入每个新序列的首个进度快照，并为每个序列提供 `waitChanged`/`waitDone` 标志。格式错误的 `wait` 值会返回 `400`，而不会静默降级为非阻塞请求。

## 约定

- **HAL 链接。**每个响应都包含 `_links` 映射，列出当前资源可执行的操作，并为每项操作标明 `method`。请跟随链接，不要硬编码路径。
- **错误始终为 JSON：**`{ "error": { "code", "message", "details"? } }`，并带有匹配的 HTTP 状态；绝不会返回 HTML 页面或重定向。
