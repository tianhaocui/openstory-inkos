# 项目台账 — UI/UX 深度重构与验收

> PM 负责推进与验收；本文件是进度、决策、风险的单一事实来源。
> 决策与方案见 `docs/plans/ui-unification.md`；基线细节见本文件 P0 节。

## 目标与范围

- **目标**：OpenStory 内部 UI 深度统一（Story→Scene→Shot 三层、亮/暗双主题、i18n 接线、a11y 门禁），并通过完整验收。
- **范围**：B 档（仅 OpenStory 内部），**不动 InkOS Studio 仓**（C 档）。
- **已确认决策**：中文为主 + key-based i18n · 授权新增 a11y 依赖 · 导航文案改「故事」体系 · 先做 UI 改造（簇 B/C 后做）。
- **冻结代码**：`ShotVideoButton`（`filmmaking-panel.tsx:134-197`）与 `src/stories/ai-filmmaking.fn.ts` 的视频接线不得改动，7 条契约测试不可改。

## 阶段进度

| 阶段 | 内容                                                            | 状态      | 负责            | 验收门禁                                           | 备注                                                                                                                                                                                               |
| ---- | --------------------------------------------------------------- | --------- | --------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 准备 | push `d5eec39`、台账建立                                        | ✅ 完成   | PM/dev          | 远端 SHA = `d5eec39`                               | —                                                                                                                                                                                                  |
| P0   | 基线冻结（SHA/Chromatic/4708 单测/8 e2e/契约 sha256）           | ❌ 未锁定 | dev/qa          | 全部锁定标准满足                                   | 单测/契约/静态门禁/sha256 ✅；e2e 历史 11 failed → 上传 404×7 已修（41bfe6bc），定位器/时序/P2 URL 已在 e2e 轨修复并分批复跑；Chromatic ⏸ 条件依赖                                                 |
| P1   | 主题基础设施（token 重构 + ThemeProvider + ThemeToggle）        | ✅ 完成   | dev + uiux 评审 | 暗色全量比对零差异、亮色新基线                     | `0f3787ec`（token/Provider）+ `527c7021`（ThemeToggle 顶栏+外观 Tab、4 处 h-[400px] 清零、硬编码颜色豁免清单）。像素零差异待 CI Chromatic                                                          |
| P2   | IA/路由（/films 影片线 + /stories 小说线、重定向、侧栏/面包屑） | ✅ 完成   | dev + uiux 评审 | 8 e2e URL/选择器绿、/inkos 入口不受影响            | 已落地 `4046b7d6f`；A 方案：影片→/films、小说保留 /stories；307 重定向实测通过。e2e 中 `/sequences*` URL 断言已改为 `/films*`（auth/sequences/sequence-flow/manual-pipeline/talent/full-sequence） |
| P3   | 组件层（合并/新增、ShotActionButton 外包、去固定高度）          | ✅ 完成   | dev + qa        | **视频按钮契约 7/7**、4708 单测、full-sequence e2e | 已落地 `f7afeb8b`；冻结逻辑区哈希逐字一致、契约 7/7、4717 用例全绿。e2e 仍为独立轨道债                                                                                                             |
| P4   | i18n（Provider + 三批抽取）                                     | ✅ 完成   | dev             | 缺失 key 回退中文、SSR 无闪烁                      | 已落地 `d50af60d`；232 处 t()、756 key、197 静态 key 零缺失、SSR 无闪烁、冻结哈希未变                                                                                                              |
| P5   | a11y（story 补齐 + test-runner + axe + CI）                     | ✅ 完成   | dev + qa        | 新 story 0 critical/serious、键盘矩阵              | 已落地 `5ded0e17f`；test:a11y 本地全量 202 stories 0 critical/serious；新增 2 devDep + CI step                                                                                                     |
| 验收 | 全量回归 + 视觉走查 + a11y + 功能矩阵 + 签核                    | ⏳        | PM + qa + uiux  | 方案 §8 全部通过                                   | —                                                                                                                                                                                                  |

## 环境

- Node 24：`export PATH=/home/ubuntu/.local/node-v24/bin:/home/ubuntu/.bun/bin:$PATH`（本机默认 node 18 会挂）
- bun 1.4.2（CI 1.3.14，偏差已记）；主仓库 `tianhaocui/openstory-inkos`
- 工作树：准备阶段前 `d5eec39` 本地 ahead 1（待 push）

## 风险登记

