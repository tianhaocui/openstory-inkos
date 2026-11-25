---
title: 部署到 Cloudflare
description: 使用 D1 和 R2 将 OpenStory 部署到 Cloudflare Workers
section: Developer Guide
order: 10
---

OpenStory 部署在 Cloudflare Workers 上，使用 D1（SQLite）作为数据库，并使用 R2 存储媒体文件。

## 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/openstory-so/openstory)

部署按钮会将仓库克隆到你的 GitHub/GitLab 账户，预配 `wrangler.jsonc` 中声明的资源，提示输入 `.dev.vars.example` 中列出的密钥，并为你的副本配置 CI。

创建的仓库是独立克隆，而不是 fork，因此不存在可供 GitHub“同步 fork”按钮使用的上游链接。若要将 OpenStory 的后续更新拉取到通过按钮部署的副本中，请手动添加上游远程仓库（`git remote add upstream https://github.com/openstory-so/openstory && git pull upstream main`）。如果希望从真正的 fork 开始，请先在 GitHub 上 fork，然后在 Cloudflare 控制面板中将该 fork 连接到 [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)（也可以在本地克隆中运行 `bun setup --prod` 进行部署）。

AI 密钥（`FAL_KEY`、`OPENROUTER_KEY`）刻意不包含在部署提示中，因为该对话框中的每个字段都是必填项，而填入占位值比不填写更糟。请在部署后添加：可以在应用中按团队配置（设置 → API 密钥），也可以使用 `wrangler secret put` 在服务器范围内配置。

## 引导式设置

在你自己的克隆中，`bun setup --prod` 会以交互方式引导完成所有配置：生产环境变量（`.env.production`）、R2 域名 + CORS、可选服务、将密钥推送到 Cloudflare 和 GitHub，以及首次部署。`bun setup --deploy` 只会重新执行推送密钥 + 部署阶段；`bun setup --pr-preview` 会将预览密钥推送到 PR 预览部署所使用的 GitHub `staging` 环境。

## 前置条件

- 一个 [Cloudflare](https://cloudflare.com) 账户
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)（已作为开发依赖安装，请使用 `bunx wrangler`）
- 环境中已配置 `CLOUDFLARE_ACCOUNT_ID` 和 `CLOUDFLARE_API_TOKEN`

## wrangler.jsonc

