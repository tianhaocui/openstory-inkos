# UI/UX 重构 — P0 基线冻结记录

> 本文件是 P0 阶段的**事实记录**，不含设计决策。P0 不改 `src/`、`.storybook/`、`package.json`、
> `chromatic.config.json`、`vite.config.ts`。方案判定标准见 `docs/plans/ui-unification.md` §9。

## 0. 元信息

| 项                   | 实际值                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 源码基线 commit SHA  | `d5eec391941edcbd245f0115185eedbc598f4ce4`（`fix: wire single-shot video generation button in filmmaking panel`）                                         |
| 文档提交 SHA（本轮） | `13ccea641318b8c9fb845dc83df4e6ca678ecba0`（`docs: lock UI refactor baseline and plan`，4 份计划文档纳入版本管理）                                        |
| 记录时间（UTC）      | 首轮 2026-11-25T07:13:49Z（约 06:56–07:14）；本轮复核约 07:16–07:35                                                                                       |
| 执行人               | developer agent                                                                                                                                           |
| 远端                 | `origin = https://github.com/tianhaocui/openstory-inkos.git`；`upstream = https://github.com/openstory-so/openstory.git`                                  |
| 环境 PATH            | `export PATH=/home/ubuntu/.local/node-v24/bin:/home/ubuntu/.bun/bin:$PATH`                                                                                |
| 环境版本             | node `v24.22.3` / bun `1.4.2`；CI 固定 `bun-version: 1.3.14`（`.github/workflows/test.yml:32/94/128/229` 等）→ **存在版本偏差**，本地结果与 CI 不完全等价 |

### 推送结果（任务 1）

- 推送前：`git rev-parse HEAD` = `d5eec391…`，`main...origin/main [ahead 1]`；`git status --short` 仅见 PM 管理的三份文档变更，无密钥文件。
- `git push origin main` → 成功：`275601290..d5eec3919 main -> main`，退出码 0。
- `gh api repos/tianhaocui/openstory-inkos/commits/main --jq .sha` → `d5eec391941edcbd245f0115185eedbc598f4ce4`，**与当时本地 HEAD 一致**。

### 本轮文档提交与 format 修复（阻塞 1 解除）

- 4 份 md（`ui-unification.md`、`ui-project-status.md`、`ui-baseline.md`、`upstream-must-parity.md`）用
  `bunx oxfmt --write` 定点格式化（仅 md，无源码/配置写入），`git add` 后
  `git commit -m "docs: lock UI refactor baseline and plan"` → **退出码 0**，
  新 HEAD `13ccea641318b8c9fb845dc83df4e6ca678ecba0`。
- **未使用 `--no-verify`**：lefthook v2.1.12 的 pre-commit 正常执行，`format` hook 运行成功；
  lint / typecheck / dead-code / client-server-boundary / migration-safety / typegen-regen /
  workflow-trigger-safety 因暂存区只有 md 而 skip（符合预期）。
- 提交后 `bun run format:check` → **退出码 0**（`All matched files use the correct format.`，2003 文件），
  修复前为退出码 1（仅这 4 份 md 不合规）。
- **未 push**：复核结束时 `main...origin/main [ahead 1]`，远端仍停在 `d5eec391…`，由 PM 统一处理。

## 1. 源码树与文档态

| 检查                                  | 实际结果                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 源码基线 `git rev-parse HEAD`（首轮） | `d5eec391941edcbd245f0115185eedbc598f4ce4`                                                                          |
| 本轮文档提交后 HEAD                   | `13ccea641318b8c9fb845dc83df4e6ca678ecba0`                                                                          |
| `git status --short`（本轮提交后）    | **空（工作树干净）**                                                                                                |
| 冻结路径 diff                         | `git diff --exit-code -- src .storybook package.json chromatic.config.json vite.config.ts` → **退出码 0（无差异）** |
| `drizzle/migrations`                  | `db:generate` 后 `git status --short drizzle/migrations` 为空、无 diff、无未跟踪文件                                |
| 密钥文件                              | `git status --short` 中无 `.env` / token / key 类文件；全程未读取 `.env.local` 或任何 token                         |

文档态：**4 份文档已全部纳入版本管理**（commit `13ccea641…`，395 insertions）；本轮之前为
`ui-baseline.md` / `ui-project-status.md` / `ui-unification.md` untracked、`upstream-must-parity.md` modified。

首轮记录的 sha256（格式化/提交前内容，留档）：

