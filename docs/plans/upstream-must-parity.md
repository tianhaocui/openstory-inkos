# Must 档：上游能力移植到本地故事模式

**决策**：策略 B（本地 fork 为主线，上游当零件库）· 范围仅 Must · 基线 `0e3543870c`（2026-09-16）· 上游当前 `4895540743`（2026-11-24）

## 核心判断

**缺口是"接线"，不是"能力"。** 本地基线已包含上游 09-16 之前的全部媒体能力：
Seedance 2.5 / Seedream（08-28）、fal 计费核对（07-31）、服务端 MP4 导出（06-22）、
ElevenLabs adapter + 角色声音 + 逐句对白（09-11 ~ 09-16，含 #1651）。
`src/motion/`、`src/audio/`、`src/stills/` 都是生产级实现。

因此本计划**以接线为主、cherry-pick 为辅**。预计只有 2~3 个上游补丁值得取，
大批量 pick 反而会引入 shot spec / pointer claims 等必须拒绝的数据语义。

## 目标 / 非目标

**目标**：打通 `故事 → 章节 → 分镜 → 关键帧（已通）→ 视频片段 → 配音/对白 → 拼接导出`，
产出可播放的成片；每一步可重试、可计费、状态可查。

**非目标**：
- 不改 `story_*` 9 张表的语义；不引入 shot spec / keyframes-on-spec
- 不取 assistant UI、MCP、library CLI
- 不升级 @tanstack/ai / Better Auth / Node（独立迁移项目）
- 不接受 #2017/#2019/#2135/#1113/#1600/#1115/#1819/#1937 等数据语义重构

## 现状盘点

| 环节 | 本地现状 | 底层能力 | 缺口性质 |
|---|---|---|---|
| 关键帧 | `generateKeyframeFn` 已接图像 API + 计费 + 落库 + back-link（`ai-filmmaking.fn.ts:431-636`） | 完备 | ✅ 已通 |
| 视频片段 | `generateVideoFn` 直接抛 `not configured yet`（`:647-677`）；`batchGenerateSegmentFn` 跳过视频（`:723-724`） | motion 层支持 Seedance 2.5 / i2v / 轮询 | 🔌 接线 |
| 配音 / 对白 | `story_shots.dialogue`、`storyFilmSettings.hasVoiceover` 只是字段，无生成路径 | ElevenLabs TTS / Voice Design / 逐句对白已实现 | 🔌 接线 |
| 拼接导出 | sequences 路径有服务端导出；stories 路径无 | Cloudflare Container MP4 导出已实现 | 🔌 接线（复用） |

## 簇 A — 视频片段生成（P0-1，先做）

**接入点**：`src/stories/ai-filmmaking.fn.ts:647` `generateVideoFn`

**可直接复用的底层接口（本地已有，无需 cherry-pick）**：

| 用途 | 接口 | 位置 |
|---|---|---|
| 提交任务 | `submitMotionJob(...)` | `@/motion/server/motion-generation:395` |
| 轮询 / 取结果 | `checkMotionStatus(...)` / `getMotionResult(...)` | 同文件 `:967` / `:974` |
| 上传 R2 | `uploadVideoFromUrl(...)` | `@/motion/server/video-storage:93` |
| 时长 | `resolveShotDuration(...)` / `snapDuration(...)` | `@/motion/resolve-shot-duration`、`snap-duration` |
| 预估 / 门禁 | `estimateVideoCost(...)` / `gateEstimate(...)` | `@/billing/cost-estimation` |
| 预留 / 释放 | `reserveRunCredits(...)` / `releaseReservationOnThrow(...)` | `@/billing/server/preflight` |
| 对白适配 | `voicedDialogueLines(...)` / `modelTakesDialogueAudio(...)` | `@/motion/dialogue-tts` |
| 触发工作流 | `triggerWorkflow(...)` | `@/platform/server/workflow/client` |
| 凭证（仅 step 内） | `toWorkflowScopedDb(...).credentials.resolveKey(...)` | `@/platform/server/db/scoped-workflow` |

注意：story 路径用 `authWithTeamMiddleware`（不是 `sequenceAccessMiddleware`），凭证取自
`context.scopedDb`；workflow 内 API key 必须在 step 里通过 `scopedDb.credentials.resolveKey(...)`
解析，不要在 server fn 里取好后序列化进 payload。

