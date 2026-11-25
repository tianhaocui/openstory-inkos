# UI/UX 重构 — P0 基线冻结记录

> 本文件是 P0 阶段的**事实记录**，不含设计决策。P0 不改 `src/`、`.storybook/`、`package.json`、
> `chromatic.config.json`、`vite.config.ts`。方案判定标准见 `docs/plans/ui-unification.md` §9。

## 0. 元信息

| 项              | 实际值                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基线 commit SHA | `d5eec391941edcbd245f0115185eedbc598f4ce4`（`fix: wire single-shot video generation button in filmmaking panel`）                                         |
| 记录时间（UTC） | 2026-11-25T07:13:49Z（记录期间约 06:56–07:14 UTC）                                                                                                        |
| 执行人          | developer agent                                                                                                                                           |
| 远端            | `origin = https://github.com/tianhaocui/openstory-inkos.git`；`upstream = https://github.com/openstory-so/openstory.git`                                  |
| 环境 PATH       | `export PATH=/home/ubuntu/.local/node-v24/bin:/home/ubuntu/.bun/bin:$PATH`                                                                                |
| 环境版本        | node `v24.22.3` / bun `1.4.2`；CI 固定 `bun-version: 1.3.14`（`.github/workflows/test.yml:32/94/128/229` 等）→ **存在版本偏差**，本地结果与 CI 不完全等价 |

### 推送结果（任务 1）

- 推送前：`git rev-parse HEAD` = `d5eec391…`，`main...origin/main [ahead 1]`；`git status --short` 仅见 PM 管理的三份文档变更，无密钥文件。
- `git push origin main` → 成功：`275601290..d5eec3919 main -> main`，退出码 0。
- `gh api repos/tianhaocui/openstory-inkos/commits/main --jq .sha` → `d5eec391941edcbd245f0115185eedbc598f4ce4`，**与本地 HEAD 一致**。

## 1. 源码树与文档态

| 检查                           | 实际结果                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `git rev-parse HEAD`           | `d5eec391941edcbd245f0115185eedbc598f4ce4`                                                                          |
| `git status --short`（记录时） | ` M docs/plans/upstream-must-parity.md`；`?? docs/plans/ui-project-status.md`；`?? docs/plans/ui-unification.md`    |
| 冻结路径 diff                  | `git diff --exit-code -- src .storybook package.json chromatic.config.json vite.config.ts` → **退出码 0（无差异）** |
| `drizzle/migrations`           | `db:generate` 后 `git status --short drizzle/migrations` 为空、无 diff、无未跟踪文件                                |
| 密钥文件                       | `git status --short` 中无 `.env` / token / key 类文件；未读取 `.env.local` 或任何 token                             |

文档态（untracked / modified 均为 PM 在管内容，本 agent 未改动）：

| 文档                                 | git 态    | sha256                                                             |
| ------------------------------------ | --------- | ------------------------------------------------------------------ |
| `docs/plans/ui-unification.md`       | untracked | `2754305b5a78519a1370aad55250c92cf38124c144508929d1317d7045b4954a` |
| `docs/plans/ui-project-status.md`    | untracked | `d81abe383c8146dbe72c89eadc332b197ad6e30785bd3a11c08f7d6cedb6b07c` |
| `docs/plans/upstream-must-parity.md` | modified  | `e4ddbf28f0730e7d7823933bd5fa5fc6fd8b7eb2943407ffeb014548d889fb68` |

## 2. 静态门禁（实际退出码）

| 命令               | 退出码   | 实测输出要点                                                                                                                                               |
| ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun db:check`     | **0**    | `Everything's fine 🐶🔥`                                                                                                                                   |
| `bun db:generate`  | **0**    | `No schema changes, nothing to migrate 😴`；`drizzle/migrations` 无 diff                                                                                   |
| `bun typecheck`    | **0**    | `tsgo --noEmit` 无输出                                                                                                                                     |
| `bun lint`         | **0**    | 113 条 `no-unnecessary-condition` **warning**，0 error（既有警告，非本次改动）                                                                             |
| `bun format:check` | **1** ❌ | 仅 3 份 PM 在管文档不合规：`ui-project-status.md`、`ui-unification.md`、`upstream-must-parity.md`；2002 个文件中其余全部通过，**无 `src/` / 配置文件问题** |
| `bun dead-code`    | **0**    | 5 条 knip configuration hints，无未使用代码错误                                                                                                            |

