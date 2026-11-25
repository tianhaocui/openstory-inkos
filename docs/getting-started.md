---
title: 快速开始
description: 配置 OpenStory 本地开发环境
section: Developer Guide
order: 1
---

OpenStory 是一个开源 AI 视频制作平台。本指南将带你完成本地开发环境的配置。

## 前置要求

- [Bun](https://bun.com/docs/installation) >= 1.3.9
- [Git](https://git-scm.com)

无需准备其他工具。不需要 Docker、外部数据库或 Cloudflare 账户——本地开发环境通过 Miniflare 在 Workerd 内运行完整技术栈（D1、R2、Workflows、Durable Objects 和邮件服务）。

## 快速启动

```bash
# Clone the repository
git clone https://github.com/openstory-so/openstory.git
cd openstory

# Install and run
bun install
bun dev
```

`bun dev` 会完成所有准备工作：首次运行时生成 `.env.local`（包含身份验证和加密密钥）、迁移本地数据库并填充种子数据，然后启动开发服务器。

应用将在 [http://localhost:3000](http://localhost:3000) 上运行。

## AI 密钥

要使用 AI 生成功能，你需要两个 API 密钥——运行 `bun setup` 以交互方式添加，或将它们粘贴到 `.env.local`：

- `FAL_KEY` — 用于生成图像、视频和音频的 [fal.ai](https://fal.ai/dashboard/keys) 密钥
- `OPENROUTER_KEY` — 用于 LLM 剧本分析的 [OpenRouter](https://openrouter.ai/settings/keys) 密钥

## 环境变量

可用环境变量的完整列表请参阅 [`.env.example`](https://github.com/openstory-so/openstory/blob/main/.env.example)，其中还包括 Google OAuth、Stripe、PostHog 和远程 R2 存储等可选服务。

## 数据库

本地开发通过 [Drizzle ORM](https://orm.drizzle.team) 使用 [Cloudflare D1](https://developers.cloudflare.com/d1) 数据库（由 Miniflare 支持的 SQLite），无需账户或远程服务。`bun dev` 会自动迁移数据库并填充种子数据。

```bash
# Generate migrations from schema changes
bun db:generate

# Apply migrations to the local D1 database
bun db:migrate:local

# Open Drizzle Studio against the local D1 database
bun db:studio:local
```

生产部署使用 Cloudflare D1。详情请参阅 [Cloudflare 部署指南](/docs/deployment/cloudflare)。

## 后续步骤

- [创建序列](/docs/user-guide/creating-sequences) — 创建你的第一个视频序列
- [处理场景](/docs/user-guide/scenes) — 编辑和完善单个场景
- [AI 模型](/docs/user-guide/ai-models) — 完整的模型参考
- [部署到 Cloudflare](/docs/deployment/cloudflare) — 生产环境部署指南