**接线模式**（注意：不能直接照抄 `generateKeyframeFn` 的同步模式——视频是长任务）：
1. server fn：鉴权 → 读 `storyKeyframes` + 项目设置 → 预估计费 → 写 `storyVideoClips` 行 `status=pending/queued` → `triggerWorkflow` → 回写 `workflowRunId`
2. workflow：`step.do` 内提交 motion 任务 → 轮询 → 上传 R2 → 回写 `videoUrl/videoPath/status=completed`；失败写 `status=failed` + `errorMessage`
3. 复用上游 `MotionWorkflow` 的提交/轮询/错误处理；只写 stories 侧的状态适配
4. 幂等：同 `(keyframeId, projectId)` 已有 `generating` 行时返回 `alreadyInFlight`（对齐关键帧的 `:526-533`）
5. 回写 `storyShots.videoClipId`（对齐关键帧回写 `keyframeId` 的 `:608-613`）

**少量可选 cherry-pick**（需逐条验证是否与本地 motion 层冲突）：
- `dc36445032` Seedance 2.5 draft mode（09-24）
- `385dec85d1` duration=-1 for Seedance 2.5 edits（10-07）

**不取**：`adaa58a15d` keyframes on shot spec 及其 11 月系列（依赖被拒的 shot spec；本地 `story_keyframes` 已是独立实体，语义不同）。

**验收标准**：
- Given 一个 `status=completed` 的关键帧，When 调 `generateVideoFn`，Then 返回 clip id + 状态为 `pending|queued`，且不抛错
- Given 一个生成中的 clip，When 重复调用，Then 返回 `alreadyInFlight`，不产生第二条行、不重复扣费
- Given 上游任务完成，When workflow 回写，Then `storyVideoClips` 有 R2 url、`storyShots.videoClipId` 被回填、前端可播放
- 计费：提交前预留、完成后按实际用量结算；失败释放预留；无 $0 生成路径
- `batchGenerateSegmentFn` 移除"跳过视频"的注释，关键帧之后调用视频生成（错误计入 `results.errors`）

## 簇 B — 配音 / 对白（P0-2）

**接入点**：`story_shots.dialogue` → 逐句对白；`storyFilmSettings.hasVoiceover/hasSoundtrack` → 开关。

**接线模式**：复用底层 ElevenLabs 路径（Character TTS / Voice Design / 逐句对白），
把 stories 的 `dialogue` 文本（含角色名）映射为对白输入；产物存 R2，引用写回 shot/clip。
不新建语音表——用 `generationParams` 记 model / voiceId / take。

**可选 cherry-pick**：
- `95308bb3eb` lip-sync 成片对白（11-06）
- `4ec998797d` 整场录音作为对白（11-06）
- `35e8b3ecfb` / `80462e1a36` ElevenLabs 429 重试（11-07）

**验收标准**：
- Given 一个带 `dialogue` 的 shot 且角色有 voiceId，When 生成视频，Then 对白音轨随 clip 一起产出
- Given 无 voiceId 的角色，Then 明确报错或跳过并在 UI 说明，不静默无声
- 对白文本/角色变化后，重新生成时体现新内容（不复用旧音轨）

## 簇 C — 拼接导出（P0-3，最后）

**优先方案：复用本地已有的服务端导出**，把 stories 的 clips 按顺序喂给现有导出流程，
在故事项目页提供"导出成片"。零上游改动、零新依赖。

**可选 cherry-pick**（需先核实 `@openstory/stitch` 许可与自托管约束）：
- `1d6abb2075` 去掉 HLS、stitcher 播放列表、Export→Download（09-27）
- `75e184b31f` 本地剪辑播放（10-14）
- `92990f1091` watch_clip 按 clip 流式播放（11-11）

**验收标准**：
- Given 一个项目下所有 clip 均为 completed，When 点导出，Then 生成并按顺序拼接为单个 MP4
- 有 failed/pending clip 时，导出按钮禁用并说明缺哪些
- 导出产物与 clip 顺序、画幅一致；中文文件名与 R2 路径可用

## 依赖与顺序

**A → B → C**。每簇一个分支、独立 commit、独立回滚。
B 依赖 A 产出的 clip，C 依赖 A+B 的完整产物。

