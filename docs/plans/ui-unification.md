# UI 深度统一方案（B 档）

**决策（已确认）**：范围 B（OpenStory 内部深度统一）· 交付设计方案 · 亮/暗双主题 ·
中文为主 + key-based i18n · 授权引入 a11y 依赖 · 导航文案改「故事」体系 · **先做 UI 改造，簇 B/C 后做**。
本轮只出方案，不动代码；工程实施另派。

## 关键事实纠正

- fork 里「上游界面」已全量汉化（硬编码中文）；`src/i18n/locales/zh.json` 有 400+ key 但**全局零调用**，是死配置。
- 三套 UI：OpenStory 上游界面 / 本地故事模式 / InkOS Studio（独立仓、独立部署，本轮不碰）。
- P0 冲突：主题模型相反、shadcn 生成器不同（`radix-nova` vs `base-nova`，组件源码不可共享）、
  MIT vs AGPL 合规边界、InkOS 经 nginx 反代独立跳转。
- **视频计费防重是冻结代码**：`ShotVideoButton`（`filmmaking-panel.tsx:134-197`）与
  `src/stories/ai-filmmaking.fn.ts` 的视频接线不得改动；`filmmaking-panel.test.tsx:102-176` 是不可改契约。

## 1. 术语与 IA

UI 层三层：**Story（故事）→ Scene（分镜场景）→ Shot（镜头）**。DB 不合并，
用 `StoryView/SceneView/ShotView`（`src/ui/view-models/`，纯前端 adapter）映射
`sequences|story_projects`、`scenes|story_segments`、`shots|story_shots`。

| 旧                                | 新                        |
| --------------------------------- | ------------------------- |
| Sequence / Story project          | Story                     |
| Scene / Segment                   | Scene                     |
| Shot / Story Shot                 | Shot                      |
| Chapter                           | 剧本 Tab 内分组（非层级） |
| Character / Hook / Asset          | 资产 Tab + 全局资产库     |
| Frame / Keyframe / Variant / Take | Shot 的属性               |
| Video Clip / Theatre              | 成片 Tab                  |

路由（**2026-11-25 PM 修正**）：`/stories` 已被本地小说/影视模式完整占用，
故影片线规范路径改为 `/films`：`/sequences→/films`、`/sequences/new→/films/new`、
`/sequences/$id/scenes→/films/$id/scenes`；小说模式保持 `/stories/*` 不变。
另：`/images→/studio/images`、`/videos→/studio/videos`、`/talent|locations|styles|models→/library/*`。
用 TanStack `beforeLoad` 抛 redirect，保留一个版本。侧栏改「创作 / 资产库 / 产出 / 系统」四组。

> 方案 §1 术语映射表里的「Sequence→Story」指 UI 概念命名，与 URL 路径 `/films` 不冲突：
> 影片线对外文案用「影片/项目」，小说线用「故事」。ViewModel 仍统一三层 Story/Scene/Shot。

## 2. 双主题 token

`:root` = 亮、`.dark` = 暗；默认仍暗（保住 Chromatic 基线）。
`src/styles/global.css:38-108` token 重构；`@custom-variant dark` 从空插槽改为 `(&:is(.dark *))`；
`src/routes/__root.tsx:152` 去硬编码 `dark` class；`src/ui/providers.tsx` 加
`<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="os:theme">`。

核心语义 token（亮 / 暗 oklch）：

- `--background` `0.985 0.002 80` / `0.145 0 0`；`--foreground` `0.18 0.01 60` / `0.985 0 0`
- `--muted-foreground` `0.42 0.02 60` / `0.708 0 0`（亮值保证 ≥4.5:1）
- `--ring` `0.45 0.12 250` / `0.62 0.12 250`（改暗值，原焦点偏弱）
- `--destructive` `0.55 0.18 25` / `0.62 0.2 25`（改暗值，原红底红字）
- 新增 `--success`、`--info`、`--warning-foreground`；状态不只靠颜色
- 字体补 CJK 回退；圆角 `0.75rem` 与 4px 间距栅格保留；新增 `--duration-*`、全局 `:focus-visible` 2px

完整 token 表见 uiux 方案原文（本会话）。

## 3. 组件规范

- 合并：`EmptyState`（保留）/`Empty*`（deprecated）；`PageIntro`（页面级）/`PageHeader`（容器内）。
- 新增：`StatusBadge`、`PipelineProgress`、`GenerationStateBanner`、`ShotActionButton`（**外包**冻结的
  `ShotVideoButton`，只注入 aria-label / toast id / 焦点保持）、`MediaThumbnail`、`ThemeToggle`、`LanguageSwitch`、
  三个 ViewModel。
