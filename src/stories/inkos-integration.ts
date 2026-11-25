/**
 * InkOS Integration Layer
 *
 * Bridges OpenStory's project system with InkOS core for AI-powered story creation.
 * InkOS handles: story structure, memory, hooks, chapters, AI writing pipeline
 * OpenStory handles: teams, cast visuals, filmmaking pipeline (segments, shots, assets, keyframes, video)
 */

// NOTE: We import ONLY types from @actalk/inkos-core to avoid Zod v4 JIT issues
// in Cloudflare Workers (CSP blocks `new Function()`). The BookConfigSchema
// value import was removed because it triggered Zod's compile probe.
import type {
  BookConfig,
  ChapterMeta,
  RuntimeStateDelta,
  HookRecord,
  ChapterSummaryRow,
  CurrentStateFact,
} from '@actalk/inkos-core';

// Re-export InkOS types for use in OpenStory
export type {
  BookConfig,
  ChapterMeta,
  RuntimeStateDelta,
  HookRecord,
  ChapterSummaryRow,
  CurrentStateFact,
};

/**
 * Maps OpenStory story project to InkOS BookConfig
 *
 * NOTE: We manually construct the BookConfig instead of using BookConfigSchema.parse()
 * to avoid Zod v4 JIT compilation issues in Cloudflare Workers environment.
 */