## 公共门禁（每簇都必须跑）

`bun typecheck` → `bun lint` → `bun run test` →
`bun db:generate` 产出 diff review（禁 DROP TABLE / 禁重排迁移）→
`bun scripts/check-migrations.ts` → `bun test:e2e:setup && bun test:e2e` →
`bun dev` 手走一遍故事流程。

贯穿红线：不让上游迁移覆盖本地 `drizzle/migrations/`；不对 stories 表做 table rebuild；
不重新启用上游已删除的 `pipeline_stage` / `generation_checkpoint` / `autoGenerate*`。

## 风险

| 风险 | 缓解 |
|---|---|
| `toWorkflowScopedDb()` 是本地绕行，上游收窄读面后可能被类型层封死 | 簇 A 开工前由架构师确认 workflow 凭证路径 |
| stories 表对 `teams`/`user` 有 CASCADE，迁移触发 #612 类数据丢失 | 只做新时间戳的追加迁移；手工应用 + `d1_migrations` 记账 |
| 视频是长任务，同步 server fn 模式会超时 / 丢状态 | 必须走 workflow + 状态行，见簇 A |
| 计费漏接导致免费生成 | 提交前预留 + 完成后结算 + 失败释放，写进验收标准 |

## 仓库与上游对照（2026-11-25 补充）

| 项 | 本地 | 上游 |
|---|---|---|
| OpenStory git 仓库 | `/home/ubuntu/openstory.server-backup-20260921015401/.git`（HEAD `537281036e`，origin = `openstory-so/openstory`，branch main） | `openstory-so/openstory`，最新 `4895540743`（11-24） |
| 当前工作目录 | `/home/ubuntu/openstory`（**无 .git**，是上面仓库的无版本副本 + 本地改动） | — |
| InkOS git 仓库 | `/home/ubuntu/inkos/.git`（HEAD `c50e840fdb`，分支 `codex/openstory-integration`，origin = **`Davis1216/inkos`** fork） | **`Narcooo/inkos`**（11.4k stars，AGPL-3.0），最新 `53adac4e97`（10-24） |
| InkOS 依赖 | `@actalk/inkos-core ^1.8.0`（最新 release v1.8.0，08-17） | master 已推进到 **InkOS 2.0**（v1.8.0 之后 114 commits，**未发 release**） |

**InkOS 2.0 是破坏性重构，且尚未发布**：核心提交 `7e60e13fd3`（09-25）
"complete InkOS 2.0 creative workflows and recovery contracts"；此前 08-26~09-01 一大批
`refactor(harness): ... v2 / remove legacy 1.x control paths / migrate legacy projects into v2 works`、
`refactor(storyboard): remove retired segmentation scaffolding`、`submit document and assets together`、
`refactor(film): generate playable package in one worker`。
**上述判断已被架构师源码级核实修正**：本地与 InkOS 的耦合面极窄——仅 1 处 `import type`（6 个类型）、
1 处 Studio HTTP 调用（`/api/v1/books`、`/books/create`）、1 套自建 webhook。
`ai-writer.fn.ts` / `ai-filmmaking.fn.ts` 走自有 LLM + D1，9 张 story 表与 InkOS 无映射：
本地**并没有真正接入 InkOS SDK，只把它当外部工作台 + 类型垫片**。因此 2.0 **不构成重写威胁**，
保持 `^1.8.0` 即可；真正的重写只发生在产品主动决定把写作/分镜迁到 2.0 harness 时（产品决策，
不是升级必需）。2.0 至今未发 release（npm latest 仍 1.8.0，CHANGELOG 无 2.0 条目），不提前适配。
详见 `docs/plans/inkos-2-impact.md`。

## 执行前提

当前工作目录无 `.git`（git 仓库在备份目录），且本环境无 shell，无法执行 cherry-pick 或门禁。需在有 git 的机器：
1. clone 上游并锚定基线/当前 SHA；2. 将当前工作树落成 `local-fork/baseline`；
3. 产出本地 delta 清单（9 张 story 表、14 个 stories 文件、`scopedDb.stories/compliance`、i18n、kiro 端点、`deploy/**`）；
4. 把清单交回，再做簇分类与冲突映射。