| 文档                                 | 首轮 sha256                                                        |
| ------------------------------------ | ------------------------------------------------------------------ |
| `docs/plans/ui-unification.md`       | `2754305b5a78519a1370aad55250c92cf38124c144508929d1317d7045b4954a` |
| `docs/plans/ui-project-status.md`    | `d81abe383c8146dbe72c89eadc332b197ad6e30785bd3a11c08f7d6cedb6b07c` |
| `docs/plans/upstream-must-parity.md` | `e4ddbf28f0730e7d7823933bd5fa5fc6fd8b7eb2943407ffeb014548d889fb68` |

## 2. 静态门禁（实际退出码）

| 命令               | 退出码              | 实测输出要点                                                                           |
| ------------------ | ------------------- | -------------------------------------------------------------------------------------- |
| `bun db:check`     | **0**               | `Everything's fine 🐶🔥`                                                               |
| `bun db:generate`  | **0**               | `No schema changes, nothing to migrate 😴`；`drizzle/migrations` 无 diff               |
| `bun typecheck`    | **0**               | `tsgo --noEmit` 无输出                                                                 |
| `bun lint`         | **0**               | 113 条 `no-unnecessary-condition` **warning**，0 error（既有警告，非本次改动）         |
| `bun format:check` | **0**（本轮修复后） | `All matched files use the correct format.`（2003 文件）；修复前为 1，失败项仅 4 份 md |
| `bun dead-code`    | **0**               | 5 条 knip configuration hints，无未使用代码错误                                        |

> 本轮只写 md，未触碰任何代码/配置，故除 `format:check` 外其余门禁沿用首轮实测结果且仍然成立。

## 3. 单测基线

| 命令                                                    | 退出码 | 实测结果                                                                                                      |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `bun run test`                                          | **0**  | **438 个测试文件通过（438/438）；4708 个测试通过（4708/4708）；0 failed、0 skipped**（Vitest 5.0.0，513.31s） |
| `bun run test src/stories/ui/filmmaking-panel.test.tsx` | **0**  | **1 文件通过；7/7 用例通过**（970ms）                                                                         |

> 用户口径 4708 与实际输出一致。视频按钮 7 条契约：completed/approved 可生成 · pending/queued/generating 三种 in-flight 禁用且零调用 · busy 禁用 · 未就绪禁用/无关键帧不渲染 · failed 终态可重试 · completed clip 优先播放且零生成。

### 冻结文件 sha256

| 文件                                       | sha256                                                             |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `src/stories/ui/filmmaking-panel.test.tsx` | `afd37ed42b0c559c30b4e9d6be5e4fe3695c25cdaaff8f1be35b79211dcaff92` |
| `src/stories/ui/filmmaking-panel.tsx`      | `56eaabbae3ef64e692551b11d11929ba74bb6a0b0fd8fd8b38fadcf4909e8f28` |
| `src/stories/ai-filmmaking.fn.ts`          | `9bcb598d68e7d46f3139ac58500c0995a798dd9850a87e2e9e3be21a4e9248ec` |

## 4. e2e 基线（❌ 重跑后仍阻塞，未伪造通过）

### 4.1 端口进程判定与重跑结果

按红线先判定归属：`ps -p 981854 -o pid,ppid,etimes,cmd` →
`981854 1 4979 /home/ubuntu/.hermes/node/bin/node /home/ubuntu/openstory/node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 3001`；
`/proc/981854/cwd -> /home/ubuntu/openstory`，启动于 05:53:03，PPID=1（孤儿）。
**结论：确属本项目残留 preview**（cmd/cwd 均指向 openstory，非用户其他服务），已 `kill 981854`，`ss` 确认 :3001 释放。

| 命令                                                                 | 退出码 | 实测结果                                                                                   |
| -------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `bun run test:e2e:setup`                                             | **0**  | 测试 D1 迁移 + seed 成功（`System templates up to date`，`Database seeded successfully!`） |
| `bun run test:e2e`（重跑 A：kill 981854 后）                         | **1**  | 79 tests / 4 workers：**2 passed、18 failed、59 did not run（3.0m）**                      |
| `bun run test:e2e`（重跑 B：kill 1097840、确认端口 FREE 后立刻重跑） | **1**  | 79 tests / 4 workers：**2 passed、18 failed、59 did not run（4.3m）**                      |
| `bun run test:e2e:full`                                              | **1**  | 2 tests：**1 failed（setup）、1 did not run**                                              |

- 首轮曾因 `chromium_headless_shell-1243` 缺失导致 20 failed / 59 did not run；已 `bunx playwright install chromium`
  安装到 `~/.cache/ms-playwright`（仓库外），本轮浏览器可用，失败原因已变为下述两项。
