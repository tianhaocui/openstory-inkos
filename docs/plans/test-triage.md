# 按改动范围裁剪的测试策略

> 只读评估（QA agent），未改文件/未跑测试。目标：无修改的部分不重复跑全流程，省时间 + 省内存。
> 用户诉求原话："后续测试确定无修改的部分可以不过走全流程测试节省时间和内存"。

## 三档模型

| 档                        | 内容                                                 | 时机              |
| ------------------------- | ---------------------------------------------------- | ----------------- |
| **L0** 不变量快检（<30s） | 冻结区哈希 + 契约 7 条 + 结构性护栏测试              | **任何改动都跑**  |
| **L1** 关联层             | `vitest --changed` / `related` + 快 lint + typecheck | 本地默认          |
| **L2** 全量层             | lint + test + e2e + a11y + knip                      | CI + 全局影响改动 |

CI 保持全量（`.github/workflows/test.yml:41-90`）；裁剪只用于本地（2 核 12GB 约束）。

## 改动 → 必跑 / 可跳过

| 改动类型                      | 本地必跑                                                                      | 可跳过（CI 仍跑）                       |
| ----------------------------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| 纯文档 md                     | L0 + md format check                                                          | lint/typecheck/test/e2e/knip            |
| 纯 UI/组件 tsx                | L0 + vitest related + lint:fast + typecheck；改 stories/设计系统 → a11y       | 全量 Vitest、e2e                        |
| i18n zh.json                  | L0 + format + typecheck + 按改动 key 反查 e2e 选择器                          | 全量单测；高频词（生成/邮箱）→ 全量 e2e |
| server fn / handler           | L0 + --changed + typecheck + client-server-boundary + 相关 e2e spec           | 其余 e2e、a11y                          |
| workflow 定义                 | L0 + wiring-consistency + no-mid-run-reads + 自身测试 + typecheck             | 本地跳 `test:e2e:full`（30min 超时）    |
| 模型/LLM 适配 `src/models/**` | L0 + vitest related + typecheck；via 路由改动 → 全量单测                      | a11y、无关 e2e                          |
| DB schema/migration           | L0 + db:check + db:generate 零 diff + migration-safety + 全量单测 + e2e:setup | 本地全量 e2e                            |
| e2e spec 自身                 | L0 + 只跑改动 spec（`E2E_PORT=3002`）                                         | 其他 spec、全量                         |
| config/package.json/wrangler  | **L2 全量** + wrangler types 核对                                             | 无可裁剪                                |
| env 变量（AI_* 等）           | **L2 全量** + push-secrets/create-adapter/api-keys/llm-call-helper 测试       | 视为全局，不可跳                        |

**取最高档**：一次改动命中多类型时取最高档。

## 内存优化（关键：串行 + 缩范围，不是缓存）

```bash
# 快 lint（无类型，秒级低内存）—— oxlint 原生二进制，NODE_OPTIONS 无效
bunx oxlint --quiet <改动文件或目录>

# 范围化 type-aware（--threads=1 控 RSS）
NODE_OPTIONS=--max-old-space-size=4096 bunx oxlint --type-aware --threads=1 --quiet src/stories src/models src/sequences

# 全量 lint（push 前/CI，单独跑，别和别的并行）
NODE_OPTIONS=--max-old-space-size=4096 bun run lint

# Vitest 关联（依赖 git diff + 模块图，无需缓存）
NODE_OPTIONS=--max-old-space-size=4096 bunx vitest run --changed --maxWorkers=2 --bail=1
NODE_OPTIONS=--max-old-space-size=4096 bunx vitest related --run <改动文件>

# 内存吃紧兜底：单进程线程池
NODE_OPTIONS=--max-old-space-size=4096 bunx vitest run --changed --pool=threads --no-file-parallelism --bail=1
```

**纪律**：lint / typecheck / Vitest **严格串行**，避免峰值内存叠加。`tsgo --noEmit` 无法裁剪，单独跑 + 4GB 上限。