> 差异备注：`format:check` 失败项全部是 PM 未纳入版本管理 / 未格式化的文档，非代码。按边界约束本 agent 未修改这些文档；需 PM 格式化并纳入版本管理后复跑至 0。

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

## 4. e2e 基线（❌ 阻塞，未伪造通过）

| 命令                                   | 退出码 | 实测结果                                                                                                                                      |
| -------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run test:e2e:setup`               | **0**  | 测试 D1 迁移 + seed 成功（`System templates up to date`，`Database seeded successfully!`）                                                    |
| `bun run test:e2e`（首跑）             | **1**  | 20 failed / 59 did not run；全部因 Playwright 浏览器缺失：`chromium_headless_shell-1243` 不存在（Playwright 1.63.0 需要，缓存仅有 1222/1248） |
| `bun run test:e2e`（安装浏览器后复跑） | **1**  | 79 tests / 4 workers：**2 passed、18 failed、59 did not run（3.0m）**                                                                         |
| `bun run test:e2e:full`                | **1**  | 2 tests：**1 failed（setup）、1 did not run**                                                                                                 |

环境修复（仓库外）：执行 `bunx playwright install chromium` 成功安装 chromium-1243 / chromium_headless_shell-1243 到 `~/.cache/ms-playwright`；未修改仓库文件。

**阻塞根因（端口冲突 / 陈旧服务）**：`:3001` 上已存在一个运行了约 1h14m 的进程
`PID 981854 /home/ubuntu/.hermes/node/bin/node /home/ubuntu/openstory/node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 3001`（node v22.23.2），
并非本次由 `e2e/start-webserver.ts` 以 `E2E_TEST=true` 启动的测试服务。`playwright.config.ts` 的
`reuseExistingServer: !useBuiltServer` 直接复用了它，导致：

- `POST /api/test/user` → **404**（`Failed to create test user via API: 404`，auth.setup 失败，依赖它的 `chromium` project 59 个测试未运行）；实测 `curl http://127.0.0.1:3001/api/test/user` → `http=404`（`Not Found`）。
- 首页缺少 `Tell your whole story` / `Paste a screenplay...` 等预期文案（陈旧构建）。

按红线未 kill 他人进程、未改 config、未换端口绕过。待占用 :3001 的服务释放后，在干净环境重跑三条命令即可取得真实基线。

### e2e spec 清单（8 个；`bunx playwright test --list`：79 tests in 9 files，含 1 个 setup）

| spec                                | 用例数 | 本次结果                                                                        |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `e2e/tests/auth.spec.ts`            | 19     | 2 passed / 17 failed（缺 `/api/test/user`，另有登录弹窗/文案定位失败）          |
| `e2e/tests/full-sequence.spec.ts`   | 1      | 未运行（`test:e2e` 59 did not run 之内）；`test:e2e:full` 中因 setup 失败未运行 |
| `e2e/tests/locations.spec.ts`       | 10     | 未运行（setup 失败，依赖阻塞）                                                  |
| `e2e/tests/manual-pipeline.spec.ts` | 1      | 未运行（同上）                                                                  |
| `e2e/tests/sequence-flow.spec.ts`   | 4      | 未运行（同上）                                                                  |
| `e2e/tests/sequences.spec.ts`       | 12     | 未运行（同上）                                                                  |
| `e2e/tests/studio.spec.ts`          | 9      | 未运行（同上）                                                                  |
| `e2e/tests/talent.spec.ts`          | 22     | 未运行（同上）                                                                  |

> 登记待改（P2）：`playwright.config.ts:45` 的 `colorScheme: 'dark'` 本阶段不动。

## 5. Storybook / Chromatic