- 重跑 B 的 `[WebServer]` 日志显示 Playwright 自己的 `start-webserver.ts dev --port=3001` 已执行 migrate+seed 并成功，
  但错误结果与重跑 A 完全一致 → **不是单纯"复用了旧服务"**。

### 4.2 根因（两条独立问题，均未在 P0 内改动）

1. **:3001 被自动重生（auto-respawn）的孤儿 preview 长期占用**：除 `981854` 外，kill 后又在
   07:17:12 出现 `1097840`，随后 `1105008`、`1111866`、`1112026`（均为 PPID=1、
   cwd `/home/ubuntu/openstory`、cmd 同为 `vite preview --host 127.0.0.1 --port 3001`），
   每次 kill 后约 1 秒内即有新的同款 preview 抢占端口。`playwright.config.ts` 的
   `reuseExistingServer: !useBuiltServer` 在本地为 `true`，会复用它；该 preview **未带 `E2E_TEST=true`**，
   故 `testOnlyGuard`（`src/routes/api/test/route.ts:26`）按设计返回 404：
   `POST /api/test/user` → `Failed to create test user via API: 404`，`curl` 实测 `http=404 / Not Found`。
   继续 kill 只会触发重生，已停止 kill 循环，未改 `playwright.config.ts`、未换端口绕过。
2. **e2e spec 与当前应用代码已漂移（stale）**：auth.spec 期望的英文文案
   `Tell your whole story`、`Paste a screenplay, or a one-liner we can expand - not a prompt.`、`Sign in`、
   `Generate`、`getByLabel('Email')` 在 `src/` 中已**全部搜不到**；当前应用为 zh-CN / local story mode
   （`228df1332 feat: local story mode, zh i18n, InkOS integration and deploy config`）。
   e2e 目录最后一次提交为 `537281036`，早于 UI 改写 → 这些断言按当前代码必然失败。
   规范更新属测试/产品决策，超出 P0「只记录不改码」边界，本轮未改任何 spec。

### 4.3 逐条失败清单（重跑 B，18 failed）