- 统一：禁整卡 `onClick`；去 `h-[400px]` 固定高度改 `flex-1 min-h-0`；每屏 ≤1 primary；
  进度用 `PipelineProgress` 表达阶段态，禁止 0/100 二值伪造。

## 4. 关键页面（6 个）

首页/故事列表、故事详情（剧本/分镜与镜头/资产/成片/设置 Tabs）、分镜与镜头工作台（**最高护理**）、
Studio 图像/视频/成片、资产库、设置（新增外观 Tab）。
每个页面需四态：加载（骨架）/ 空（EmptyState + CTA）/ 错误（重试 + 原因）/ 进行中（Banner + 禁用付费按钮）。

## 5. i18n（中文为主）

`src/ui/providers.tsx` 显式 import '@/i18n' + `<I18nextProvider>`；`__root.tsx` 的 lang 绑 i18n.language。
新增 `filmmaking.*` section；旧 `sequence.*`、`nav.sequences` 保留别名一版。
抽取优先级：P0 导航/面包屑/按钮状态空态 → P1 表单 label/toast/处理中文案 → P2 营销长文案保留中文。
日期新增 `formatDate(date, locale)` 于 `src/ui/format-date.ts`，按设备时区。
语言入口仅「中文（当前）」+ en disabled，通路先接好。分 3 期 PR。

## 6. a11y（已授权新增依赖）

1. `.storybook/preview.tsx:78-83` `a11y.test: 'todo'` → `'error'`（仅面板）。
2. 新增 `@storybook/test-runner` + `@axe-core/playwright` devDeps；新脚本 `test:a11y` 接 CI，
   critical/serious 违规 fail。
3. WCAG 2.2 AA：对比 ≥4.5:1（大文本/UI 3:1）、可见焦点、Tab 顺序、Dialog 焦点陷阱+Escape、
   状态带文字+图标、媒体 alt 带镜头号、触屏 44×44。
4. 新组件 0 违规才合入；历史 todo 只减不增。

## 7. 迁移路径（6 阶段，每阶段可独立回滚）

| 阶段            | 内容                                                          | 关键回归                                                                   |
| --------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| P0 基线冻结     | 锁 Chromatic 暗色基线 + 4708 单测 + 8 e2e spec + 视频按钮契约 | 全量门禁绿                                                                 |
| P1 主题基础设施 | token 重构、ThemeProvider、去硬编码 dark、ThemeToggle         | 暗色 Chromatic **零差异**、亮色新基线、全量单测                            |
| P2 IA/路由      | `/stories` 规范化、旧路由重定向、侧栏/面包屑                  | 8 e2e 的 URL/选择器；`/inkos/` 入口不受影响                                |
| P3 组件层       | 合并/新增组件、`ShotActionButton` 外包、去固定高度            | **视频按钮矩阵 7 项**、`filmmaking-panel.test.tsx` 逐条、full-sequence e2e |
| P4 i18n         | Provider + 三批抽取                                           | 缺失 key 回退中文、SSR 无闪烁、日期时区                                    |
| P5 a11y         | story 补齐 + test-runner + CI                                 | 新 story 0 critical/serious、键盘矩阵                                      |

**最高风险规避**：主题重构波及全站 → 默认暗 + 暗色像素零差异；IA 打断深链 → 旧路由全保留 redirect；
视频防重被顺手重构 → 列入冻结代码 + PR 模板勾选框；数据双源 → 本轮只做 ViewModel，DB 合并另立议题。

## 8. 验收口径

- 视觉：亮暗两主题无不可读文本；无硬编码颜色残留（仅 token 定义处允许）；术语无层级旧词露出；
  无整卡 onClick / 无 `h-[400px]` / icon-only 有 aria-label；每页四态有 story + 截图。
- Storybook/Chromatic：新增 story ≥12；P0 交互 story 带 `play` 断言；P1 暗色差异数 = 0。
- a11y：CI 新 story 0 critical/0 serious；键盘矩阵通过；对比度抽样亮暗各 10 处。
- 功能硬门槛：单测全绿（含视频按钮契约）、8 e2e 全绿、`test:e2e:full` 通过、视频/计费矩阵 7 项勾选。
- 签核：PM（术语/文案/语言）、开发（依赖/路由）、QA（a11y 规则/双主题基线/视频矩阵）。

