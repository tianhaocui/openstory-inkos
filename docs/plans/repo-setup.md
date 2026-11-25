# 三个仓库组装方案

## 目标结构

| 仓库 | 来源 | 职责 |
|---|---|---|
| `Davis1216/openstory` | fork 自 `openstory-so/openstory` | 上游跟踪（不承载产品代码） |
| `Davis1216/inkos` | fork 自 `Narcooo/inkos` | 上游跟踪（AGPL-3.0） |
| `Davis1216/openstory-inkos` | 新建 | **主仓库**：当前工作树 + 本地故事模式 + Must 档移植 |

账号名 `Davis1216` 取自本地 `/home/ubuntu/inkos/.git/config` 的 origin，请确认。

## 前置

```bash
gh auth status          # 必须是可写 token（repo scope）
gh auth refresh -s repo # 如缺权限
```

## 步骤 1 — fork 两个上游

```bash
gh repo fork openstory-so/openstory --clone=false
gh repo fork Narcooo/inkos --clone=false
```

验证：`gh repo view Davis1216/openstory --json parent,name` 和 `gh repo view Davis1216/inkos --json parent,name`
应分别显示 parent 为 `openstory-so/openstory`、`Narcooo/inkos`。

## 步骤 2 — 创建新仓库

```bash
gh repo create Davis1216/openstory-inkos \
  --public \
  --description "OpenStory with Chinese story mode and InkOS integration" \
  --clone=false
```

## 步骤 3 — 把当前工作树推成初始提交（保留上游历史）

当前 `/home/ubuntu/openstory` 没有 `.git`，但备份仓库有——**把 `.git` 接回来，不要 git init**，
否则会丢掉上游 572 个提交的历史和基线锚点 `5372810`。

```bash
cp -a /home/ubuntu/openstory.server-backup-20260921015401/.git /home/ubuntu/openstory/.git
cd /home/ubuntu/openstory

# 确认历史还在
git log -1 --format='%H %s'          # 应为 537281036e... fix: group the minimum shots needed for render segments
git status                            # stories/ i18n/ HANDOFF.md deploy/ 等应显示为 untracked/modified

# 提交本地定制层
git add -A
git commit -m "feat: local story mode, zh i18n, InkOS integration and deploy config"

# 指向新仓库（不是上游）
git remote remove origin 2>/dev/null || true
git remote add origin git@github.com:Davis1216/openstory-inkos.git
git branch -M main
git push -u origin main

# 保留上游跟踪（便于后续按簇取用）
git remote add upstream https://github.com/openstory-so/openstory.git
git fetch upstream
```

**红线**：`git add -A` 前确认 `.env.local`、任何密钥文件已被 `.gitignore` 排除。
`git status` 里若出现 `.env.local`、`*.pem`、token 文件，先加进 `.gitignore` 再提交。

## 步骤 4 —（可选）把本地 InkOS 集成分支推到 inkos fork

```bash
cd /home/ubuntu/inkos
git remote add mine git@github.com:Davis1216/inkos.git 2>/dev/null || true
git push mine codex/openstory-integration
```

注意：`Narcooo/inkos` 是 AGPL-3.0，这个分支若修改了服务端并经网络提供服务，
AGPL §13 要求向使用者提供对应源码——推送前由发布 / 法务确认。

## 步骤 5 — 验证

```bash
gh repo list Davis1216 --json name,parent --limit 100
git -C /home/ubuntu/openstory remote -v
git -C /home/ubuntu/openstory log --oneline -3
gh api repos/Davis1216/openstory-inkos/contents/docs/plans/upstream-must-parity.md --jq .name
```

## 组装后的代码基线

新仓库的 `main` = 上游 `5372810`（2026-09-16）+ 本地定制层。后续按
`docs/plans/upstream-must-parity.md` 的 Must 档在三簇分支上推进：

| 簇 | 内容 | 分支 |
|---|---|---|
| A | 视频片段生成（`generateVideoFn` 接线 + workflow） | `must-a-video` |
| B | 配音 / 对白 | `must-b-dialogue` |
| C | 拼接导出（优先复用本地服务端导出） | `must-c-export` |

每簇独立 PR、独立门禁：`bun typecheck` → `bun lint` → `bun run test` →
`bun db:generate` diff review → `bun scripts/check-migrations.ts` → e2e。

## 不做的事

- 不把上游 572 个提交全量 rebase（数据语义冲突 + 生产 D1 CASCADE 风险）
- 不升级 InkOS 到 2.0（未发 release，本地耦合面只有 type-only + HTTP）
- 不重新启用 `pipeline_stage` / `generation_checkpoint` / `autoGenerate*`