| #   | spec / 用例                                                                              | 错误摘要                                                                                       |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | `auth.setup.ts:15` authenticate                                                          | `Failed to create test user via API: 404` → 后续 `chromium` project 59 用例未运行              |
| 2   | `auth.spec.ts:50` anonymous visitor can browse the shell without being redirected        | `getByRole('heading', {name:'Tell your whole story'})` element(s) not found（5s）              |
| 3   | `auth.spec.ts:12` anonymous visitor lands in the app, not a marketing page               | 同上英文营销标题未找到                                                                         |
| 4   | `auth.spec.ts:31` logged-out composer keeps a script box at 1280×720                     | `getByText('Paste a screenplay, or a one-liner we can expand - not a prompt.')` 未找到         |
| 5   | `auth.spec.ts:87` anonymous empty-prompt generate opens the login dialog (#1393)         | `getByRole('button',{name:'Generate',exact:true})` toBeEnabled 失败，元素未找到                |
| 6   | `auth.spec.ts:101` anonymous empty-script generate opens the login dialog (#1393)        | 同上 `Generate` 按钮未找到                                                                     |
| 7   | `auth.spec.ts:119` anonymous generate is intercepted by the login dialog                 | 同上 `Generate` 按钮未找到                                                                     |
| 8   | `auth.spec.ts:75` anonymous image generate is intercepted by the login dialog            | `locator.click` 30s 超时：等待 `getByRole('button',{name:'Generate image'})`                   |
| 9   | `auth.spec.ts:170` account-bound routes redirect anonymous users to login                | `getByLabel('Email')` 未找到（5s）                                                             |
| 10  | `auth.spec.ts:181` anonymous /sequences/new redirects to login                           | 登录表单元素未找到                                                                             |
| 11  | `auth.spec.ts:238` Authenticated User › can access sequences page                        | `Failed to create test user via API: 404`                                                      |
| 12  | `auth.spec.ts:147` anonymous enhance is intercepted by the login dialog and keeps intent | `getByRole('button',{name:/Enhance Script/i})` click 30s 超时；`browserContext.close` 30s 超时 |
| 13  | `auth.spec.ts:246` Authenticated User › can access create new sequence page              | `Failed to create test user via API: 404`                                                      |
| 14  | `auth.spec.ts:258` Authenticated User › session persists across navigation               | `Failed to create test user via API: 404`                                                      |
| 15  | `auth.spec.ts:252` Authenticated User › can access talent page                           | `Failed to create test user via API: 404`                                                      |
| 16  | `auth.spec.ts:205` login page is accessible                                              | `getByRole('button',{name:'Sign in'})` 未找到（5s）                                            |
| 17  | `auth.spec.ts:212` login page reveals the submit button once an email is entered         | `getByLabel('Email')` 未找到（5s / 15s）                                                       |
| 18  | `auth.spec.ts:278` Email OTP Flow › email input validates email format                   | `locator.fill` 30s 超时：等待 `getByLabel('Email')`                                            |

> 另有 59 did not run（全部为依赖 `setup` 的 `chromium` project：`full-sequence`、`locations`、
> `manual-pipeline`、`sequence-flow`、`sequences`、`studio`、`talent`）。未伪造通过，未改
> `playwright.config.ts`。日志留档：`/tmp/opencode/e2e-main.log`、`/tmp/opencode/e2e-main-2.log`、
> `/tmp/opencode/e2e-full.log`。
>
> 登记待改（P2）：`playwright.config.ts:45` 的 `colorScheme: 'dark'` 本阶段不动。

## 5. Storybook / Chromatic

| 项                        | 实际结果                                                                                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| story 文件                | `find src -name '*.stories.tsx' \| sort` → **29 个**（清单见下）                                                                                                                                                                                                              |
| `bun run build-storybook` | **退出码 0**，`Storybook build completed successfully`，输出到 `storybook-static/`（gitignored）；仅有 chunk >500kB 的性能提示                                                                                                                                                |
| Chromatic 本地运行        | **阻塞 / 待 CI 外部集成**：`chromatic.config.json` 为 `onlyChanged: true`、`projectId: Project:693a69551bb19815e4221ba6`、`zip: true`；`.github/workflows/` 中未发现 Chromatic 工作流，本地未读取或输出任何 token / `.env.local` 内容；暗色全量比对与 `accepted` 基线尚未取得 |

> **Chromatic 条件性依赖（本轮明确）**：Chromatic 暗色基线由 **CI 外部集成提供，本地无法锁定**；
> P1 暗色零差异门禁**依赖 CI 执行**。该项不作为 P1 代码改动的前置条件，但 **P1 验收必须在有
> Chromatic 的 CI 环境完成**（需先补 CI 集成，并在 `onlyChanged:true` 下额外做一次全量比对）。

Story 清单（29）：

```text
src/billing/ui/low-balance-toast.stories.tsx
src/look/ui/aspect-ratio-select.stories.tsx
src/look/ui/style-category-select.stories.tsx
src/look/ui/style-selection-dialog.stories.tsx
src/look/ui/style-selector-button.stories.tsx
src/look/ui/style-selector.stories.tsx
src/motion/ui/scene-player.stories.tsx
src/motion/ui/video-player.stories.tsx
src/motion/ui/video-state-overlay.stories.tsx
src/sequences/ui/eval/eval-sequence-metadata.stories.tsx
src/sequences/ui/failure-summary-banner.stories.tsx
src/sequences/ui/generation/generation-progress-banner.stories.tsx
src/sequences/ui/generation/generation-stop-alert.stories.tsx
src/sequences/ui/generation/generation-stop-slider.stories.tsx
src/sequences/ui/script/script-editor.stories.tsx
src/sequences/ui/script/script-view.stories.tsx
src/shots/ui/divergence-compare-dialog.stories.tsx
src/shots/ui/motion-dialogue-panel.stories.tsx
src/shots/ui/optimised-prompt-panel.stories.tsx
src/shots/ui/prompts/prompt-diff-view.stories.tsx
src/shots/ui/prompts/prompt-history-sheet.stories.tsx
src/shots/ui/scene-list-item.stories.tsx
src/shots/ui/scene-list.stories.tsx
src/shots/ui/scene-script-prompts.stories.tsx
src/shots/ui/scene-thumbnail.stories.tsx
src/shots/ui/scenes-view.stories.tsx
src/shots/ui/staleness/divergent-alternate-banner.stories.tsx
src/shots/ui/staleness/staleness-indicator.stories.tsx
src/ui/text-editor/markdown-editor.stories.tsx
```

亮色基线预留：本阶段不产出截图，仅登记触发方式 `globals.theme='light'`，由 P1 生成。

## 6. 阻塞项清单（本轮复核）

| #   | 阻塞                                    | 本轮状态                                                                                                                                                                                              |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 文档未纳入版本管理 / `format:check` = 1 | ✅ **已解除**：commit `13ccea641…`，`format:check` = 0                                                                                                                                                |
| 2   | e2e 因 :3001 陈旧 preview 失败          | ❌ **升级为硬阻塞**：kill 后 preview 自动重生（981854→1097840→1105008→1111866→1112026），且 spec 断言与 zh-CN 应用已漂移；重跑仍 18 failed / 59 did not run，`test:e2e:full` 1 failed / 1 did not run |
| 3   | Chromatic 无本地 token / 无 CI 工作流   | ⏸ **已知外部依赖**：标为 P1 条件性依赖，验收放到有 Chromatic 的 CI；本轮不解决                                                                                                                        |
| 4   | 环境偏差                                | ℹ️ 本地 bun 1.4.2 / node 24.22.3 vs CI bun 1.3.14；本机默认 node 18 会挂，已按要求切 PATH                                                                                                             |

## 7. 「基线已锁定」判定（逐条对照方案 §9，本轮复核）

| §9 条目                                                                                           | 判定             | 依据                                                                                         |
| ------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| 1. 源码树 SHA / 工作树态 / 冻结路径 diff=0                                                        | ✅               | 源码基线 `d5eec391…`；冻结路径 diff 退出码 0；工作树干净；文档提交 `13ccea641…`              |
| 2. 暗色 Chromatic 基线（全量比对零差异、build accepted）                                          | ⏸ **条件性依赖** | 本地无 token、无 CI 工作流；暗色零差异验收由 CI 提供，不阻塞 P1 代码改动，但阻塞 P1 最终验收 |
| 3. 单测基线 4708 通过、0 failed；视频按钮 7/7                                                     | ✅               | 实测 4708/4708 passed；契约 1 文件 7/7 passed                                                |
| 4. e2e 8 spec 全绿 + `test:e2e:full`                                                              | ❌               | 重跑 A/B 均 18 failed / 59 did not run（2 passed）；`test:e2e:full` 1 failed / 1 did not run |
| 5. 视频按钮契约 + 三文件 sha256 存档                                                              | ✅               | 7/7 + sha256 已记录于本文 §3                                                                 |
| 6. 亮色基线预留（登记 `globals.theme='light'`）                                                   | ✅               | 已登记，本阶段不出截图，P1 生成                                                              |
| 7. 静态门禁（db:check / db:generate 无 drift / typecheck / lint / format:check / dead-code 全 0） | ✅               | 六项全 0；`format:check` 本轮由 1 修到 0                                                     |
| 归档（SHA / build ID / 测试总数 / sha256）                                                        | ⚠️ 部分          | SHA、4708、sha256、story 清单、文档提交 SHA 已归档；Chromatic build ID 因外部依赖缺失        |
| `ui-unification.md` 纳入版本管理                                                                  | ✅               | commit `13ccea641…` 已纳入，4 份文档全部 tracked                                             |

**结论：基线仍未锁定 → 不满足 P1 开工条件。** §9 明确「任何一项不满足，禁止 P1 开工」。
本轮已解除文档纳入版本管理与 `format:check` 两项，但 **§9 第 4 项（e2e 全绿）仍不满足**，
第 2 项为条件性依赖、尚未在 CI 兑现。

还差什么（按优先级）：

1. **e2e 基线转绿（硬阻塞）**：需 PM/QA 决策并处理 :3001 上自动重生的 preview（提供不带该服务的
   CI/干净环境，或由环境负责人停止重生源），并让 e2e spec 与 zh-CN / local story mode 当前 UI 对齐
   （更新或重录断言）。本 agent 在 P0 边界内不改 `playwright.config.ts`、不改 spec、不换端口绕过，
   也不继续 kill 进程（会被立即重生）。
2. **Chromatic CI 集成（条件性依赖）**：接入 CI 工作流并做一次暗色全量比对（绕过 `onlyChanged:true`），
   取得 accepted build；P1 代码改动可先做，但 P1 验收必须在该 CI 环境完成。
3. **版本偏差**：如 PM 要求与 CI 完全等价，需在 bun 1.3.14 环境复跑门禁（当前为 1.4.2 / node 24.22.3）。

> 红线遵守情况：未修改 `src/`、`.storybook/`、`package.json`、`chromatic.config.json`、
> `vite.config.ts`；未读取/输出任何 token 或 `.env.local` 内容；仅 kill 了经归属确认的本项目残留
> preview；未 push、未 force push、未 reset --hard；未改 `playwright.config.ts` 或任何 e2e spec。
