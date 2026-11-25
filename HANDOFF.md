# OpenStory AI 视频生成平台 — 交接文档

## 项目概述

**OpenStory** 是一个 AI 驱动的影视创作平台，支持从小说/剧本自动生成视频内容。

- **访问地址**: https://creation.dakalami.com
- **服务器**: Oracle Cloud ARM (Ubuntu 24.04 aarch64, 2核, 12GB RAM)
- **技术栈**: TanStack Start + Bun + Cloudflare D1/R2 + Drizzle ORM

---

## 项目路径

```
/home/ubuntu/openstory/          # 主项目目录
├── src/
│   ├── stories/                 # 🎬 影视制作核心模块
│   │   ├── ai-filmmaking.fn.ts  # AI 分镜切分、资产生成
│   │   ├── filmmaking.fn.ts     # 制作流水线 Server Functions
│   │   ├── inkos-integration.ts # InkOS 数据库整合
│   │   ├── server/
│   │   │   └── storyboard-ai.ts # 分镜 AI 逻辑
│   │   └── ui/
│   │       └── filmmaking-panel.tsx  # 影视制作面板 UI
│   │
│   ├── motion/                  # 🎥 视频生成模块
│   │   ├── motion.fn.ts         # 视频生成 Server Function
│   │   ├── dialogue-tts.ts      # 对白 TTS
│   │   └── server/              # 视频后端逻辑
│   │
│   ├── stills/                  # 🖼️ 图像生成模块
│   │   ├── shot-image.fn.ts     # 关键帧图像生成
│   │   └── build-image-request.ts
│   │
│   ├── sequences/               # 📝 剧本/序列管理
│   │   ├── sequences.fn.ts      # 序列 CRUD
│   │   └── pipeline.ts          # 生成管线
│   │
│   ├── models/                  # 🤖 AI 模型目录
│   │   └── catalog.ts           # fal.ai 模型适配
│   │
│   ├── cast/                    # 👥 角色/场景资产
│   ├── look/                    # 🎨 风格设定
│   ├── audio/                   # 🎵 音频模块
│   ├── billing/                 # 💰 计费
│   └── platform/                # 🔧 基础设施
│
├── drizzle/migrations/          # 数据库迁移
├── CLAUDE.md                    # AI 助手指南（详细）
└── package.json
```

---

## 当前进度

### ✅ 已完成

| 模块             | 状态 | 说明                      |
| ---------------- | ---- | ------------------------- |
| 基础部署         | ✅   | HTTPS、域名、保活脚本     |
| 界面汉化         | ✅   | i18n 中文本地化           |
| 用户认证         | ✅   | Better Auth               |
| InkOS 整合       | ✅   | 数据库 schema 合并        |
| 分镜切分 AI      | ✅   | `ai-filmmaking.fn.ts`     |
| 影视面板 UI      | ✅   | `filmmaking-panel.tsx`    |
| Server Functions | ✅   | TanStack Start 服务端函数 |

### 🚧 进行中 / 待完成

| 模块           | 状态 | 说明                        |
| -------------- | ---- | --------------------------- |
| **关键帧生成** | 🚧   | UI 完成，需接入实际图像 API |
| **视频生成**   | 🚧   | 需接入 Seedance/fal.ai      |
| **资产管理**   | 🚧   | 角色/场景图像生成           |
| **视频拼接**   | ❌   | 最终导出功能                |
| **配音/音乐**  | ❌   | TTS + 背景音乐              |

---

## 核心数据模型

```typescript
// 影视制作数据流
Story Project
  └── Chapters (章节)
        └── Segments (15秒片段)
              └── Shots (镜头)
                    └── Keyframes (关键帧图像)
                          └── VideoClips (视频片段)

// 资产系统
Assets (角色/场景)
  └── AssetViews (多角度图像)
```

**数据库表** (定义在 `src/platform/server/db/schema.ts`):

- `story_projects` — 项目
- `story_chapters` — 章节
- `story_segments` — 分镜片段
- `story_shots` — 镜头
- `story_assets` — 角色/场景资产
- `story_asset_views` — 资产多角度图
- `story_keyframes` — 关键帧
- `story_video_clips` — 视频片段
- `story_film_settings` — 制作设置

