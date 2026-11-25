# InkOS 1.x → 2.0 影响评估

**结论**：影响低。**不提前适配**，保持 `@actalk/inkos-core ^1.8.0`，等 v2.0.0 正式发布。
本地并没有真正接入 InkOS SDK，只把它当外部 Studio 工作台 + 类型垫片；2.0 的内部重构
（projects → works、harness v2、删 1.x 控制路径）不构成对本地的重写威胁。

评估基准：上游 `Narcooo/inkos` master `53adac4e97`（2026-10-24）；本地已装 1.8.0。
所有结论来自实际源码对比，commit message 仅作背景。只评估，未改代码。

## 1. 2.0 契约变化（取证）

| 维度 | 1.x | 2.0 | 状态 |
|---|---|---|---|
| 权威容器 | `books/<id>/`、`shorts/`、`dramas/`、`storyboards/` 等 | `works/<workId>/work.json` + `source/`，7 类 legacy 目录由 `inkos work migrate` 导入 | 改名 + 抽象层；**1.x 目录保留，双轨并存** |
| Manifest | `inkos.json` + `book.json` | `WorkManifestSchema`（version:2 / id / profileId / status / lineage / artifacts） | 新增 |
| Artifact 版本 | 无统一模型 | `ArtifactRevisionSchema`（candidate/current/superseded + checksum） | 新增 |
| Profile / Skill | 私有协议 | `WorkProfileSchema` + 标准 `SKILL.md`，19 内置 Skill | 语义重写 |
| 观测/恢复 | 分散 | `CreativeEpisode` / `CreativeEpisodeEvent`（`.inkos/harness.sqlite`） | 新增 |

API 签名（关键）：
- **移除的导出**：`resolveChapterReviewMode`、`resolveRevisionGate`、`normalizePlatformId`、
  `ChapterStatusSchema`、`RevisionGate`、`HookPayoffTiming`、`CurrentStatePatchSchema` 等
- **保留**：`applyRuntimeStateDelta`、`runStoryboardCreation`、`StateManifestSchema`
- **新增**：`harness/*`（`WorkManifest`、`CapabilityRegistry`、`createCapabilityPiTools`、`migrateLegacyWorks`）
- Node 引擎收紧到 `>=22.16.0`（本地 OpenStory `>=24`，兼容）

类型契约（本地导入的 6 个类型）：

| 类型 | 变化 | 本地影响 |
|---|---|---|
| `BookConfig` | `language` 可选→必填、时间 string→datetime、`writing` 移除、新增 min/maxChapterLength | 本地构造字段恰好全部兼容 |
| `ChapterMeta` | 移除 status/auditIssues 等，新增必填 `observations` + `provenance` | **破坏性**，但本地未构造 |
| `RuntimeStateDelta` | `currentStatePatch` 等 → 结构化 `factOps` | **语义重写**，本地未用 |
| `HookRecord` | 移除 payoffTiming/coreHook 等，`expectedPayoff` 改必填 | 本地未构造 |
| `ChapterSummaryRow` | `.default()` 移除，输入全部必填 | 轻微 |
| `CurrentStateFact` | 完全一致 | 保留 |

出处：`packages/core/src/harness/contracts.ts:95-183`、`legacy-migration.ts:10-18`、
`packages/core/src/models/{book,chapter,runtime-state}.ts`、`packages/studio/src/api/server.ts:2870,2902-2995`。

**关键兼容证据**：Studio API `GET /api/v1/books`、`POST /api/v1/books/create` 在 2.0 **保留且请求体未变**，
返回仍是 `{status:"creating", bookId}`。`runStoryboardCreation` 只移除了 `outDir?` 选项。

## 2. 本地耦合面（全量）

