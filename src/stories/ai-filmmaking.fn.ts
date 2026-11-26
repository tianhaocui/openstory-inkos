/**
 * AI 影视制作 Server Functions
 *
 * 包含：分镜切分、资产生成、关键帧生成、视频生成
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { getCustomAiConfig } from '@/models/server/custom-ai-config';
import { authWithTeamMiddleware } from '@/platform/middleware.fn';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  safeImageToVideoModel,
  safeTextToImageModel,
} from '@/models/models';
import { aspectRatioSchema, type AspectRatio } from '@/models/aspect-ratios';
import { resolveShotDuration } from '@/motion/resolve-shot-duration';
import { generateId } from '@/platform/id';
import {
  generateAndStoreStoryImage,
  type StoredStoryImage,
} from './server/story-image-generation';
import { toWorkflowScopedDb } from '@/platform/server/db/scoped-workflow';
import { getEffectiveFalPricing } from '@/billing/server/fal-pricing-live';
import {
  estimateImageCost,
  estimateVideoCost,
  gateEstimate,
} from '@/billing/cost-estimation';
import {
  releaseReservationOnThrow,
  requireCredits,
  reserveRunCredits,
} from '@/billing/server/preflight';
import {
  deductWorkflowCredits,
  extractImageCost,
  recordFalUsage,
} from '@/billing/server/workflow-deduction';
import { triggerWorkflow } from '@/platform/server/workflow/client';
import type { StoryVideoWorkflowInput } from '@/platform/server/workflow/types';
import { sanitizeFailResponse } from '@/platform/server/workflow/sanitize-fail-response';
import type { ScopedDb } from '@/platform/server/db/scoped';

// ============================================================================
// AI 配置
// ============================================================================

// Single env source: see custom-ai-config.ts (getEnv-backed, sees Worker
// secrets); `process.env` does not.

const chatCompletionResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })),
});

type StoryGenerationContext = {
  teamId: string;
  user: { id: string };
  scopedDb: ScopedDb;
};

function nowIso(): string {
  return new Date().toISOString();
}

/** Statuses that already hold a clip row and a credit reservation. */
export function isStoryVideoInFlight(status: string): boolean {
  return status === 'pending' || status === 'queued' || status === 'generating';
}