| 项                        | 实际结果                                                                                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| story 文件                | `find src -name '*.stories.tsx' \| sort` → **29 个**（清单见下）                                                                                                                                                                                                              |
| `bun run build-storybook` | **退出码 0**，`Storybook build completed successfully`，输出到 `storybook-static/`（gitignored）；仅有 chunk >500kB 的性能提示                                                                                                                                                |
| Chromatic 本地运行        | **阻塞 / 待 CI 外部集成**：`chromatic.config.json` 为 `onlyChanged: true`、`projectId: Project:693a69551bb19815e4221ba6`、`zip: true`；`.github/workflows/` 中未发现 Chromatic 工作流，本地未读取或输出任何 token / `.env.local` 内容；暗色全量比对与 `accepted` 基线尚未取得 |

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

## 6. 阻塞项清单

1. **e2e 端口冲突 / 陈旧服务**：`:3001` 被非本次启动的 `vite preview`（PID 981854）占用，`/api/test/user` 返回 404，导致 `test:e2e` 18 failed / 59 did not run、`test:e2e:full` 1 failed / 1 did not run。未 kill 他人进程、未绕过。
2. **Chromatic**：需 token + 外部集成，本地无可用 token 且仓库内无 Chromatic 工作流；`onlyChanged: true` 下的暗色全量比对与 accepted 基线未取得。
3. **format:check 退出码 1**：仅三份 PM 在管文档格式不合规；代码与配置全部通过。需 PM 处理文档后复跑。
4. **环境偏差**：本地 bun 1.4.2 / node 24.22.3 vs CI bun 1.3.14；本机默认 node 18 会挂，已按要求切 PATH。

## 7. 「基线已锁定」判定（逐条对照方案 §9）

| §9 条目                                                                                           | 判定 | 依据                                                                                  |
| ------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| 1. 源码树 SHA / 工作树态 / 冻结路径 diff=0                                                        | ✅   | SHA `d5eec391…`；冻结路径 diff 退出码 0；文档态已记录（PM 在管，未改代码）            |
| 2. 暗色 Chromatic 基线（全量比对零差异、build accepted）                                          | ❌   | 无本地 token / 无 CI 工作流；`onlyChanged:true` 下未做全量比对，未取得 accepted build |
| 3. 单测基线 4708 通过、0 failed；视频按钮 7/7                                                     | ✅   | 实测 4708/4708 passed；契约 1 文件 7/7 passed                                         |
| 4. e2e 8 spec 全绿 + `test:e2e:full`                                                              | ❌   | 端口冲突导致 18 failed / 59 did not run；full 1 failed / 1 did not run                |
| 5. 视频按钮契约 + 三文件 sha256 存档                                                              | ✅   | 7/7 + sha256 已记录于本文 §3                                                          |
| 6. 亮色基线预留（登记 `globals.theme='light'`）                                                   | ✅   | 已登记，本阶段不出截图，P1 生成                                                       |
| 7. 静态门禁（db:check / db:generate 无 drift / typecheck / lint / format:check / dead-code 全 0） | ❌   | 五项 0，`format:check` = 1（仅 PM 三份文档）                                          |
| 归档（SHA / build ID / 测试总数 / sha256）                                                        | ✅   | 本文已归档 SHA、4708、sha256、story 清单；Chromatic build ID 因阻塞缺失               |
| `ui-unification.md` 纳入版本管理                                                                  | ❌   | 当前为 untracked；由 PM 处理（本文不代为 commit）                                     |

**结论：基线尚未锁定 → 不满足 P1 开工条件。** §9 明确「任何一项不满足，禁止 P1 开工」；当前 3 项核心判定（Chromatic 暗色基线、e2e 全绿、静态门禁全 0）未满足。需先解除上述阻塞、由 PM 将方案与台账纳入版本管理并格式化，然后复跑对应门禁并更新本文判定。

> 备注：`ui-unification.md` / `ui-project-status.md`（及 `upstream-must-parity.md` 的修改）需纳入版本管理，由 PM 处理；本 agent 仅新增本文件，未修改台账、方案或任何源码 / 配置。