## L0 快检脚本（约 2–5s，任何改动必跑）

```bash
set -e
cd /home/ubuntu/openstory

# 1) 冻结逻辑区哈希（不依赖行号）
REGION=$(awk '/^\/\*\* Mirror of generateVideoFn/{f=1} /^interface FilmmakingPanelProps/{f=0} f' \
  src/stories/ui/filmmaking-panel.tsx | sha256sum | cut -d' ' -f1)
[ "$REGION" = "ffa1cf1ae5d030bb2c23a52afe50e77c01ec72b96fcdee029a4fe4dd4b66d9af" ] \
  || { echo "FAIL: 冻结逻辑区被改动"; exit 1; }

# 2) 契约测试文件哈希
TEST_HASH=$(sha256sum src/stories/ui/filmmaking-panel.test.tsx | cut -d' ' -f1)
[ "$TEST_HASH" = "afd37ed42b0c559c30b4e9d6be5e4fe3695c25cdaaff8f1be35b79211dcaff92" ] \
  || { echo "FAIL: 7 条契约测试被改动"; exit 1; }

# 3) 7 条契约（~1s）
bun run test src/stories/ui/filmmaking-panel.test.tsx

# 4) 结构性护栏（毫秒级，跨文件不变量）
bun run test \
  src/platform/client-server-boundary.test.ts \
  src/platform/server/workflow/wiring-consistency.test.ts \
  src/platform/server/workflow/no-mid-run-reads.test.ts \
  src/platform/server/db/db-access-allowlist.test.ts \
  src/platform/domain-blind.test.ts \
  src/platform/server/api-v1/openapi.test.ts
```

**⚠️ 基线漂移（必须先修）**：`src/stories/ai-filmmaking.fn.ts` 全文件哈希已从 `9bcb598d…` 变为
`325f340a…`（自定义端点改动触碰，19 行 diff）。快检**不要**写死旧值——改用
`ui-baseline.md:324` 的"冻结逻辑区"方案只钉扣费/鉴权区，或由负责人重新签署新值。
核心判据（冻结区 `ffa1cf1a…`、契约测试 `afd37ed…`）实测仍一致。

## 建议新增 scripts（package.json）

```
lint:fast       = bunx oxlint --quiet
lint:changed    = bun scripts/lint-changed.ts
test:changed    = vitest run --changed --maxWorkers=2 --bail=1
test:related    = vitest related --run
verify:quick    = bun scripts/verify-quick.ts
verify:full     = bun run verify:quick && bun typecheck && bun lint && bun run test && bun format:check && bun dead-code
e2e:one         = bun playwright test
```

`scripts/verify-changed.ts` 按 `git diff --name-only` 决定档位（伪代码见 QA 报告），
base：本地未提交用 `HEAD`，PR 用 `git merge-base HEAD origin/main`；空文件时跳过 oxlint（否则退出码非 0）。

## 不能裁剪的"看起来无修改"改动

| 场景                                 | 必须                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| CSS token（`global.css`）            | 全量 a11y + 视觉（202 stories）                                                |
| env 变量（AI_*/FAL/XAI/ELEVENLABS）  | 全量单测 + push-secrets + 关联 e2e（进入 key 解析链，影响所有 LLM 调用与计费） |
| i18n 高频词（生成/邮箱）             | 反查所有引用；不确定就全量 e2e                                                 |
| wrangler / worker-configuration.d.ts | wrangler types + 全量单测 + e2e:setup                                          |
| DB schema/migration                  | db:check + 零 diff + migration-safety + 全量单测                               |
| workflow payload / 护栏测试本身      | 强制 L0/L1 固定清单                                                            |
| package.json / knip / lint 配置      | 全量 knip + lint                                                               |

**方法论红线**：快检脚本要做"负向验证"——临时改坏冻结区一个字符，确认快检确实失败，再还原。永远返回 0 的脚本等于没有门禁。