export function toInkOSBookConfig(project: {
  id: string;
  name: string;
  description?: string | null;
  settings?: {
    genre?: string;
    tone?: string;
    targetLength?: number;
    language?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}): BookConfig {
  const settings = project.settings || {};

  // Manual construction (validated at TypeScript level, not runtime Zod)
  return {
    id: project.id,
    title: project.name,
    platform: 'other',
    genre: settings.genre || 'general',
    status: 'active',
    targetChapters: settings.targetLength || 200,
    chapterWordCount: 3000,
    language: settings.language === 'en' ? 'en' : 'zh',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/**
 * Film project pipeline stages
 */
export type FilmPipelineStage =
  | 'story' // 原始故事 (InkOS)
  | 'screenplay' // 剧本创作 (InkOS agents)
  | 'storyboard' // 分镜切分
  | 'assets' // 资产设定
  | 'keyframes' // 关键帧生成
  | 'video'; // 视频生成

/**
 * Film project status tracking
 */
export interface FilmProjectStatus {
  currentStage: FilmPipelineStage;
  stages: {
    story: { completed: boolean; chapterCount: number };
    screenplay: { completed: boolean; sceneCount: number };
    storyboard: { completed: boolean; segmentCount: number; shotCount: number };
    assets: {
      completed: boolean;
      characterCount: number;
      sceneAssetCount: number;
    };
    keyframes: {
      completed: boolean;
      keyframeCount: number;
      approvedCount: number;
    };
    video: { completed: boolean; clipCount: number; generatedCount: number };
  };
  totalProgress: number; // 0-100
}

/**
 * Calculate film project status from database counts
 */
export function calculateFilmStatus(counts: {
  chapters: number;
  segments: number;
  shots: number;
  characterAssets: number;
  sceneAssets: number;
  keyframes: number;
  approvedKeyframes: number;
  videoClips: number;
  generatedClips: number;
}): FilmProjectStatus {
  const stages = {
    story: {
      completed: counts.chapters > 0,
      chapterCount: counts.chapters,
    },
    screenplay: {
      completed: counts.chapters > 0, // Screenplay comes from InkOS chapters
      sceneCount: counts.chapters,
    },
    storyboard: {
      completed: counts.segments > 0 && counts.shots > 0,
      segmentCount: counts.segments,
      shotCount: counts.shots,
    },
    assets: {
      completed: counts.characterAssets > 0,
      characterCount: counts.characterAssets,
      sceneAssetCount: counts.sceneAssets,
    },
    keyframes: {
      completed: counts.approvedKeyframes > 0,
      keyframeCount: counts.keyframes,
      approvedCount: counts.approvedKeyframes,
    },
    video: {
      completed: counts.generatedClips > 0,
      clipCount: counts.videoClips,
      generatedCount: counts.generatedClips,
    },
  };

  // Calculate overall progress
  let completedStages = 0;
  if (stages.story.completed) completedStages++;
  if (stages.screenplay.completed) completedStages++;
  if (stages.storyboard.completed) completedStages++;
  if (stages.assets.completed) completedStages++;
  if (stages.keyframes.completed) completedStages++;
  if (stages.video.completed) completedStages++;

  const totalProgress = Math.round((completedStages / 6) * 100);

  // Determine current stage
  let currentStage: FilmPipelineStage = 'story';
  if (stages.story.completed && !stages.screenplay.completed)
    currentStage = 'screenplay';
  else if (stages.screenplay.completed && !stages.storyboard.completed)
    currentStage = 'storyboard';
  else if (stages.storyboard.completed && !stages.assets.completed)
    currentStage = 'assets';
  else if (stages.assets.completed && !stages.keyframes.completed)
    currentStage = 'keyframes';
  else if (stages.keyframes.completed) currentStage = 'video';

  return {
    currentStage,
    stages,
    totalProgress,
  };
}

/**
 * Storyboard generation config
 */
export interface StoryboardConfig {
  segmentDuration: number; // seconds per segment (default: 15)
  targetTotalDuration: number; // total film duration in seconds
  aspectRatio: '9:16' | '16:9';
  visualStyle: string;
}

/**
 * Convert InkOS chapter content to storyboard segments
 * Each chapter maps to multiple 15-second segments
 */
export interface SegmentFromChapter {
  chapterNumber: number;
  segmentNumber: number;
  startTime: string;
  endTime: string;
  duration: number;
  narrativeFunction: string;
  summary: string;
}

/**
 * Shot breakdown for a segment
 */
export interface ShotBreakdown {
  shotNumber: number;
  startTime: string;
  duration: number;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  description: string;
  action?: string;
  dialogue?: string;
  characters: string[];
  soundEffects?: string;
  music?: string;
  transition: string;
}

/**
 * AI prompt templates for different pipeline stages
 */
export const PIPELINE_PROMPTS = {
  /**
   * Convert screenplay/chapter to storyboard segments
   */
  chapterToSegments: (
    chapter: { title: string; content: string },
    config: StoryboardConfig
  ) => `
你是一位专业的分镜师。请将以下剧本章节转换为${config.segmentDuration}秒一段的分镜片段。

## 章节内容
标题：${chapter.title}
${chapter.content}

## 输出要求
- 每个片段${config.segmentDuration}秒
- 画幅：${config.aspectRatio}
- 视觉风格：${config.visualStyle}

请输出JSON数组，每个片段包含：
- segmentNumber: 片段序号
- startTime: 开始时间码 (HH:MM:SS)
- endTime: 结束时间码
- narrativeFunction: 叙事功能（如"开场钩子"、"情节转折"、"情感高潮"）
- summary: 片段内容摘要
`,

  /**
   * Break down a segment into individual shots
   */
  segmentToShots: (
    segment: { summary: string; narrativeFunction: string },
    characters: string[]
  ) => `
你是一位专业的分镜师。请将以下片段分解为具体的镜头。

## 片段信息
叙事功能：${segment.narrativeFunction}
内容：${segment.summary}
可用角色：${characters.join('、')}

## 输出要求
请输出JSON数组，每个镜头包含：
- shotNumber: 镜头序号
- duration: 时长（秒，可以是小数）
- shotSize: 景别（extreme-wide/wide/full/medium-wide/medium/medium-close/close-up/extreme-close/insert）
- cameraAngle: 角度（eye-level/high/low/dutch/overhead/pov）
- cameraMovement: 运动（static/pan/tilt/dolly/track/crane/handheld/zoom）
- description: 画面描述
- action: 动作描述
- dialogue: 台词（如有）
- characters: 出镜角色数组
- soundEffects: 音效提示
- music: 音乐提示
- transition: 转场（cut/fade/dissolve/wipe）
`,

  /**
   * Generate character design prompt
   */
  characterDesign: (character: {
    name: string;
    description?: string;
    traits?: string;
  }) => `
请为以下角色生成设定图提示词（用于AI图像生成）。

## 角色信息
名称：${character.name}
描述：${character.description || '无'}
特征：${character.traits || '无'}

## 输出要求
生成一个详细的英文提示词，用于生成16:9横版角色设定图：
- 左侧：面部特写
- 右侧：三视图（正面、侧面、背面）
- 风格：皮克斯3D卡通渲染
- 包含角色的标志性颜色、服装、配饰等视觉识别点
`,

  /**
   * Generate keyframe prompt from shot
   */
  shotToKeyframe: (
    shot: ShotBreakdown,
    characters: { name: string; visualIdentifiers?: string }[]
  ) => `
请为以下镜头生成关键帧图像提示词。

## 镜头信息
景别：${shot.shotSize}
角度：${shot.cameraAngle}
画面描述：${shot.description}
动作：${shot.action || '无'}
台词：${shot.dialogue || '无'}
角色：${shot.characters.join('、')}

## 角色视觉参考
${characters.map((c) => `- ${c.name}: ${c.visualIdentifiers || '无特定标识'}`).join('\n')}

## 输出要求
生成一个详细的英文提示词，用于生成9:16竖屏关键帧图像。
包含：场景、角色、动作、情绪、光线、构图等细节。
`,
};
