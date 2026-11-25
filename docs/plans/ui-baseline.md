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

## 4. e2e 基线（❌ spec 漂移已修复，仍有 11 failed + full 超时，未伪造通过）

### 4.1 端口重生源判定与隔离方案

只读排查：`crontab -l` → `no crontab for ubuntu`；`systemctl --user list-timers` 只有
`launchpadlib-cache-clean.timer`；`systemctl cat openstory.service` 命中重生源：

- `/etc/systemd/system/openstory.service`：`ExecStart=.../vite.js preview --host 127.0.0.1 --port 3001`，
  `Restart=always`、`RestartSec=5`、`enabled`，即 kill 后约 1 秒重生的来源（PID 1120342，
  `Main PID` 由 systemd 托管，PPID=1 是 reparent 结果）。它是有意安装的本项目预览服务，
  **不是可确认的残留脚本，故未 stop / disable**。
- 替代方案（已落盘）：新增 `e2e/config.ts` 导出 `E2E_PORT`（默认 3001，CI 不变）、`TEST_BASE_URL`；
  `playwright.config.ts` 的 `baseURL` / webServer `port` / `PORT` / `VITE_APP_URL` 全部走该变量，
  所有 Node 侧 fixture 的 `/api/test/*` URL 同步改走 `TEST_BASE_URL`；本地显式 `E2E_PORT=3002`
  启动带 `E2E_TEST=true` 的独立 dev server。另清掉了卡死会话遗留在 :3002 上的旧 server
  （其 env 带 `E2E_FULL_PIPELINE=true`，会被 `reuseExistingServer` 误复用）。
- 前一位 agent 的 spec 漂移修复已核实：`e2e/tests/*.spec.ts` 等 16 个 e2e 文件中，英文旧选择器
  （`getByLabel('Email')`、`Tell your whole story`、`Paste a screenplay`、`Sign in` 等）
  grep 无残留，中文选择器（`邮箱`、`讲完整你的故事`、`生成图片`、`登录以继续` 等）已就位。

### 4.2 本轮重跑结果（E2E_PORT=3002，node 24 / bun 1.4.2）

| 命令                     | 退出码     | 实测结果                                                                                                  |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------------- |
| `bun run test:e2e:setup` | **0**      | 测试 D1 迁移 + seed 成功（`✅ migrations applied`、`🎉 Database seeded successfully!`）                   |
| `bun run test:e2e`       | **1**      | 79 tests / 2 workers：**66 passed、11 failed、2 skipped（29.4m）**                                        |
| `bun run test:e2e:full`  | **未验证** | 2 tests：setup passed；full-sequence 触发 30 分钟用例上限，runner 卡在收尾、无最终汇总，38 分钟后终止进程 |

主跑 8 个 spec 明细（来源 `playwright-report/index.html` 内嵌 report 的 `outcome` 字段）：

| spec                      | passed | failed | skipped |
| ------------------------- | ------ | ------ | ------- |
| `auth.setup.ts`           | 1      | 0      | 0       |
| `auth.spec.ts`            | 18     | 1      | 0       |
| `full-sequence.spec.ts`   | 0      | 0      | 1       |
| `locations.spec.ts`       | 10     | 0      | 0       |
| `manual-pipeline.spec.ts` | 0      | 1      | 0       |
| `sequence-flow.spec.ts`   | 1      | 2      | 1       |
| `sequences.spec.ts`       | 12     | 0      | 0       |
| `studio.spec.ts`          | 9      | 0      | 0       |
| `talent.spec.ts`          | 15     | 7      | 0       |
| **合计**                  | **66** | **11** | **2**   |

`full-sequence.spec.ts` 在主跑中因 `!fullPipeline` 被 skip，由 `test:e2e:full` 单独覆盖；
`sequence-flow.spec.ts` 的 skip 为 `testWithUser.describe.skip('Empty States')`。
日志留档：`/tmp/opencode/e2e-setup-3002.log`、`/tmp/opencode/e2e-main-3002.log`、
`/tmp/opencode/e2e-full-3002.log`。