function secondsToTimecode(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

async function requireStoryProject(
  projectId: string,
  storiesDb: ScopedDb['stories']
) {
  // The scoped read filters by the caller's team, same as the old
  // (id, teamId) predicate.
  const project = await storiesDb.getProject(projectId);
  if (!project) throw new Error('Project not found');
  return project;
}

function resolveStoryAspectRatio(
  value: string | null | undefined
): AspectRatio {
  const parsed = aspectRatioSchema.safeParse(value);
  return parsed.success ? parsed.data : '9:16';
}

async function requireStoryImageCredits(
  context: StoryGenerationContext,
  model: ReturnType<typeof safeTextToImageModel>,
  aspectRatio: AspectRatio,
  hasReferences: boolean
): Promise<void> {
  await requireCredits(
    context.scopedDb,
    gateEstimate(
      estimateImageCost(model, aspectRatio, 1, {
        pricing: await getEffectiveFalPricing(),
        edit: hasReferences,
      }),
      { model, operation: 'shot-image' }
    ),
    {
      providers: ['fal'],
      errorMessage: 'Insufficient credits to generate story image',
    }
  );
}

async function recordAndChargeStoryImage(
  context: StoryGenerationContext,
  image: StoredStoryImage,
  description: string,
  idempotencyKey: string
): Promise<void> {
  const workflowDb = toWorkflowScopedDb(context.scopedDb);
  await recordFalUsage(workflowDb, image.metadata);
  await deductWorkflowCredits({
    scopedDb: workflowDb,
    costMicros: extractImageCost(image.metadata),
    usedOwnKey: image.metadata.usedOwnKey,
    description,
    idempotencyKey,
    metadata: {
      endpointId: image.metadata.endpointId,
      requestId: image.metadata.requestId,
      unitsBilled: image.metadata.unitsBilled,
      numImages: image.metadata.numImages,
    },
    workflowName: 'StoryImageGeneration',
  });
}

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8000
): Promise<string> {
  const aiConfig = getCustomAiConfig();
  if (!aiConfig.apiKey) {
    throw new Error('AI_API_KEY is not configured');
  }
  const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error: ${response.status} - ${error}`);
  }

  const data = chatCompletionResponseSchema.parse(await response.json());
  return data.choices[0]?.message.content ?? '';
}

// ============================================================================
// AI 分镜切分 — 将章节内容拆分成 15 秒片段和镜头
// ============================================================================

const segmentChapterSchema = z.object({
  projectId: z.string(),
  chapterNumber: z.number(),
});

export const segmentChapterFn = createServerFn()
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(segmentChapterSchema))
  .handler(async ({ data, context }) => {
    const { projectId, chapterNumber } = data;
    const storiesDb = context.scopedDb.stories;
    const project = await requireStoryProject(projectId, storiesDb);

    // 1. 获取章节内容
    const chapter = await storiesDb.getChapterByNumber(
      projectId,
      chapterNumber
    );

    if (!chapter) {
      throw new Error(`Chapter ${chapterNumber} not found`);
    }

    // 2. 调用 AI 进行分镜切分
    const prompt = buildSegmentationPrompt(chapter.content, project.name);

    const content = await callAI(SEGMENTATION_SYSTEM_PROMPT, prompt);
    if (!content) {
      throw new Error('AI response empty');
    }

    // 4. 解析 AI 返回的 JSON
    const segmentData = parseSegmentationResponse(content);

    // 5. 批量插入片段和镜头
    const createdSegments: string[] = [];

    for (const seg of segmentData.segments) {
      const segmentId = generateId();
      const timestamp = nowIso();

      await storiesDb.createSegment({
        id: segmentId,
        projectId,
        chapterNumber,
        segmentNumber: seg.segmentNumber,
        startTime: secondsToTimecode(seg.startTime),
        endTime: secondsToTimecode(seg.endTime),
        duration: seg.duration,
        narrativeFunction: seg.narrativeFunction,
        summary: seg.summary,
        status: 'draft',
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      createdSegments.push(segmentId);

      // 插入镜头
      let shotStartTime = 0;
      for (const shot of seg.shots) {
        await storiesDb.createShot({
          id: generateId(),
          segmentId,
          projectId,
          shotNumber: shot.shotNumber,
          startTime: secondsToTimecode(shotStartTime),
          shotSize: shot.shotSize,
          cameraAngle: shot.cameraAngle,
          cameraMovement: shot.cameraMovement,
          dialogue: shot.dialogue,
          soundEffects: shot.soundEffects,
          description: shot.description,
          duration: shot.duration,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        shotStartTime += shot.duration;
      }
    }

    return {
      success: true,
      segmentsCreated: createdSegments.length,
      totalShots: segmentData.segments.reduce(
        (acc, s) => acc + s.shots.length,
        0
      ),
    };
  });

// ============================================================================
// AI 资产生成 — 生成角色/场景设定图
// ============================================================================

const generateAssetSchema = z.object({
  projectId: z.string(),
  assetId: z.string(),
  viewAngle: z.string().optional(),
});

export const generateAssetImageFn = createServerFn()
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(generateAssetSchema))
  .handler(async ({ data, context }) => {
    const { projectId, assetId, viewAngle } = data;
    const storiesDb = context.scopedDb.stories;
    await requireStoryProject(projectId, storiesDb);

    // 1. 获取资产信息
    const asset = await storiesDb.getAssetByIdAndProject(assetId, projectId);

    if (!asset) {
      throw new Error('Asset not found');
    }

    const settings = await storiesDb.getFilmSettings(projectId);
    const aspectRatio = resolveStoryAspectRatio(settings?.aspectRatio);
    const model = safeTextToImageModel(
      settings?.preferredImageModel,
      DEFAULT_IMAGE_MODEL
    );

    // 2. 构建图像生成 prompt
    const prompt = buildAssetPrompt(asset, viewAngle);
    const viewId = generateId();
    const attemptId = generateId();
    const timestamp = nowIso();
    await storiesDb.createAssetView({
      id: viewId,
      assetId,
      viewAngle:
        viewAngle ||
        (asset.type === 'character' || asset.type === 'character-design'
          ? 'front'
          : 'wide'),
      prompt,
      generatedBy: model,
      generationParams: { aspectRatio, attemptId },
      status: 'generating',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await storiesDb.updateAsset(assetId, {
      status: 'generating',
      updatedAt: timestamp,
    });

    try {
      const generationContext: StoryGenerationContext = context;
      await requireStoryImageCredits(
        generationContext,
        model,
        aspectRatio,
        false
      );
      const image = await generateAndStoreStoryImage({
        teamId: context.teamId,
        userId: context.user.id,
        projectId,
        recordId: viewId,
        kind: 'assets',
        model,
        prompt,
        aspectRatio,
        credentials: toWorkflowScopedDb(context.scopedDb).credentials,
      });
      await recordAndChargeStoryImage(
        generationContext,
        image,
        `Story asset image (${model})`,
        `story-asset:${viewId}:${attemptId}`
      );

      const completedAt = nowIso();
      await storiesDb.updateAssetView(viewId, {
        imageUrl: image.url,
        imagePath: image.path,
        generatedBy: model,
        generationParams: {
          aspectRatio,
          attemptId,
          via: image.via,
          endpointId: image.metadata.endpointId,
          requestId: image.metadata.requestId,
        },
        status: 'completed',
        updatedAt: completedAt,
      });
      await storiesDb.updateAsset(assetId, {
        status: 'completed',
        updatedAt: completedAt,
      });

      return { success: true, viewId, imageUrl: image.url };
    } catch (error) {
      const message = sanitizeFailResponse(error);
      await storiesDb.updateAssetView(viewId, {
        status: 'failed',
        generationParams: { aspectRatio, attemptId, error: message },
        updatedAt: nowIso(),
      });
      await storiesDb.updateAsset(assetId, {
        status: 'draft',
        updatedAt: nowIso(),
      });
      throw error;
    }
  });

// ============================================================================
// AI 关键帧生成 — 为镜头生成关键帧图像
// ============================================================================

const generateKeyframeSchema = z.object({
  projectId: z.string(),
  shotId: z.string(),
  referenceAssetIds: z.array(z.string()).optional(),
});

export const generateKeyframeFn = createServerFn()
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(generateKeyframeSchema))
  .handler(async ({ data, context }) => {
    const { projectId, shotId, referenceAssetIds } = data;
    const storiesDb = context.scopedDb.stories;
    await requireStoryProject(projectId, storiesDb);

    // 1. 获取镜头信息
    const shot = await storiesDb.getShotByIdAndProject(shotId, projectId);

    if (!shot) {
      throw new Error('Shot not found');
    }

    const settings = await storiesDb.getFilmSettings(projectId);
    const aspectRatio = resolveStoryAspectRatio(settings?.aspectRatio);
    const model = safeTextToImageModel(
      settings?.preferredImageModel,
      DEFAULT_IMAGE_MODEL
    );

    // Explicit references are validated against this project. Without an
    // explicit selection, attach generated assets whose names occur in the
    // shot description so the existing UI still gets consistency references.
    const projectAssets = await storiesDb.listProjectAssets(projectId);
    const requestedAssetIds = referenceAssetIds
      ? [...new Set(referenceAssetIds)]
      : projectAssets
          .filter((asset) =>
            shot.description.toLowerCase().includes(asset.name.toLowerCase())
          )
          .map((asset) => asset.id);
    if (
      referenceAssetIds &&
      requestedAssetIds.some(
        (id) => !projectAssets.some((asset) => asset.id === id)
      )
    ) {
      throw new Error('Reference asset not found in project');
    }

    const assetViews = await storiesDb.listAssetImageUrls(
      projectId,
      requestedAssetIds
    );
    const referenceImages = assetViews
      .map((view) => view.imageUrl)
      .filter((url): url is string => Boolean(url));

    // 3. 构建关键帧 prompt
    const prompt = buildKeyframePrompt(
      shot,
      settings?.visualStyle ?? undefined
    );
    const generationContext: StoryGenerationContext = context;
    await requireStoryImageCredits(
      generationContext,
      model,
      aspectRatio,
      referenceImages.length > 0
    );

    const existing = await storiesDb.getLatestKeyframe(projectId, shotId);
    if (existing?.status === 'generating') {
      return {
        success: true,
        keyframeId: existing.id,
        imageUrl: existing.imageUrl,
        alreadyInFlight: true,
      } as const;
    }

    const keyframeId = existing?.id ?? generateId();
    const attemptId = generateId();
    const timestamp = nowIso();
    const pendingValues = {
      projectId,
      segmentId: shot.segmentId,
      shotId,
      name: `Shot ${shot.shotNumber} Keyframe`,
      selectionReason: 'AI generated from shot description',
      description: shot.description,
      prompt,
      aspectRatio,
      imageUrl: null,
      imagePath: null,
      referenceAssets: requestedAssetIds,
      generatedBy: model,
      generationParams: { aspectRatio, attemptId },
      status: 'generating',
      updatedAt: timestamp,
    };
    if (existing) {
      await storiesDb.updateKeyframe(keyframeId, pendingValues);
    } else {
      await storiesDb.createKeyframe({
        id: keyframeId,
        ...pendingValues,
        createdAt: timestamp,
      });
    }

    try {
      const image = await generateAndStoreStoryImage({
        teamId: context.teamId,
        userId: context.user.id,
        projectId,
        recordId: keyframeId,
        kind: 'keyframes',
        model,
        prompt,
        aspectRatio,
        referenceImageUrls: referenceImages,
        credentials: toWorkflowScopedDb(context.scopedDb).credentials,
      });
      await recordAndChargeStoryImage(
        generationContext,
        image,
        `Story keyframe (${model})`,
        `story-keyframe:${keyframeId}:${attemptId}`
      );

      const completedAt = nowIso();
      await storiesDb.updateKeyframe(keyframeId, {
        imageUrl: image.url,
        imagePath: image.path,
        generatedBy: model,
        generationParams: {
          aspectRatio,
          attemptId,
          via: image.via,
          endpointId: image.metadata.endpointId,
          requestId: image.metadata.requestId,
        },
        status: 'completed',
        updatedAt: completedAt,
      });
      await storiesDb.updateShot(shotId, projectId, {
        keyframeId,
        updatedAt: completedAt,
      });

      return {
        success: true,
        keyframeId,
        imageUrl: image.url,
        alreadyInFlight: false,
      } as const;
    } catch (error) {
      await storiesDb.updateKeyframe(keyframeId, {
        status: 'failed',
        generationParams: {
          aspectRatio,
          attemptId,
          error: sanitizeFailResponse(error),
        },
        updatedAt: nowIso(),
      });
      throw error;
    }
  });

// ============================================================================
// AI 视频生成 — 从关键帧生成视频片段
// ============================================================================

const generateVideoSchema = z.object({
  projectId: z.string(),
  keyframeId: z.string(),
});

export const generateVideoFn = createServerFn()
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(generateVideoSchema))
  .handler(async ({ data, context }) => {
    const { projectId, keyframeId } = data;
    const storiesDb = context.scopedDb.stories;
    await requireStoryProject(projectId, storiesDb);

    // 1. 获取关键帧信息
    const keyframe = await storiesDb.getKeyframeByIdAndProject(
      keyframeId,
      projectId
    );

    if (!keyframe) {
      throw new Error('Keyframe not found');
    }

    const imageUrl = keyframe.imageUrl;
    if (!imageUrl) {
      throw new Error('Keyframe has no image');
    }
    if (keyframe.status !== 'completed' && keyframe.status !== 'approved') {
      throw new Error('Keyframe is not ready for video generation');
    }

    // Same in-flight guard as generateKeyframeFn: a queued/running clip for
    // this keyframe already holds a reservation, so a second click must not
    // create a row or charge again.
    const inFlight = await storiesDb.getLatestVideoClip(projectId, keyframeId);
    if (inFlight && isStoryVideoInFlight(inFlight.status)) {
      return {
        success: true as const,
        clipId: inFlight.id,
        status: inFlight.status,
        alreadyInFlight: true as const,
      };
    }

    const shot = keyframe.shotId
      ? await storiesDb.getShotByIdAndProject(keyframe.shotId, projectId)
      : undefined;
    const settings = await storiesDb.getFilmSettings(projectId);
    const model = safeImageToVideoModel(
      settings?.preferredVideoModel ?? undefined,
      DEFAULT_VIDEO_MODEL
    );
    const aspectRatio = resolveStoryAspectRatio(keyframe.aspectRatio);
    const duration = resolveShotDuration({
      durationMs: shot ? shot.duration * 1000 : undefined,
      model,
    });

    const estimate = gateEstimate(
      estimateVideoCost(model, duration, {
        pricing: await getEffectiveFalPricing(),
      }),
      { model, operation: 'motion' }
    );
    const reservationId = await reserveRunCredits(context.scopedDb, estimate, {
      errorMessage: 'Insufficient credits for story video generation',
    });

    const clipId = generateId();
    const timestamp = nowIso();
    const generationParams = {
      model,
      duration,
      aspectRatio,
      reservationId: reservationId ?? null,
    };

    await storiesDb.createVideoClip({
      id: clipId,
      projectId,
      keyframeId,
      segmentId: keyframe.segmentId ?? shot?.segmentId ?? null,
      name: `${keyframe.name} Video Clip`,
      duration,
      aspectRatio,
      prompt: keyframe.prompt ?? keyframe.description,
      motionPrompt: keyframe.description,
      generationParams,
      status: 'pending',
      queuedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return await releaseReservationOnThrow(
      context.scopedDb,
      reservationId,
      async () => {
        // Snapshot everything the run needs — Workflows replay steps from a
        // durable cache hours later, so mid-run D1 reads would be replay-unsafe.
        const workflowInput: StoryVideoWorkflowInput = {
          userId: context.user.id,
          teamId: context.teamId,
          reservationId,
          ownsReservation: Boolean(reservationId),
          projectId,
          clipId,
          keyframeId,
          ...(shot ? { shotId: shot.id, segmentId: shot.segmentId } : {}),
          imageUrl,
          prompt: keyframe.prompt ?? keyframe.description,
          model,
          duration,
          aspectRatio,
          estimatedCostMicros: Number(estimate),
        };

        try {
          const workflowRunId = await triggerWorkflow(
            '/story-video',
            workflowInput,
            { deduplicationId: `story-video-${clipId}` }
          );
          await storiesDb.updateVideoClip(clipId, {
            status: 'queued',
            generationParams: { ...generationParams, workflowRunId },
            updatedAt: nowIso(),
          });
          return {
            success: true as const,
            clipId,
            status: 'queued' as const,
            workflowRunId,
            alreadyInFlight: false as const,
          };
        } catch (error) {
          // A missing workflow binding (or any trigger failure) must not leave
          // a clip that looks queued forever. The reservation is released by
          // releaseReservationOnThrow after this rethrow.
          await storiesDb.updateVideoClip(clipId, {
            status: 'failed',
            errorMessage: sanitizeFailResponse(error),
            updatedAt: nowIso(),
          });
          throw error;
        }
      }
    );
  });

// ============================================================================
// 批量生成 — 一键生成整个片段的所有镜头
// ============================================================================

const batchGenerateSegmentSchema = z.object({
  projectId: z.string(),
  segmentId: z.string(),
});

export const batchGenerateSegmentFn = createServerFn()
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(batchGenerateSegmentSchema))
  .handler(async ({ data, context }) => {
    const { projectId, segmentId } = data;
    const storiesDb = context.scopedDb.stories;
    await requireStoryProject(projectId, storiesDb);

    // 1. 获取片段的所有镜头
    const shots = await storiesDb.listShotsForSegment(segmentId, projectId);

    if (shots.length === 0) {
      throw new Error('No shots found in segment');
    }

    // 2. 获取项目的所有资产（用于 reference）
    const assets = await storiesDb.listProjectAssets(projectId);

    const results = {
      keyframesGenerated: 0,
      videosGenerated: 0,
      errors: [] as string[],
    };

    // 3. Generate the keyframe first, then queue its video clip. A failure in
    // either stage is reported for that shot without aborting the batch.
    for (const shot of shots) {
      try {
        // 匹配相关资产
        const relevantAssetIds = assets
          .filter((a) => {
            // 简单匹配：检查镜头描述是否包含资产名称
            const desc = (shot.description || '').toLowerCase();
            return desc.includes(a.name.toLowerCase());
          })
          .map((a) => a.id);

        // 生成关键帧
        const kfResult = await generateKeyframeFn({
          data: {
            projectId,
            shotId: shot.id,
            referenceAssetIds: relevantAssetIds,
          },
        });
        results.keyframesGenerated++;

        await generateVideoFn({
          data: { projectId, keyframeId: kfResult.keyframeId },
        });
        results.videosGenerated++;
      } catch (error) {
        results.errors.push(
          `Shot ${shot.shotNumber}: ${sanitizeFailResponse(error)}`
        );
      }
    }

    return results;
  });

// ============================================================================
// 辅助函数
// ============================================================================

const SEGMENTATION_SYSTEM_PROMPT = `你是一位专业的影视分镜师。你的任务是将故事内容拆分成适合视频制作的片段和镜头。

规则：
1. 每个片段 (segment) 约 15 秒，包含 2-5 个镜头
2. 每个镜头 (shot) 包含景别、机位、运镜、台词、音效
3. 景别类型：extreme_wide, wide, medium, close_up, extreme_close_up
4. 机位角度：eye_level, high_angle, low_angle, bird_eye, worm_eye, dutch_angle
5. 运镜类型：static, pan_left, pan_right, tilt_up, tilt_down, zoom_in, zoom_out, dolly_in, dolly_out, tracking

输出 JSON 格式：
{
  "segments": [
    {
      "segmentNumber": 1,
      "startTime": 0,
      "endTime": 15,
      "duration": 15,
      "narrativeFunction": "opening",
      "summary": "片段概述...",
      "shots": [
        {
          "shotNumber": 1,
          "shotSize": "wide",
          "cameraAngle": "eye_level",
          "cameraMovement": "static",
          "dialogue": "台词内容（如有）",
          "soundEffects": "环境音、音效",
          "description": "画面描述",
          "duration": 5
        }
      ]
    }
  ]
}`;

function buildSegmentationPrompt(content: string, projectName: string): string {
  return `项目：${projectName}

请将以下内容分镜切分：

${content}

请输出 JSON 格式的分镜数据。`;
}

interface SegmentationResult {
  segments: Array<{
    segmentNumber: number;
    startTime: number;
    endTime: number;
    duration: number;
    narrativeFunction: string;
    summary: string;
    shots: Array<{
      shotNumber: number;
      shotSize: string;
      cameraAngle: string;
      cameraMovement: string;
      dialogue: string | null;
      soundEffects: string | null;
      description: string;
      duration: number;
    }>;
  }>;
}

const segmentationResultSchema: z.ZodType<SegmentationResult> = z.object({
  segments: z.array(
    z.object({
      segmentNumber: z.number(),
      startTime: z.number(),
      endTime: z.number(),
      duration: z.number(),
      narrativeFunction: z.string(),
      summary: z.string(),
      shots: z.array(
        z.object({
          shotNumber: z.number(),
          shotSize: z.string(),
          cameraAngle: z.string(),
          cameraMovement: z.string(),
          dialogue: z.string().nullable(),
          soundEffects: z.string().nullable(),
          description: z.string(),
          duration: z.number(),
        })
      ),
    })
  ),
});

function parseSegmentationResponse(content: string): SegmentationResult {
  // 提取 JSON 部分
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  const parsedJson: unknown = JSON.parse(jsonMatch[0]);
  return segmentationResultSchema.parse(parsedJson);
}

interface StoryAsset {
  id: string;
  name: string;
  type: string;
  description: string | null;
  styleNotes: string | null;
  colorPalette: Record<string, string | undefined> | null;
  visualIdentifiers: string | null;
}

function buildAssetPrompt(asset: StoryAsset, viewAngle?: string): string {
  const parts = [
    `Character/Scene: ${asset.name}`,
    asset.description && `Description: ${asset.description}`,
    asset.styleNotes && `Style: ${asset.styleNotes}`,
    asset.colorPalette &&
      `Color Palette: ${Object.values(asset.colorPalette).filter(Boolean).join(', ')}`,
    asset.visualIdentifiers && `Visual Identifiers: ${asset.visualIdentifiers}`,
    viewAngle && `View Angle: ${viewAngle}`,
    'High quality, cinematic lighting, detailed',
  ]
    .filter(Boolean)
    .join('\n');

  return parts;
}

interface Shot {
  shotNumber: number;
  shotSize: string | null;
  cameraAngle: string | null;
  cameraMovement: string | null;
  dialogue: string | null;
  soundEffects: string | null;
  description: string | null;
}

function buildKeyframePrompt(shot: Shot, visualStyle?: string): string {
  const parts = [
    shot.description && `Scene: ${shot.description}`,
    shot.shotSize && `Shot Size: ${shot.shotSize}`,
    shot.cameraAngle && `Camera Angle: ${shot.cameraAngle}`,
    shot.dialogue && `Dialogue moment: "${shot.dialogue}"`,
    visualStyle && `Visual Style: ${visualStyle}`,
    'Cinematic film still, high quality, dramatic lighting',
  ]
    .filter(Boolean)
    .join('\n');

  return parts;
}

// ============================================================================
// 导出提取角色/场景 AI 功能
// ============================================================================

const extractAssetsSchema = z.object({
  projectId: z.string(),
  chapterNumber: z.number(),
});

export const extractAssetsFromChapterFn = createServerFn()
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(extractAssetsSchema))
  .handler(async ({ data, context }) => {
    const { projectId, chapterNumber } = data;
    const storiesDb = context.scopedDb.stories;
    await requireStoryProject(projectId, storiesDb);

    // 1. 获取章节内容
    const chapter = await storiesDb.getChapterByNumber(
      projectId,
      chapterNumber
    );

    if (!chapter) {
      throw new Error(`Chapter ${chapterNumber} not found`);
    }

    // 2. 调用 AI 提取角色和场景
    const extractSystemPrompt = `你是一位专业的影视美术设计师。请从文本中提取所有角色和场景，并为每个生成详细的视觉设计描述。

输出 JSON 格式：
{
  "characters": [
    {
      "name": "角色名",
      "description": "角色外貌、服装、气质的详细描述",
      "styleNotes": "视觉风格建议",
      "colorPalette": "主要配色",
      "visualIdentifiers": "标志性视觉元素"
    }
  ],
  "scenes": [
    {
      "name": "场景名",
      "description": "场景的详细视觉描述",
      "styleNotes": "氛围、光线、质感",
      "colorPalette": "场景主色调",
      "visualIdentifiers": "标志性元素"
    }
  ]
}`;

    const content = await callAI(
      extractSystemPrompt,
      `请从以下内容中提取角色和场景：\n\n${chapter.content}`,
      4000
    );
    if (!content) {
      throw new Error('AI response empty');
    }

    // 3. 解析并保存
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const extractedAssetSchema = z.object({
      characters: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          styleNotes: z.string().optional(),
          colorPalette: z.string().optional(),
          visualIdentifiers: z.string().optional(),
        })
      ),
      scenes: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          styleNotes: z.string().optional(),
          colorPalette: z.string().optional(),
          visualIdentifiers: z.string().optional(),
        })
      ),
    });
    const parsedJson: unknown = JSON.parse(jsonMatch[0]);
    const extracted = extractedAssetSchema.parse(parsedJson);

    const results = {
      charactersCreated: 0,
      scenesCreated: 0,
    };

    // 保存角色资产
    for (const char of extracted.characters) {
      // 检查是否已存在
      const existing = await storiesDb.findAssetByNameType(
        projectId,
        char.name,
        'character'
      );

      if (!existing) {
        const timestamp = nowIso();
        await storiesDb.createAsset({
          id: generateId(),
          projectId,
          name: char.name,
          type: 'character',
          description: char.description,
          styleNotes: char.styleNotes || null,
          colorPalette: char.colorPalette ? { notes: char.colorPalette } : null,
          visualIdentifiers: char.visualIdentifiers || null,
          status: 'draft',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        results.charactersCreated++;
      }
    }

    // 保存场景资产
    for (const scene of extracted.scenes) {
      const existing = await storiesDb.findAssetByNameType(
        projectId,
        scene.name,
        'scene'
      );

      if (!existing) {
        const timestamp = nowIso();
        await storiesDb.createAsset({
          id: generateId(),
          projectId,
          name: scene.name,
          type: 'scene',
          sceneName: scene.name,
          description: scene.description,
          styleNotes: scene.styleNotes || null,
          colorPalette: scene.colorPalette
            ? { notes: scene.colorPalette }
            : null,
          visualIdentifiers: scene.visualIdentifiers || null,
          status: 'draft',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        results.scenesCreated++;
      }
    }

    return results;
  });