| 本地位置 | 依赖 | 2.0 状态 | 风险 |
|---|---|---|---|
| `src/stories/inkos-integration.ts:12-19` | `import type` 6 类型，仅 re-export，**无人消费** | 类型名仍在 | ≈0 |
| 同文件 `toInkOSBookConfig()` | 构造 `BookConfig`，**无调用者** | 字段兼容 | 低 |
| `src/stories/server/inkos-studio.ts:38-52,70` | Studio REST `/books`、`/books/create` | **保留，字段未变** | 低（需回归） |
| `src/stories/server/inkos-sync.ts` | 自建 HMAC webhook（`schemaVersion:1`，`artifactKind: script\|interactive-film`） | 与 InkOS 包无关 | 中（2.0 works 产物回传需自行适配） |
| `ai-writer.fn.ts` / `ai-filmmaking.fn.ts` / `chapters.fn.ts` | **无 InkOS 依赖**，自有 LLM + D1 | 不受影响 | 0 |
| `schema/inkos.ts` / `filmmaking.ts` 9 张表 | **无**，与 InkOS SQLite/FTS5 无映射 | 不受影响 | 0 |

## 3. 工作量分级

| 级别 | 内容 | 估算 |
|---|---|---|
| 机械替换 | `package.json` `^1.8.0` → `^2.0.0`（待发布） | < 0.5 天 |
| 低度适配 | `as BookConfig` 改真实校验；`language` 必填、时间格式确认；清理 5 个死 re-export | 0.5–1 天 |
| 回归验证 | Studio HTTP 契约测试（mock `/books` 409 + `/books/create`） | 1 天 |
| **语义重写（非必需）** | 若采用 2.0 harness：`factOps`、`observations/provenance`、`WorkManifest` 对接 | 5–15 天 |
| **大重写（当前不建议）** | 把本地写作/分镜迁到 InkOS runner — **产品决策，不是升级必需** | 按需 |
| 保留不动 | 全部 `*.fn.ts`、9 张 story 表、webhook、UI、schema | 0 |

## 4. 发版状态与触发条件

npm registry latest 仍 `1.8.0`；master `package.json` 已是 `2.0.0` 但未打 release/tag；
CHANGELOG 停在 v1.8.0（README 已有 v2.0.0 章节）。**不提前适配**（追移动目标成本 > 收益）。

全部满足再动：
1. `npm view @actalk/inkos-core version` = `2.0.0` 且 GitHub Release v2.0.0 已发布；
2. CHANGELOG 出现 v2.0.0，`books → works` 迁移路径定稿；
3. 本地 `INKOS_STUDIO_URL`（默认 `creation.dakalami.com/inkos`）已升级 2.0 且 `/books/create` 回归通过；
4. `inkos-sync.ts` 明确 2.0 下 storyboard/film 产物从 `works/<id>/source/...` 回传的契约（当前只认两类 artifactKind）。

**现在可做的零风险准备**（待用户确认后才执行）：删掉 5 个无消费的 re-export；给 Studio HTTP 调用加契约测试。

## 5. 合规

OpenStory LICENSE = MIT；`@actalk/inkos-core` = AGPL-3.0-only（1.8.0 与 2.0 一致）。

| 场景 | 判断 |
|---|---|
| 当前 `import type` + HTTP 调用外部服务 | 编译期擦除 + 未改 InkOS 服务端 → **不构成 AGPL 强链接**，不触发 §13 network clause |
| 改为 runtime import（harness/pi-tools）并随 OpenStory 分发 | **整体发行物须遵守 AGPL**；要保持 MIT 闭源分发则不能把 AGPL 代码打进 bundle |
| 本地 `/home/ubuntu/inkos` 的 `codex/openstory-integration` fork 若修改服务端并经网络提供服务 | AGPL §13 要求向使用者提供对应源码 — 需 release / 法务拍板 |
| 2.0 新增传递依赖 `pi-ai` / `pi-agent-core@0.67.1` | 升级时单独审计 license |
| Studio URL 为第三方托管实例 | 属服务使用非分发；但**章节正文发往外部 Studio** 的数据驻留需 PM 确认 |

**建议**：维持 type-only + HTTP 松耦合；runtime import 或 fork 服务端改动前，先定主体许可策略。