### 4.3 逐条失败清单（本轮 11 failed）

| #   | spec / 用例                                                                        | 错误摘要                                                                                          |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | `auth.spec.ts:16` anonymous visitor lands in the app, not a marketing page         | `Test timeout of 60000ms exceeded` + `Tearing down "context" exceeded`；页面快照已渲染中文 shell  |
| 2   | `manual-pipeline.spec.ts:82` full manual CRUD path                                 | `waitForHydration()` 的 `page.waitForFunction` 30s 超时（test-utils.ts:86）                       |
| 3   | `sequence-flow.spec.ts:60` can create sequence with suggested talent               | `getByRole('button',{name:/生成/i})` strict mode 命中 4 个元素（生成设置 / 匹配剧本等）           |
| 4   | `sequence-flow.spec.ts:176` can select variant from grid                           | `getByRole('dialog')` 2s 未出现；`toPass` 20s 超时，变体弹窗始终未打开                            |
| 5   | `talent.spec.ts:120` can create talent from a photo                                | `[data-testid=subject-kind]` 15s 未找到；快照显示上传项 `失败 / R2 upload failed with status 404` |
| 6   | `talent.spec.ts:144` detects an uploaded character sheet                           | `设定图` 文案 15s 未找到；同样是 `R2 upload failed with status 404`                               |
| 7   | `talent.spec.ts:171` classifies a creature as Other                                | `[data-testid=subject-kind]` 期望 `其他`，元素未找到（上传未成功）                                |
| 8   | `talent.spec.ts:191` Generate from photos fills description from vision            | `[data-testid=subject-kind]` 期望 `动画角色`，元素未找到（上传未成功）                            |
| 9   | `talent.spec.ts:218` blocks create until portrait rights are attested              | `[data-testid=subject-kind]` 期望 `真人`，元素未找到（上传未成功）                                |
| 10  | `talent.spec.ts:238` blocks a human photo without an authorization basis           | `[data-testid=subject-kind]` 期望 `真人`，元素未找到（上传未成功）                                |
| 11  | `talent.spec.ts:343` photo create uses the same dialog and auto-selects the talent | `[data-testid=subject-kind]` 期望 `真人`，元素未找到（上传未成功）                                |

`test:e2e:full` 单独说明：setup 用例通过；full-sequence 用例 11:00:02 开始，11:29:58 生成失败截图，
但 runner 未输出最终用例错误/汇总（卡在收尾），11:36 终止进程。按红线记为**超时未验证通过**，
不计为 green。未伪造通过。

### 4.4 剩余根因归类

1. **已解除**：原两条硬阻塞（:3001 preview 复用导致 `/api/test/*` 404；spec 英文文案漂移）
   均已由端口隔离 + 中文选择器修复消除——setup 通过，59 did not run 降为 2 条主动 skip。
2. **图片上传链路（7 条 talent 失败）**：页面快照显示 `R2 upload failed with status 404`，
   上传成功后才出现的 `subject-kind` / `设定图` 断言因此全部超时。属应用/R2 测试路由问题，
   不是英文选择器残留；本轮边界不改 `src/` 与 mock 之外的代码，未处理。
3. **定位器与时序（4 条）**：`/生成/i` 在中文 UI 下命中多个按钮需收紧；变体弹窗 20s 未打开；
   `waitForHydration` 的 React props fiber 探测在 manual-pipeline 页面上超时；auth 首例 60s
   用例超时（含 context teardown）。均需逐条调 spec/调试，未伪造通过。

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

