/**
 * Storyboard AI — 分镜切分 AI
 *
 * 使用 Claude API 将剧本/故事文本自动拆分成适合视频生成的片段和镜头。
 *
 * 流程：
 * 1. 获取章节内容
 * 2. 调用 Claude 进行分镜分析
 * 3. 批量创建 segments 和 shots
 */

import { z } from 'zod';
import { getDb } from '#db-client';
import {
  storyChapters,
  storySegments,
  storyShots,
} from '@/platform/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { getLogger } from '@/platform/logger';

const logger = getLogger(['openstory', 'storyboard-ai']);

// =============================================================================
// Types & Schemas
// =============================================================================

/** Shot analysis from AI */
export const ShotAnalysisSchema = z.object({
  shotNumber: z.number(),
  startTime: z.string(),
  duration: z.number(),
  shotSize: z.enum([
    'close-up',
    'medium',
    'wide',
    'establishing',
    'extreme-close-up',
    'full',
  ]),
  cameraAngle: z.enum([
    'eye-level',
    'high-angle',
    'low-angle',
    'over-shoulder',
    'dutch',
    'bird-eye',
    'worm-eye',
  ]),
  cameraMovement: z.enum([
    'static',
    'push-in',
    'pull-out',
    'pan',
    'tilt',
    'tracking',
    'crane',
    'handheld',
    'steadicam',
  ]),
  description: z.string(),
  action: z.string().optional(),
  dialogue: z.string().optional(),
  characters: z.array(z.string()).optional(),
  soundEffects: z.string().optional(),
  ambience: z.string().optional(),
  transition: z.enum(['cut', 'dissolve', 'fade', 'wipe']).default('cut'),
});

/** Segment analysis from AI */
export const SegmentAnalysisSchema = z.object({
  segmentNumber: z.number(),
  chapterNumber: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  duration: z.number(),
  narrativeFunction: z.string(),
  summary: z.string(),
  shots: z.array(ShotAnalysisSchema),
});

/** Full storyboard analysis response */
export const StoryboardAnalysisSchema = z.object({
  status: z.enum(['success', 'error']),
  analysis: z.object({
    totalDuration: z.number(),
    segmentCount: z.number(),
    shotCount: z.number(),
    mainCharacters: z.array(z.string()),
    locations: z.array(z.string()),
  }),
  segments: z.array(SegmentAnalysisSchema),
  error: z.string().optional(),
});

export type ShotAnalysis = z.infer<typeof ShotAnalysisSchema>;
export type SegmentAnalysis = z.infer<typeof SegmentAnalysisSchema>;
export type StoryboardAnalysis = z.infer<typeof StoryboardAnalysisSchema>;

// =============================================================================
// AI Configuration
// =============================================================================