| 风险                                        | 缓解                                              | 状态           |
| ------------------------------------------- | ------------------------------------------------- | -------------- |
| `onlyChanged:true` 导致 P1 暗色零差异验不出 | P1 强制全量比对                                   | 已写入方案门禁 |
| 视频防重在"顺手重构"中被破坏                | 冻结代码 + sha256 + 契约 7 条 + PR 勾选框         | P0 锁定        |
| 主题重构波及全站视觉                        | 默认仍暗 + 暗色像素零差异 + 亮色只增不改 token 名 | P1 验收        |
| IA 改动打断深链/e2e                         | 旧路由全保留 redirect 一版                        | P2 验收        |
| 双数据源长期存在                            | 本轮只做 ViewModel，DB 合并另立议题               | 已界定范围外   |
| Chromatic/e2e 外部依赖不可用                | 如实记录阻塞，用本地 Storybook 构建/截图替代基线  | P0 判断        |

## 决策日志

- 2026-11-25：确认 B 档 / 设计方案 / 双主题 / 中文为主 / 授权 a11y 依赖 / 文案改故事体系 / UI 优先于簇 B/C。
- 2026-11-25：PM 接管项目推进与验收，自主推进不再逐项征询；每阶段结束汇总。
- 2026-11-25：P0 执行结果——单测 4708 全绿 / 契约 7/7 / 静态门禁全 0 / sha256 已锁 / 文档已纳入版本管理；
  e2e 仍 11 failed（R2 上传 404×7 + 定位器/时序×4），full pipeline 超时未验证；Chromatic 为 CI 条件依赖。
- 2026-11-25：QA 首会话卡死（连续中断无返回），已换新会话接手；e2e spec 已全量中文化并提交 `2d6f5a5f`，未 push。
- 2026-11-26：开发 e2e 独立轨道清零历史 11 failed + P2 URL 漂移；仅改 `e2e/**` 与两份台账，7 个主跑 spec 分批全绿；`test:e2e:full` 仍超时未验证，未 push。

## 当前阻塞（最终验收）

1. **e2e 历史 11 failed**：✅ **已清零（2026-11-26）**。7 条 R2 上传 404 由 `41bfe6bc` 修复；剩余 5 条 talent 文案/分类器断言、4 条定位器/时序问题，以及 P2 URL 漂移，均由 e2e 独立轨道修复。单文件分批实测 7 个主跑 spec 全绿（auth 19/19、talent 23/23、sequence-flow 4 passed+1 skip、manual-pipeline 2/2、sequences 13/13、locations 11/11、studio 10/10），见 `ui-baseline.md` §4.5。未跑一次全量单进程 `bun test:e2e`，不冒充全量通过。
2. **Chromatic CI 集成**：本地无 token，暗色基线 + 全量比对需 CI 外部集成（release 负责）。
3. **`test:e2e:full`**：仍为超时未验证通过（30 分钟用例上限触发、runner 卡在收尾），需带超时保护重跑。
4. **replay LLM key**：上传链修好后分类器要求非空平台 key；`e2e/start-webserver.ts` 在 replay 模式注入 dummy `OPENROUTER_KEY`/`FAL_KEY`（不覆盖真实 key），产品源码未动。

**用户决策（2026-11-25）**：Push；修 bug 是开发的事；暂时没有文件存储服务。
→ 7 条 R2 失败记为**环境依赖**，不作为 UI 重构的验收阻断；整体签核在「有文件存储服务 + CI Chromatic」的环境完成。

## 验收签核（待填）

| 角色  | 签核内容                            | 状态                                                                               |
| ----- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| PM    | 术语/文案/语言/InkOS 入口文案       | ✅（影片/故事双线、中文为主、入口文案已确认）                                      |
| 开发  | 组件可行性、依赖引入、路由重定向    | ✅（P1–P5 + 视觉缺陷修复全绿，307 重定向实测）                                     |
| QA    | a11y 规则、双主题基线、视频按钮矩阵 | ✅ 本地（test:a11y 202 stories 0 critical/serious；契约 7/7）；双主题像素基线待 CI |
| UI/UX | 视觉走查、组件规范符合度            | ⚠️ 设计侧可签核（3 项缺陷已修复）；暗色像素零差异待 CI Chromatic                   |

**整体结论（2026-11-26 更新）**：UI/UX 重构代码与本地质量门禁完成；e2e 历史 11 failed
已清零、P2 URL 断言已对齐 `/films*`，7 个主跑 spec 分批全绿。整体签核剩余项为：
一次全量单进程 e2e 复跑、`test:e2e:full` 最终结果、以及 CI Chromatic → 双主题像素基线；
前两项属验证流程，最后一项为外部条件依赖，均非已知产品缺陷。
