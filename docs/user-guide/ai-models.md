---
title: AI 模型
description: OpenStory 所有可用 AI 模型的完整参考
section: User Guide
order: 12
---

OpenStory 集成了多种 AI 模型，分为四类：剧本分析、图像生成、动态/视频生成以及音乐/音频生成。所有媒体模型均通过 [Fal.ai](https://fal.ai) 访问，剧本分析则使用 [OpenRouter](https://openrouter.ai)。

## 剧本分析模型

这些 LLM 模型会分析剧本、提取场景、角色和地点，并生成提示词。你可以选择多个模型并行生成序列以便比较。**生成**按钮旁默认选择 **Turbo**（Luna、Nano Banana 2 Lite、MiniMax H3 Max、ElevenLabs）。**Quality** 会选择按质量排名的默认模型。两种模式都会显示按 Fast / Quality 分组的完整目录。

| 模型               | 提供商    | 上下文窗口 | 许可证                 |
| ------------------ | --------- | ---------- | ---------------------- |
| **GPT-5.6 Luna**   | OpenAI    | 1M 词元    | 专有（默认）           |
| Claude Fable 5     | Anthropic | 1M 词元    | 专有                   |
| Claude Opus 5      | Anthropic | 1M 词元    | 专有（场景拆分）       |
| Claude Opus 5 Fast | Anthropic | 1M 词元    | 专有                   |
| Gemini 3.7 Flash   | Google    | 1M 词元    | 专有                   |
| Gemini 3.1 Pro     | Google    | 1M 词元    | 专有                   |
| GPT-5.6 Sol        | OpenAI    | 1M 词元    | 专有                   |
| GLM-5.3 Flash      | Z.ai      | 1M 词元    | 开放权重（MIT）        |
| GPT-5.6 Terra      | OpenAI    | 1M 词元    | 专有                   |
| DeepSeek V4 Pro    | DeepSeek  | 1M 词元    | 开放权重（MIT）        |
| Claude Sonnet 5    | Anthropic | 1M 词元    | 专有                   |
| Grok 4.6           | SpaceXAI  | 500K 词元  | 专有                   |
| Mistral Small 4    | Mistral   | 262K 词元  | 开放权重（Apache 2.0） |
| Seed 2.0 Mini      | ByteDance | 262K 词元  | 专有                   |

## 图像生成模型

这些模型为每个场景创建视觉图像。你可以选择多个模型生成变体图像以便比较。

| 模型                       | 提供商            | 许可证                 | 备注                                                  |
| -------------------------- | ----------------- | ---------------------- | ----------------------------------------------------- |
| **Nano Banana 2 Lite**     | Google            | 专有                   | Turbo 默认——Google 最快档，支持参考，固定 1K          |
| GPT Image 2                | OpenAI            | 专有                   | Quality 默认——文字渲染、UI 保真度，最高 4K            |
| Nano Banana 2              | Google            | 专有                   | 快速生成和编辑                                        |
| Nano Banana Pro            | Google            | 专有                   | 增强的真实感和排版能力                                |
| Grok Imagine Image 2.0     | SpaceXAI          | 专有                   | 最新 Imagine 图像模型，支持 1K/2K，最多编辑 3 个参考  |
| Grok Imagine Image Quality | SpaceXAI          | 专有                   | Quality 模式——更高保真度和更强文字能力                |
| FLUX.2 Max                 | Black Forest Labs | 专有                   | 出色的真实感                                          |
| Phota                      | Phota             | 专有                   | 通过角色档案保持角色一致性                            |
| Hunyuan Image v3           | Tencent           | 开放权重               | 构图能力强                                            |
| FLUX.2 Dev                 | Black Forest Labs | 开放权重               | 32B 开放权重，支持原生编辑                            |
| Qwen Image 2 Pro           | Alibaba           | 开放权重（Apache 2.0） | 原生 2K，支持文字渲染                                 |
| HiDream I1                 | HiDream           | 开放权重（MIT）        | 17B 参数                                              |
| Seedream 5.0 Pro           | ByteDance         | 专有                   | 旗舰级生成和编辑                                      |
| FLUX.2 Flash               | Black Forest Labs | 开放权重               | 成本最低的 FLUX.2 蒸馏模型——亚秒级，最多编辑 4 个参考 |
| FLUX.2 Turbo               | Black Forest Labs | 开放权重               | FLUX.2 蒸馏模型——约 2 秒，最多编辑 4 个参考           |

### 编辑端点

大多数图像模型都通过专用编辑端点支持**参考图编辑**。借助此功能，AI 在生成场景时可以使用角色和地点参考图，从而改善视觉一致性。

## 动态/视频模型

这些模型可以将静态图制作成视频片段。

| 模型                   | 提供商    | 预计时间    | 许可证 | 备注                                     |
| ---------------------- | --------- | ----------- | ------ | ---------------------------------------- |
| **MiniMax H3 Max**     | MiniMax   | 约 10 秒    | 专有   | Turbo 默认；原生音频                     |
| **Seedance 2.0**       | ByteDance | 约 3.5 分钟 | 专有   | Quality 默认；原生音频                   |
| Seedance 2.0 Mini      | ByteDance | 约 2 分钟   | 专有   | 价格为 2.0 的一半，720p；仅通过 BytePlus |
| Grok Imagine Video 1.5 | SpaceXAI  | 约 30 秒    | 专有   | 质量排名最高                             |
| Kling 3.0 Omni         | Kling     | 约 5 分钟   | 专有   |                                          |

### 宽高比兼容性

并非所有动态模型都支持全部宽高比。OpenStory 会自动筛选并只显示兼容模型；如果当前模型不支持所选比例，则会切换到兼容的默认模型。

### 音频支持

部分动态模型可以同时生成视频和音频。OpenStory 会检查各模型的功能以确定是否支持音频。

## 音乐与音频模型

| 模型                 | 提供商     | 最长时长        | 类型 | 许可证       |
| -------------------- | ---------- | --------------- | ---- | ------------ |
| **ElevenLabs Music** | ElevenLabs | 600s（10 分钟） | 音乐 | 专有（默认） |
| ACE-Step 1.5         | ACE Studio | 600s（10 分钟） | 音乐 | 开放权重     |
| ACE-Step             | ACE Studio | 240s（4 分钟）  | 音乐 | 开放权重     |

### 音乐与音效

音乐模型根据文本提示词和可选标签生成背景音乐轨道。

### 功能

| 功能       | ElevenLabs Music | ACE-Step 1.5  | ACE-Step     |
| ---------- | ---------------- | ------------- | ------------ |
| 基于提示词 | 是               | 是            | 是           |
| 支持歌词   | 否               | 是            | 是           |
| 纯音乐     | 是               | 是            | 是           |
| 长音频     | 是（10 分钟）    | 是（10 分钟） | 是（4 分钟） |