| #   | 阻塞                                    | 本轮状态                                                                                                                                                                                                                  |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 文档未纳入版本管理 / `format:check` = 1 | ✅ **已解除**：commit `13ccea641…`，`format:check` = 0                                                                                                                                                                    |
| 2   | e2e 因 :3001 陈旧 preview 失败          | ⚠️ **阻塞降级但未解除**：重生源为 enabled 的 `openstory.service`（`Restart=always`），未 stop；改用 `E2E_PORT=3002` 后 404 与英文 spec 漂移已消除，重跑 66 passed / 11 failed / 2 skipped；`test:e2e:full` 超时未验证通过 |
| 3   | Chromatic 无本地 token / 无 CI 工作流   | ⏸ **已知外部依赖**：标为 P1 条件性依赖，验收放到有 Chromatic 的 CI；本轮不解决                                                                                                                                            |
| 4   | 环境偏差                                | ℹ️ 本地 bun 1.4.2 / node 24.22.3 vs CI bun 1.3.14；本机默认 node 18 会挂，已按要求切 PATH                                                                                                                                 |

## 7. 「基线已锁定」判定（逐条对照方案 §9，本轮复核）

| §9 条目                                                                                           | 判定             | 依据                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| 1. 源码树 SHA / 工作树态 / 冻结路径 diff=0                                                        | ✅               | 源码基线 `d5eec391…`；冻结路径 diff 退出码 0；工作树干净；文档提交 `13ccea641…`                              |
| 2. 暗色 Chromatic 基线（全量比对零差异、build accepted）                                          | ⏸ **条件性依赖** | 本地无 token、无 CI 工作流；暗色零差异验收由 CI 提供，不阻塞 P1 代码改动，但阻塞 P1 最终验收                 |
| 3. 单测基线 4708 通过、0 failed；视频按钮 7/7                                                     | ✅               | 实测 4708/4708 passed；契约 1 文件 7/7 passed                                                                |
| 4. e2e 8 spec 全绿 + `test:e2e:full`                                                              | ❌               | 本轮 66 passed / 11 failed / 2 skipped（29.4m）；`test:e2e:full` 30 分钟上限触发、无最终汇总，超时未验证通过 |
| 5. 视频按钮契约 + 三文件 sha256 存档                                                              | ✅               | 7/7 + sha256 已记录于本文 §3                                                                                 |
| 6. 亮色基线预留（登记 `globals.theme='light'`）                                                   | ✅               | 已登记，本阶段不出截图，P1 生成                                                                              |
| 7. 静态门禁（db:check / db:generate 无 drift / typecheck / lint / format:check / dead-code 全 0） | ✅               | 六项全 0；`format:check` 本轮由 1 修到 0                                                                     |
| 归档（SHA / build ID / 测试总数 / sha256）                                                        | ⚠️ 部分          | SHA、4708、sha256、story 清单、文档提交 SHA 已归档；Chromatic build ID 因外部依赖缺失                        |
| `ui-unification.md` 纳入版本管理                                                                  | ✅               | commit `13ccea641…` 已纳入，4 份文档全部 tracked                                                             |

**结论：基线仍未锁定 → 不满足 P1 开工条件。** §9 明确「任何一项不满足，禁止 P1 开工」。
本轮已解除文档纳入版本管理、`format:check`、以及 e2e 的原两条硬阻塞（端口 404 / 英文 spec 漂移），
但 **§9 第 4 项（e2e 全绿）仍不满足**：11 failed + full 超时未验证通过。第 2 项为条件性依赖、尚未在 CI 兑现。

还差什么（按优先级）：

1. **e2e 11 failed 逐条清零（硬阻塞）**：7 条 talent 失败源于 `R2 upload failed with status 404`
   （需 QA/开发修复测试环境的 R2 上传链路）；4 条为定位器/时序问题（`/生成/i` 歧义、变体弹窗未打开、
   hydration 探测超时、auth 首例 60s 超时）。修复后需在 `E2E_PORT=3002` 下全量重跑。
2. **`test:e2e:full` 取得最终结果（硬阻塞）**：本轮 30 分钟用例上限触发且 runner 卡在收尾；
   需排查长 workflow 是否因 aimock 未命中而挂起，并在有超时保护的环境中重跑，拿到明确 pass/fail。