绑定配置位于仓库根目录的 [`wrangler.jsonc`](https://github.com/openstory-so/openstory/blob/main/wrangler.jsonc)：

- `DB` — D1 数据库（`openstory-prd`）
- `R2_PUBLIC_ASSETS_BUCKET` — 公共资源（通过自定义域名提供服务）
- `R2_STORAGE_BUCKET` — 用于生成媒体的私有存储

Worker 入口点为 `src/server.ts`，并已启用 `nodejs_compat`。

## 构建与部署

上游生产环境（`openstory-so/openstory` → `openstory` worker）通过 [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) 部署。这与“部署到 Cloudflare”按钮克隆所使用的机制相同，因此上游实际使用的正是用户获得的部署管道。Workers Builds 通过 wrangler 进行身份验证，所以生产部署路径无需在 GitHub 中配置 Cloudflare 密钥。控制面板配置如下（这是唯一未在仓库中进行版本控制的部署状态）：

- **仓库 / 分支**：`openstory-so/openstory`、`main`
- **构建命令**：`bun run build`
- **构建环境变量**：`CLOUDFLARE_ENV=production`（将 `[env.production]` 块写入 `dist/server/wrangler.json`）、
  `VITE_R2_PUBLIC_ASSETS_DOMAIN`, `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`,
  `VITE_PUBLIC_POSTHOG_HOST`
- **部署命令**：`bun run deploy:production` — 扁平化迁移 → `wrangler d1 migrations apply DB --env=production --remote` → `wrangler deploy`。普通的 `wrangler deploy` 会通过 `.wrangler/deploy/config.json` 读取扁平化后的 `dist/server/wrangler.json`；`--env` 标志只影响读取源 `wrangler.jsonc` 的迁移步骤。

若要从本地检出手动部署：

```bash
# Generate Worker types from wrangler.jsonc
bun cf:typegen

# Deploy to production (typegen, CLOUDFLARE_ENV=production build, migrate, wrangler deploy)
bun cf:deploy:prd
```

## 数据库迁移

远程数据库使用 `wrangler d1 migrations apply` 进行迁移（记录在 wrangler 的 `d1_migrations` 表中）。drizzle-kit 只负责**生成**迁移（`bun db:generate`），绝不会接触远程数据库。

由于 drizzle-kit 会生成 wrangler 无法读取的嵌套 `<timestamp>_<name>/migration.sql` 文件，`scripts/flatten-migrations.ts` 会先将它们转换为扁平的 `drizzle/migrations-wrangler/*.sql`（已被 gitignore 忽略）。相关脚本会自动执行这一步：

```bash
bun run deploy             # flatten → wrangler d1 migrations apply DB --remote → wrangler deploy
                           # (what Deploy to Cloudflare button clones run)
bun run deploy:production  # same, but --env=production on the migrate step
                           # (what upstream's Workers Builds runs)
bun db:migrate:prd         # flatten → wrangler d1 migrations apply DB --env=production --remote
```

- **按钮部署**：`deploy` package 脚本会被选作部署命令，并在每次推送时重新运行，因此新迁移会以幂等方式应用。脚本引用绑定名称 `DB`（而非数据库名称），所以无论用户如何命名数据库都能正常工作。
- **上游生产环境（Workers Builds）**：配置的部署命令是 `deploy:production`，它与 `deploy` 完全相同，唯一区别是迁移步骤以 `[env.production]` D1 为目标。
- **PR 预览**：CI 将 PR 的数据库 ID 写入配置后，使用 `wrangler d1 migrations apply DB --remote` 应用迁移。
- **本地开发 / e2e**：保持不变，drizzle-orm 的迁移器会直接针对 Miniflare 绑定应用嵌套文件（`bun db:migrate:local`）。

在迁移与部署之间的短暂时间内，迁移必须保持向后兼容；D1 重建表时的 CASCADE 陷阱（参阅 CLAUDE.md）适用于所有远程应用路径。

## 填充种子数据

CI 中没有种子数据步骤：worker 会在首次请求时自行填充系统模板（`src/server.ts` → `src/platform/server/db/seed-system-templates.ts`）。模板定义的哈希存储在 `app_metadata` 中；哈希匹配时，每个 isolate 只需执行一次 SELECT 检查；哈希不匹配时（全新数据库，或部署更改了模板），会运行一次幂等同步。`bun db:seed:local` / `bun scripts/seed.ts --test` 在本地设置中复用同一模块。

## 密钥

密钥通过 `wrangler secret bulk` 推送到 Worker。完整列表定义在 [`.github/workflows/deploy-cloudflare.yml`](https://github.com/openstory-so/openstory/blob/main/.github/workflows/deploy-cloudflare.yml) 中。核心密钥包括：

| 变量                                        | 说明                                                        |
| ------------------------------------------- | ----------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                        | Better Auth 签名密钥                                        |
| `VITE_APP_URL`                              | 部署的公共 URL                                              |
| `FAL_KEY`                                   | 用于图像/视频生成的 fal.ai API 密钥                         |
| `OPENROUTER_KEY`                            | 用于 LLM 脚本分析的 OpenRouter API 密钥                     |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 凭据                                           |
| `EMAIL_FROM`                                | 事务邮件的发件人地址（域名已接入 Cloudflare Email Service） |

## 生产数据库切换（velro-prd → openstory-prd）

#897 的一次性操作手册：生产 D1 创建于项目更名前（账户中仍将其称为 `velro-prd`），其迁移历史保存在 drizzle 的 `__drizzle_migrations` 表中，而 wrangler 不会读取该表。D1 不支持重命名，因此迁移需要重建数据库；这样也能让新数据库获得完全原生的 `d1_migrations` 历史，无需设置基线：

```bash
# 1. Snapshot (also the import source). Quiet window: writes after this are lost.
bunx wrangler d1 export velro-prd --remote --output=backup.sql

# 2. Create the fresh DB and flip wrangler.jsonc to it FIRST:
#    set [env.production].d1_databases[0].database_id to the new DB's id
#    (keep database_name openstory-prd). Unlike `d1 export`/`execute`,
#    `d1 migrations apply` resolves ONLY from wrangler config — it can't
#    look a database up by name, and without the flip `--env=production`
#    would target the old velro id.
bunx wrangler d1 create openstory-prd
# ... edit wrangler.jsonc ...

# 3. Apply all migrations to the empty DB (rebuild-pattern migrations in our
#    history are CASCADE-safe with no rows). Same command prod CI runs:
bun db:migrate:prd

# 4. Data-only import. Three transforms on the raw export:
#    - drop drizzle's tracking rows (that table doesn't exist in the new DB —
#      wrangler's d1_migrations replaces it)
#    - reorder tables parent-first: D1 ingests large files in multiple
#      internal transactions, the dump's single leading
#      `PRAGMA defer_foreign_keys=TRUE` doesn't span them, and the export's
#      alphabetical order (`account` before `user`) fails at a chunk commit
#      with "FOREIGN KEY constraint failed" and rolls the import back.
#      Parent-first order needs no deferral, so chunking can't break it.
bunx wrangler d1 export velro-prd --remote --no-schema --output=data-raw.sql
grep -v '__drizzle_migrations' data-raw.sql > data.sql
bun scripts/reorder-d1-dump.ts data.sql data-ordered.sql
bunx wrangler d1 execute openstory-prd --remote --file=data-ordered.sql

# 5. Commit the wrangler.jsonc flip, merge, deploy. The deploy's
#    `wrangler d1 migrations apply` reports everything already applied.

# 6. Soak, then delete the old DB:
bunx wrangler d1 delete velro-prd
```

**合并顺序很重要：**请先执行本操作手册至第 4 步，再合并包含 ID 切换的 PR。先合并不会造成破坏：wrangler 会在旧数据库中看到空的 `d1_migrations`，迁移 #1 的 `CREATE TABLE` 会因表已存在而失败，文件随之回滚，CI 会明确报错，同时此前的部署仍继续提供服务；但在切换完成前，后续部署都会被阻塞。

现有 PR 预览数据库同样只有 drizzle 跟踪记录。请关闭并重新打开 PR，以获得一个由 wrangler 跟踪的全新预览数据库。

## CI/CD

推送到 `main` 的生产版本通过 Workers Builds 部署（参阅上文[构建与部署](#构建与部署)）。[`deploy-cloudflare.yml`](https://github.com/openstory-so/openstory/blob/main/.github/workflows/deploy-cloudflare.yml) 负责 PR 预览；预览继续使用 GitHub Actions，因为 Workers Builds 的分支预览会共享生产绑定，无法为每个 PR 单独预配 D1、无法对工作流名称进行命名空间隔离，也无法在关闭时拆除资源：

- **PR 预览**：每个 PR 都会获得独立的 Worker（`pr-<number>`）和 D1 数据库（`openstory-pr-<number>`），同时推送密钥，并将预览 URL 作为 PR 评论发布。预览环境还会获得带命名空间的工作流（`*-pr-<number>`）和视频导出容器应用（`pr-<number>-videoexportcontainer`）。
- **清理**：关闭 PR 时会删除 Worker、带命名空间的工作流、容器应用和 D1 数据库。容器应用属于账户级资源，生命周期长于 worker；若跳过删除，会阻止重新打开的 PR 再次部署，并持续累积已预配实例（参阅 #1052）。

## 平台检测

OpenStory 会自动检测部署平台：

```typescript
import { getDeploymentPlatform } from '@/shared/utils/environment';

const platform = getDeploymentPlatform();
// Returns: 'cloudflare' | 'local' | 'unknown'
```