const AI_CONFIG = {
  baseUrl: 'https://kiro.dakalami.com/aiclient2api/claude-kiro-oauth/v1',
  model: 'claude-opus-4-6',
  maxTokens: 8192,
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get all chapter content for a project
 */
export async function getProjectChapters(projectId: string): Promise<{
  chapters: Array<{ chapterNumber: number; title: string; content: string }>;
  totalWordCount: number;
}> {
  const db = getDb();
  const chapters = await db
    .select({
      chapterNumber: storyChapters.chapterNumber,
      title: storyChapters.title,
      content: storyChapters.content,
      wordCount: storyChapters.wordCount,
    })
    .from(storyChapters)
    .where(eq(storyChapters.projectId, projectId))
    .orderBy(asc(storyChapters.chapterNumber))
    .all();

  const totalWordCount = chapters.reduce(
    (sum, ch) => sum + (ch.wordCount || 0),
    0
  );

  return { chapters, totalWordCount };
}

/**
 * Call Claude API for storyboard analysis
 */
export async function analyzeStoryboard(
  storyText: string,
  options: {
    targetDuration?: number; // Target video duration in seconds
    segmentDuration?: number; // Target segment duration (default 15s)
    aspectRatio?: '9:16' | '16:9';
    apiKey: string;
  }
): Promise<StoryboardAnalysis> {
  const {
    targetDuration,
    segmentDuration = 15,
    aspectRatio = '9:16',
    apiKey,
  } = options;

  const systemPrompt = `你是一位专业的影视分镜师和剧本分析专家。你的任务是将剧本/故事文本拆分成适合视频生成的片段和镜头。

## 核心原则

1. **片段(Segment)**: 每个片段约${segmentDuration}秒，代表一个完整的叙事单元
2. **镜头(Shot)**: 每个片段包含2-5个镜头，每个镜头是一个连续的画面
3. **时间估算**: 基于对白长度、动作复杂度估算时长
${targetDuration ? `4. **目标时长**: 整体视频目标时长约${targetDuration}秒` : ''}

## 分析步骤

1. 先识别故事的主要段落/场景边界
2. 将每个段落拆分成${segmentDuration}秒左右的片段
3. 为每个片段设计具体镜头

## 镜头设计要素

每个镜头需要包含：
- **景别(shotSize)**: close-up(特写), medium(中景), wide(全景), establishing(远景), extreme-close-up(大特写), full(全身)
- **机位角度(cameraAngle)**: eye-level(平视), high-angle(俯拍), low-angle(仰拍), over-shoulder(过肩), dutch(倾斜), bird-eye(鸟瞰), worm-eye(虫视)
- **运镜(cameraMovement)**: static(静止), push-in(推), pull-out(拉), pan(摇), tilt(俯仰), tracking(移), crane(升降), handheld(手持), steadicam(稳定器)
- **视觉描述(description)**: 画面中的具体内容，必须具体、可视化
- **动作(action)**: 角色或物体的动态
- **对白(dialogue)**: 如有台词
- **音效(soundEffects)**: 环境音、特效音
- **转场(transition)**: cut(切), dissolve(溶), fade(淡), wipe(划)

## 画面比例

当前视频画面比例: ${aspectRatio}
- 9:16 竖屏：适合手机观看，人物特写为主，构图要考虑竖向空间
- 16:9 横屏：适合传统影视，场景全景更有表现力

## 注意事项

1. 每个镜头的description必须具体、可视化，能直接用于AI图像生成
2. 保持视觉连贯性：相邻镜头的场景、光线、角色位置要合理衔接
3. 控制单镜头时长：对白镜头3-6秒，动作镜头2-4秒，空镜头2-3秒
4. 叙事节奏：开场慢、高潮快、结尾收
5. 输出纯JSON，不要markdown代码块

输出JSON结构严格遵循以下格式：
{
  "status": "success",
  "analysis": {
    "totalDuration": <总时长秒数>,
    "segmentCount": <片段数>,
    "shotCount": <镜头总数>,
    "mainCharacters": ["角色名1", "角色名2"],
    "locations": ["场景1", "场景2"]
  },
  "segments": [...]
}`;

  const userPrompt = `请分析以下故事/剧本文本，将其拆分成适合视频生成的片段和镜头：

<STORY>
${storyText}
</STORY>

请输出完整的分镜分析JSON。`;

  try {
    logger.info('[StoryboardAI] Starting analysis', {
      textLength: storyText.length,
      targetDuration,
      segmentDuration,
    });

    const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[StoryboardAI] API error', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null || !('choices' in data)) {
      throw new Error('AI returned an invalid response');
    }
    const choices = data.choices;
    if (!Array.isArray(choices)) {
      throw new Error('AI returned an invalid choices payload');
    }
    const firstChoice = choices[0];
    const content =
      typeof firstChoice === 'object' &&
      firstChoice !== null &&
      'message' in firstChoice &&
      typeof firstChoice.message === 'object' &&
      firstChoice.message !== null &&
      'content' in firstChoice.message &&
      typeof firstChoice.message.content === 'string'
        ? firstChoice.message.content
        : undefined;

    if (!content) {
      throw new Error('AI returned empty content');
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);
    const validated = StoryboardAnalysisSchema.parse(parsed);

    logger.info('[StoryboardAI] Analysis complete', {
      segments: validated.analysis.segmentCount,
      shots: validated.analysis.shotCount,
      duration: validated.analysis.totalDuration,
    });

    return validated;
  } catch (error) {
    logger.error('[StoryboardAI] Analysis failed', { error });
    return {
      status: 'error',
      analysis: {
        totalDuration: 0,
        segmentCount: 0,
        shotCount: 0,
        mainCharacters: [],
        locations: [],
      },
      segments: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save storyboard analysis to database
 */
export async function saveStoryboardToDb(
  projectId: string,
  analysis: StoryboardAnalysis
): Promise<{
  segmentIds: string[];
  shotIds: string[];
}> {
  if (analysis.status !== 'success' || analysis.segments.length === 0) {
    throw new Error(analysis.error || 'No segments to save');
  }

  const db = getDb();
  const segmentIds: string[] = [];
  const shotIds: string[] = [];

  for (const segment of analysis.segments) {
    // Create segment
    const createdSegment = await db
      .insert(storySegments)
      .values({
        projectId,
        chapterNumber: segment.chapterNumber,
        segmentNumber: segment.segmentNumber,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration,
        narrativeFunction: segment.narrativeFunction,
        summary: segment.summary,
        status: 'storyboarded',
      })
      .returning()
      .get();

    segmentIds.push(createdSegment.id);

    // Create shots for this segment
    for (const shot of segment.shots) {
      const createdShot = await db
        .insert(storyShots)
        .values({
          segmentId: createdSegment.id,
          projectId,
          shotNumber: shot.shotNumber,
          startTime: shot.startTime,
          duration: shot.duration,
          shotSize: shot.shotSize,
          cameraAngle: shot.cameraAngle,
          cameraMovement: shot.cameraMovement,
          description: shot.description,
          action: shot.action,
          dialogue: shot.dialogue,
          characters: shot.characters,
          soundEffects: shot.soundEffects,
          ambience: shot.ambience,
          transition: shot.transition,
        })
        .returning()
        .get();

      shotIds.push(createdShot.id);
    }
  }

  logger.info('[StoryboardAI] Saved to database', {
    projectId,
    segments: segmentIds.length,
    shots: shotIds.length,
  });

  return { segmentIds, shotIds };
}

/**
 * Clear existing storyboard data for a project
 */
export async function clearProjectStoryboard(projectId: string): Promise<void> {
  const db = getDb();

  // Shots will be cascade deleted with segments
  await db.delete(storySegments).where(eq(storySegments.projectId, projectId));

  logger.info('[StoryboardAI] Cleared existing storyboard', { projectId });
}

/**
 * Get storyboard status for a project
 */
export async function getStoryboardStatus(projectId: string): Promise<{
  hasStoryboard: boolean;
  segmentCount: number;
  shotCount: number;
  totalDuration: number;
}> {
  const db = getDb();

  const segments = await db
    .select()
    .from(storySegments)
    .where(eq(storySegments.projectId, projectId))
    .all();

  const shots = await db
    .select()
    .from(storyShots)
    .where(eq(storyShots.projectId, projectId))
    .all();

  const totalDuration = segments.reduce((sum, s) => sum + (s.duration || 0), 0);

  return {
    hasStoryboard: segments.length > 0,
    segmentCount: segments.length,
    shotCount: shots.length,
    totalDuration,
  };
}