---

## 关键 Server Functions

```typescript
// src/stories/filmmaking.fn.ts
getFilmSettingsFn; // 获取制作设置
updateFilmSettingsFn; // 更新设置
analyzeStoryboardFn; // AI 分镜分析
getFilmStatusFn; // 获取制作进度

// src/stories/ai-filmmaking.fn.ts
segmentChapterFn; // 章节 → 分镜切分
extractAssetsFn; // 提取角色/场景
generateAssetImageFn; // 生成资产图像
generateKeyframeFn; // 生成关键帧
generateVideoFn; // 生成视频片段

// src/stills/shot-image.fn.ts
generateShotImageFn; // 镜头图像生成

// src/motion/motion.fn.ts
submitMotionFn; // 提交视频生成任务
```

---

## 运行命令

```bash
cd /home/ubuntu/openstory

# 开发
bun dev                # 启动开发服务器 (端口 3000)
bun dev:node           # Node.js 模式启动

# 构建
bun run build          # 生产构建

# 数据库
bun db:migrate:local   # 本地迁移
bun db:studio:local    # 数据库管理界面

# 代码质量
bun lint               # 检查
bun typecheck          # 类型检查 (tsgo)
bun run test           # 单元测试
```

---

## AI 配置

当前使用的 AI 端点 (`src/stories/ai-filmmaking.fn.ts`):

```typescript
const AI_CONFIG = {
  baseUrl: 'https://kiro.dakalami.com/aiclient2api/claude-kiro-oauth/v1',
  apiKey: process.env.AI_API_KEY || '1234',
  model: 'claude-opus-4-6',
};
```

图像/视频生成使用 **fal.ai** 模型目录 (`src/models/catalog.ts`)。

---

## 待实现功能详解

### 1. 关键帧生成 (优先级: 高)

**位置**: `src/stills/shot-image.fn.ts`

**需要**:

- 接入 fal.ai 图像生成 API
- 根据 shot 描述 + 资产参考图生成关键帧
- 支持风格一致性控制

### 2. 视频生成 (优先级: 高)

**位置**: `src/motion/motion.fn.ts`

**需要**:

- 接入 Seedance 或其他视频生成 API
- 图生视频 (keyframe → video clip)
- 支持摄像机运动参数

### 3. 资产图像生成 (优先级: 中)

**位置**: `src/stories/ai-filmmaking.fn.ts` → `generateAssetImageFn`

**需要**:

- 角色设定图生成 (正面/侧面/背面)
- 场景设定图生成
- 风格一致性

### 4. 视频拼接导出 (优先级: 低)

**需要**:

- FFmpeg 视频片段拼接
- 配音轨道合成
- 背景音乐混音
- 最终 MP4 导出

---

## 环境变量

```bash
# .env.local
AI_API_KEY=xxx              # AI 对话 API
FAL_KEY=xxx                 # fal.ai 图像/视频
DATABASE_URL=xxx            # D1 数据库
R2_ACCESS_KEY_ID=xxx        # R2 存储
R2_SECRET_ACCESS_KEY=xxx
```

---

## 定时任务

```bash
# 保活脚本 (防止 Oracle 回收)
~/.hermes/scripts/openstory-keepalive.sh  # 每 15 分钟

# AI 日报
ai-daily-digest  # 每天 UTC 22:00
```

---

## 注意事项

1. **Bun vs Node**: 项目用 Bun 作为包管理器，但运行时是 Node (TanStack Start 要求)
2. **UI 组件路径**: `@/ui/shadcn/*` 是 shadcn/ui 组件
3. **Server Functions**: 文件以 `.fn.ts` 结尾，使用 TanStack Start 的 `createServerFn`
4. **类型检查**: 用 `bun typecheck` (tsgo)，不是 tsc
5. **详细指南**: 参考 `CLAUDE.md` 获取完整架构说明

---

## 联系方式

如有问题，查看:

- `CLAUDE.md` — 详细架构和代码规范
- `src/platform/server/db/schema.ts` — 完整数据库 schema
- GitHub Issues / 代码注释