### 8.1 硬编码颜色豁免清单（视觉走查结论）

§8「无硬编码颜色残留」的口径针对**应用界面的语义色**。以下类别保留原样，
不属于本次 token 化范围，不逐个改写；如后续要统一，另立议题并单独回归：

| 类别         | 范围                                                                                                 | 豁免理由                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 品牌资产     | `src/ui/icons/*logo.tsx`（OpenStory / OpenRouter / fal / xAI / Google / LLMTR / Kalami）             | 品牌标识色是资产定义的一部分，替换成主题 token 会改变商标呈现；本轮只做主题适配，不改品牌色。 |
| 服务端邮件   | `src/platform/server/emails/*`（OTP / 反馈 / 滥用举报等模板）                                        | 邮件在客户端之外渲染，无 `.dark` 上下文与主题 token；修改会波及邮件客户端兼容性与既有快照。   |
| 存量调色板类 | 走查统计的 48 处 Tailwind 调色板类（`bg-red-*` / `text-violet-*` 等）                                | 历史存量，多为状态/图表的点状用色；逐个替换不会提升本轮主题可用性，反而放大回归面。           |
| 装饰色       | `src/ui/shadcn/blob-loader.tsx` 品牌渐变、`src/motion/ui/video-state-overlay.tsx:103` 的 `rgba` 光晕 | 纯装饰性渐变/遮罩，不承载文本语义；`blob-loader.tsx` 已加注释指向本节。                       |

上述豁免**不含**本轮新增或改造的代码：新增主题入口、设置外观页、资产库选择器一律只使用语义 token。

## 9. P0 基线冻结（开工前置，可执行清单）

**当前基线**：commit `d5eec391`（main）。P0 只记录与锁定，不改 `src/`、`.storybook/`、`package.json`、
`chromatic.config.json`。环境必须先 `export PATH=/home/ubuntu/.local/node-v24/bin:/home/ubuntu/.bun/bin:$PATH`
（本机默认 node 18 会挂；本机 bun 1.4.2 vs CI 1.3.14，记录偏差）。

冻结对象：

1. **源码树**：记录 SHA + 工作树态；`git diff --exit-code -- src .storybook package.json chromatic.config.json vite.config.ts` 必须为 0。
2. **暗色 Chromatic 基线**：`chromatic.config.json:2` 是 `onlyChanged:true`——**P1 必须做一次全量比对**
   （临时关掉或等价全量构建）验暗色零差异，否则口径不成立；当前 29 个 story 文件、暗色 build 需 accepted。
3. **单测基线**：Node24 下 `bun run test`，实际总数以输出为准（4708 是用户口径，需核对），0 failed；
   视频按钮契约 7/7。
4. **e2e 基线**：8 个 spec 全绿 + `test:e2e:full`；`playwright.config.ts:45` 的 `colorScheme:'dark'` 登记为 P2 待改。
5. **视频按钮契约**：`filmmaking-panel.test.tsx:102-176` 的 7 条用例 + 三个冻结文件 sha256 存档；
   P3 的 `ShotActionButton` 只外包 aria-label/toast id/焦点，不改 props 与回调。
6. **亮色基线预留**：本阶段不产出截图，只登记触发方式（`globals.theme='light'`），P1 生成。
7. **静态门禁**：`db:check`、`db:generate` 无 drift、`typecheck`、`lint`、`format:check`、`dead-code` 全 0。

**视频按钮 7 条契约**（P3 不可破坏）：completed/approved 可生成 · pending/queued/generating 三种
in-flight 都禁用且零调用 · busy 禁用 · 未就绪禁用/无关键帧不渲染 · failed 终态可重试 ·
completed clip 优先播放且零生成。

**"基线已锁定"判定**：以上全部满足 + P0 记录（SHA / build ID / 测试总数 / sha256）归档 +
`ui-unification.md` 纳入版本管理。任何一项不满足，禁止 P1 开工。

**P1 允许动的文件**：`global.css`、`__root.tsx`、`providers.tsx`、`shadcn/sonner.tsx`、
`.storybook/preview.tsx`（仅主题 decorator）。**不得动**冻结区、`ai-filmmaking.fn.ts`、`chromatic.config.json`。

详见本会话 uiux 完整方案（含 6 页面线框、完整 token 表、组件清单、回归清单、P0 逐条命令）。