3. **Chromatic CI 集成（条件性依赖）**：接入 CI 工作流并做一次暗色全量比对（绕过 `onlyChanged:true`），
   取得 accepted build；P1 代码改动可先做，但 P1 验收必须在该 CI 环境完成。
4. **版本偏差**：如 PM 要求与 CI 完全等价，需在 bun 1.3.14 环境复跑门禁（当前为 1.4.2 / node 24.22.3）。

> 红线遵守情况：未修改 `src/`、`.storybook/`、`package.json`、`wrangler.jsonc`、
> `chromatic.config.json`、`vite.config.ts`；未读取/输出任何 token 或 `.env.local` 内容；
> 未 stop 系统服务 `openstory.service`，仅清理卡死会话遗留在 :3002 的 test server 与挂起的 runner；
> 未 push、未 force push、未 reset --hard；按本轮授权范围改了 `e2e/*` 与 `playwright.config.ts`。

## 8. P3 组件层重锁（2026-11-25）

P3 要求在 `filmmaking-panel.tsx` 的**非冻结区**替换状态标签、阶段进度、固定高度、
整卡 onClick，并接入 `ShotActionButton` 外包。父会话裁决采用方案 B：允许改非冻结区，
并用「冻结逻辑区逐字哈希」守护防重复扣费，**不再以整个文件的 sha256 不变作为判据**。

| 文件 / 区域                                                                | P0 sha256（原）                                                    | P3 sha256（现）                                                    | 结论                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------- |
| `src/stories/ui/filmmaking-panel.tsx`（全文件）                            | `56eaabbae3ef64e692551b11d11929ba74bb6a0b0fd8fd8b38fadcf4909e8f28` | `d6679b1a0f1e8c2416d4bce431e9ddada2c0323064c06189a87b44d9af994fec` | 因非冻结区改造而**变更**（预期） |
| **冻结逻辑区**（`/** Mirror of generateVideoFn` → `ShotVideoButton` 结束） | `ffa1cf1ae5d030bb2c23a52afe50e77c01ec72b96fcdee029a4fe4dd4b66d9af` | `ffa1cf1ae5d030bb2c23a52afe50e77c01ec72b96fcdee029a4fe4dd4b66d9af` | **逐字一致**（核心判据）         |
| `src/stories/ui/filmmaking-panel.test.tsx`                                 | `afd37ed42b0c559c30b4e9d6be5e4fe3695c25cdaaff8f1be35b79211dcaff92` | `afd37ed42b0c559c30b4e9d6be5e4fe3695c25cdaaff8f1be35b79211dcaff92` | **未变**                         |
| `src/stories/ai-filmmaking.fn.ts`                                          | `9bcb598d68e7d46f3139ac58500c0995a798dd9850a87e2e9e3be21a4e9248ec` | `9bcb598d68e7d46f3139ac58500c0995a798dd9850a87e2e9e3be21a4e9248ec` | **未变**                         |

复核命令（可从任意 HEAD 复算）：

```bash
# 冻结逻辑区（不依赖行号，避免上方改动造成偏移）
awk '/^\/\*\* Mirror of generateVideoFn/{f=1} /^interface FilmmakingPanelProps/{f=0} f' \
  src/stories/ui/filmmaking-panel.tsx | sha256sum
# 另两个冻结文件
sha256sum src/stories/ui/filmmaking-panel.test.tsx src/stories/ai-filmmaking.fn.ts
```

`ShotActionButton`（`src/ui/shot-action-button.tsx`）只在 `ShotVideoButton` 外包一层
`<fieldset aria-label>`（i18n 文案 + 缺 key 回退中文）、`data-toast-id` 与焦点恢复；
props 原样透传，回调签名不变，视频逻辑与扣费判断全部留在未改动的冻结区内。
P3 新增 9 条外包/公共组件单测，`bun run test` 实测 439 文件 / 4717 用例全绿
（4708 基线 + 9），契约 7/7 与 `ai-filmmaking.video.test.ts` 5/5 逐条通过。
