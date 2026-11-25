/**
 * Filmmaking Pipeline Server Functions
 *
 * Handles the video production pipeline:
 * 分镜切分 → 资产设定 → 关键帧生成 → 视频生成
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { eq, and, asc, desc, count } from 'drizzle-orm';
import { getDb } from '#db-client';
import {
  storySegments,
  storyShots,
  storyAssets,
  storyAssetViews,
  storyKeyframes,
  storyVideoClips,
  storyFilmSettings,
  storyChapters,
} from '@/platform/server/db/schema';
import { authWithTeamMiddleware } from '@/platform/middleware.fn';
import {
  calculateFilmStatus,
  type FilmProjectStatus,
} from './inkos-integration';
import {
  analyzeStoryboard,
  saveStoryboardToDb,
  clearProjectStoryboard,
  getStoryboardStatus,
  getProjectChapters,
} from './server/storyboard-ai';

function serializeGenerationParams<
  T extends { generationParams: Record<string, unknown> | null },
>(row: T): Omit<T, 'generationParams'> & { generationParams: string | null } {
  return {
    ...row,
    generationParams: row.generationParams
      ? JSON.stringify(row.generationParams)
      : null,
  };
}

// =============================================================================
// Film Settings
// =============================================================================

/**
 * Get or create film settings for a project
 */
export const getFilmSettingsFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(z.object({ projectId: z.string() })))
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const existing = await db
      .select()
      .from(storyFilmSettings)
      .where(eq(storyFilmSettings.projectId, data.projectId))
      .get();

    if (existing) return existing;

    // Create default settings
    const created = await db
      .insert(storyFilmSettings)
      .values({
        projectId: data.projectId,
        aspectRatio: '9:16',
        resolution: '1080x1920',
        frameRate: 24,
        segmentDuration: 15,
        exportFormat: 'mp4',
      })
      .returning()
      .get();

    return created;
  });

/**
 * Update film settings
 */
export const updateFilmSettingsFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        aspectRatio: z.enum(['9:16', '16:9']).optional(),
        resolution: z.string().optional(),
        frameRate: z.number().optional(),
        targetDuration: z.number().optional(),
        segmentDuration: z.number().optional(),
        visualStyle: z.string().optional(),
        colorGrading: z.string().optional(),
        hasVoiceover: z.boolean().optional(),
        hasSoundtrack: z.boolean().optional(),
        preferredVideoModel: z.string().optional(),
        preferredImageModel: z.string().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const { projectId, ...updates } = data;
    const project = await context.scopedDb.stories.getProject(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();

    const updated = await db
      .update(storyFilmSettings)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(storyFilmSettings.projectId, projectId))
      .returning()
      .get();

    return updated;
  });

// =============================================================================
// Film Project Status
// =============================================================================

/**
 * Get comprehensive film project status
 */
export const getFilmStatusFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(z.object({ projectId: z.string() })))
  .handler(async ({ data, context }): Promise<FilmProjectStatus> => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const [
      chapterCount,
      segmentCount,
      shotCount,
      characterAssetCount,
      sceneAssetCount,
      keyframeCount,
      approvedKeyframeCount,
      videoClipCount,
      generatedClipCount,
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(storyChapters)
        .where(eq(storyChapters.projectId, data.projectId))
        .get()
        .then((r) => r?.count ?? 0),
      db
        .select({ count: count() })
        .from(storySegments)
        .where(eq(storySegments.projectId, data.projectId))
        .get()
        .then((r) => r?.count ?? 0),
      db
        .select({ count: count() })
        .from(storyShots)
        .where(eq(storyShots.projectId, data.projectId))
        .get()
        .then((r) => r?.count ?? 0),
      db
        .select({ count: count() })
        .from(storyAssets)
        .where(
          and(
            eq(storyAssets.projectId, data.projectId),
            eq(storyAssets.type, 'character-design')
          )
        )
        .get()
        .then((r) => r?.count ?? 0),
      db
        .select({ count: count() })
        .from(storyAssets)
        .where(
          and(
            eq(storyAssets.projectId, data.projectId),
            eq(storyAssets.type, 'scene-asset')
          )
        )
        .get()
        .then((r) => r?.count ?? 0),
      db
        .select({ count: count() })
        .from(storyKeyframes)
        .where(eq(storyKeyframes.projectId, data.projectId))
        .get()
        .then((r) => r?.count ?? 0),
      db
        .select({ count: count() })
        .from(storyKeyframes)
        .where(
          and(
            eq(storyKeyframes.projectId, data.projectId),
            eq(storyKeyframes.status, 'approved')
          )
        )
        .get()
        .then((r) => r?.count ?? 0),
      db
        .select({ count: count() })
        .from(storyVideoClips)
        .where(eq(storyVideoClips.projectId, data.projectId))
        .get()
        .then((r) => r?.count ?? 0),
      db
        .select({ count: count() })
        .from(storyVideoClips)
        .where(
          and(
            eq(storyVideoClips.projectId, data.projectId),
            eq(storyVideoClips.status, 'completed')
          )
        )
        .get()
        .then((r) => r?.count ?? 0),
    ]);

    return calculateFilmStatus({
      chapters: chapterCount,
      segments: segmentCount,
      shots: shotCount,
      characterAssets: characterAssetCount,
      sceneAssets: sceneAssetCount,
      keyframes: keyframeCount,
      approvedKeyframes: approvedKeyframeCount,
      videoClips: videoClipCount,
      generatedClips: generatedClipCount,
    });
  });

// =============================================================================
// Segments (分镜片段)
// =============================================================================

/**
 * List segments for a project
 */
export const listFilmSegmentsFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        chapterNumber: z.number().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    if (data.chapterNumber !== undefined) {
      return db
        .select()
        .from(storySegments)
        .where(
          and(
            eq(storySegments.projectId, data.projectId),
            eq(storySegments.chapterNumber, data.chapterNumber)
          )
        )
        .orderBy(
          asc(storySegments.chapterNumber),
          asc(storySegments.segmentNumber)
        )
        .all();
    }

    return db
      .select()
      .from(storySegments)
      .where(eq(storySegments.projectId, data.projectId))
      .orderBy(
        asc(storySegments.chapterNumber),
        asc(storySegments.segmentNumber)
      )
      .all();
  });

/**
 * Create a segment
 */
export const createFilmSegmentFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        chapterNumber: z.number(),
        segmentNumber: z.number(),
        startTime: z.string(),
        endTime: z.string(),
        duration: z.number().default(15),
        narrativeFunction: z.string().optional(),
        summary: z.string().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const segment = await db
      .insert(storySegments)
      .values(data)
      .returning()
      .get();
    return segment;
  });

/**
 * Batch create segments from chapter breakdown
 */
export const batchCreateSegmentsFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        segments: z.array(
          z.object({
            chapterNumber: z.number(),
            segmentNumber: z.number(),
            startTime: z.string(),
            endTime: z.string(),
            duration: z.number().default(15),
            narrativeFunction: z.string().optional(),
            summary: z.string().optional(),
          })
        ),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const values = data.segments.map((s) => ({
      ...s,
      projectId: data.projectId,
    }));

    const created = await db
      .insert(storySegments)
      .values(values)
      .returning()
      .all();
    return created;
  });

// =============================================================================
// Shots (镜头)
// =============================================================================

/**
 * List shots for a project or segment
 */
export const listFilmShotsFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        segmentId: z.string().optional(),
        projectId: z.string().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const db = getDb();
    if (data.projectId) {
      const project = await context.scopedDb.stories.getProject(data.projectId);
      if (!project) {
        throw new Error('项目不存在');
      }
    }

    if (data.segmentId) {
      const segment = await db
        .select({ projectId: storySegments.projectId })
        .from(storySegments)
        .where(eq(storySegments.id, data.segmentId))
        .get();

      if (!segment) {
        return [];
      }

      const project = await context.scopedDb.stories.getProject(
        segment.projectId
      );
      if (!project) {
        throw new Error('项目不存在');
      }

      return db
        .select()
        .from(storyShots)
        .where(eq(storyShots.segmentId, data.segmentId))
        .orderBy(asc(storyShots.shotNumber))
        .all();
    }
    if (data.projectId) {
      return db
        .select()
        .from(storyShots)
        .where(eq(storyShots.projectId, data.projectId))
        .orderBy(asc(storyShots.shotNumber))
        .all();
    }
    return [];
  });

/**
 * Create a shot
 */
export const createFilmShotFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        segmentId: z.string(),
        projectId: z.string(),
        shotNumber: z.number(),
        startTime: z.string(),
        duration: z.number(),
        shotSize: z.string().optional(),
        cameraAngle: z.string().optional(),
        cameraMovement: z.string().optional(),
        description: z.string(),
        action: z.string().optional(),
        dialogue: z.string().optional(),
        characters: z.array(z.string()).optional(),
        soundEffects: z.string().optional(),
        music: z.string().optional(),
        ambience: z.string().optional(),
        transition: z.string().default('cut'),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const shot = await db.insert(storyShots).values(data).returning().get();
    return shot;
  });

/**
 * Batch create shots for a segment
 */
export const batchCreateShotsFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        segmentId: z.string(),
        projectId: z.string(),
        shots: z.array(
          z.object({
            shotNumber: z.number(),
            startTime: z.string(),
            duration: z.number(),
            shotSize: z.string().optional(),
            cameraAngle: z.string().optional(),
            cameraMovement: z.string().optional(),
            description: z.string(),
            action: z.string().optional(),
            dialogue: z.string().optional(),
            characters: z.array(z.string()).optional(),
            soundEffects: z.string().optional(),
            music: z.string().optional(),
            ambience: z.string().optional(),
            transition: z.string().default('cut'),
          })
        ),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const values = data.shots.map((s) => ({
      ...s,
      segmentId: data.segmentId,
      projectId: data.projectId,
    }));

    const created = await db
      .insert(storyShots)
      .values(values)
      .returning()
      .all();
    return created;
  });

// =============================================================================
// Assets (资产)
// =============================================================================

/**
 * List assets for a project
 */
export const listAssetsFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        type: z.string().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    if (data.type) {
      return db
        .select()
        .from(storyAssets)
        .where(
          and(
            eq(storyAssets.projectId, data.projectId),
            eq(storyAssets.type, data.type)
          )
        )
        .orderBy(desc(storyAssets.createdAt))
        .all();
    }

    return db
      .select()
      .from(storyAssets)
      .where(eq(storyAssets.projectId, data.projectId))
      .orderBy(desc(storyAssets.createdAt))
      .all();
  });

/**
 * Get asset with all views
 */
export const getAssetWithViewsFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(z.object({ assetId: z.string() })))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const asset = await db
      .select()
      .from(storyAssets)
      .where(eq(storyAssets.id, data.assetId))
      .get();

    if (!asset) {
      throw new Error('资产不存在');
    }

    const project = await context.scopedDb.stories.getProject(asset.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const views = await db
      .select()
      .from(storyAssetViews)
      .where(eq(storyAssetViews.assetId, data.assetId))
      .all();

    return { ...asset, views: views.map(serializeGenerationParams) };
  });

/**
 * Create an asset
 */
export const createAssetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        name: z.string(),
        type: z.string(),
        characterId: z.string().optional(),
        sceneName: z.string().optional(),
        description: z.string(),
        styleNotes: z.string().optional(),
        colorPalette: z.record(z.string(), z.string()).optional(),
        visualIdentifiers: z.string().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const asset = await db.insert(storyAssets).values(data).returning().get();
    return asset;
  });

/**
 * Add a view to an asset
 */
export const addAssetViewFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        assetId: z.string(),
        viewAngle: z.string(),
        prompt: z.string().optional(),
        imageUrl: z.string().optional(),
        imagePath: z.string().optional(),
        generatedBy: z.string().optional(),
        generationParams: z.record(z.string(), z.unknown()).optional(),
        status: z
          .enum(['pending', 'generating', 'completed', 'failed'])
          .default('pending'),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const db = getDb();
    const asset = await db
      .select({ projectId: storyAssets.projectId })
      .from(storyAssets)
      .where(eq(storyAssets.id, data.assetId))
      .get();

    if (!asset) {
      throw new Error('资产不存在');
    }

    const project = await context.scopedDb.stories.getProject(asset.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const view = await db
      .insert(storyAssetViews)
      .values(data)
      .returning()
      .get();
    return serializeGenerationParams(view);
  });

// =============================================================================
// Keyframes (关键帧)
// =============================================================================

/**
 * List keyframes for a project
 */
export const listKeyframesFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        segmentId: z.string().optional(),
        status: z.string().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const conditions = [eq(storyKeyframes.projectId, data.projectId)];
    if (data.segmentId) {
      conditions.push(eq(storyKeyframes.segmentId, data.segmentId));
    }
    if (data.status) {
      conditions.push(eq(storyKeyframes.status, data.status));
    }

    const keyframes = await db
      .select()
      .from(storyKeyframes)
      .where(and(...conditions))
      .orderBy(desc(storyKeyframes.createdAt))
      .all();
    return keyframes.map(serializeGenerationParams);
  });

/**
 * Create a keyframe
 */
export const createKeyframeFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        segmentId: z.string().optional(),
        shotId: z.string().optional(),
        name: z.string(),
        selectionReason: z.string().optional(),
        description: z.string(),
        prompt: z.string().optional(),
        aspectRatio: z.enum(['9:16', '16:9']).default('9:16'),
        referenceAssets: z.array(z.string()).optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const keyframe = await db
      .insert(storyKeyframes)
      .values(data)
      .returning()
      .get();
    return serializeGenerationParams(keyframe);
  });

/**
 * Update keyframe (e.g., after generation)
 */
export const updateKeyframeFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        keyframeId: z.string(),
        imageUrl: z.string().optional(),
        imagePath: z.string().optional(),
        generatedBy: z.string().optional(),
        generationParams: z.record(z.string(), z.unknown()).optional(),
        status: z
          .enum(['pending', 'generating', 'completed', 'approved', 'rejected'])
          .optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const db = getDb();
    const { keyframeId, ...updates } = data;
    const keyframe = await db
      .select({ projectId: storyKeyframes.projectId })
      .from(storyKeyframes)
      .where(eq(storyKeyframes.id, keyframeId))
      .get();

    if (!keyframe) {
      throw new Error('关键帧不存在');
    }

    const project = await context.scopedDb.stories.getProject(
      keyframe.projectId
    );
    if (!project) {
      throw new Error('项目不存在');
    }

    const updated = await db
      .update(storyKeyframes)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(storyKeyframes.id, keyframeId))
      .returning()
      .get();

    return serializeGenerationParams(updated);
  });

// =============================================================================
// Video Clips (视频片段)
// =============================================================================

/**
 * List video clips for a project
 */
export const listVideoClipsFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        segmentId: z.string().optional(),
        status: z.string().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const conditions = [eq(storyVideoClips.projectId, data.projectId)];
    if (data.segmentId) {
      conditions.push(eq(storyVideoClips.segmentId, data.segmentId));
    }
    if (data.status) {
      conditions.push(eq(storyVideoClips.status, data.status));
    }

    const clips = await db
      .select()
      .from(storyVideoClips)
      .where(and(...conditions))
      .orderBy(desc(storyVideoClips.createdAt))
      .all();
    return clips.map(serializeGenerationParams);
  });

/**
 * Create a video clip (queue for generation)
 */
export const createVideoClipFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        keyframeId: z.string().optional(),
        segmentId: z.string().optional(),
        name: z.string(),
        duration: z.number().default(15),
        aspectRatio: z.enum(['9:16', '16:9']).default('9:16'),
        prompt: z.string().optional(),
        motionPrompt: z.string().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const db = getDb();
    const clip = await db
      .insert(storyVideoClips)
      .values({
        ...data,
        status: 'pending',
        queuedAt: new Date().toISOString(),
      })
      .returning()
      .get();

    return serializeGenerationParams(clip);
  });

/**
 * Update video clip status (for generation pipeline)
 */
export const updateVideoClipFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        clipId: z.string(),
        videoUrl: z.string().optional(),
        videoPath: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        thumbnailPath: z.string().optional(),
        generatedBy: z.string().optional(),
        generationParams: z.record(z.string(), z.unknown()).optional(),
        qualityScore: z.number().optional(),
        status: z
          .enum([
            'pending',
            'queued',
            'generating',
            'completed',
            'failed',
            'approved',
          ])
          .optional(),
        errorMessage: z.string().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const db = getDb();
    const { clipId, ...updates } = data;
    const clip = await db
      .select({ projectId: storyVideoClips.projectId })
      .from(storyVideoClips)
      .where(eq(storyVideoClips.id, clipId))
      .get();

    if (!clip) {
      throw new Error('视频片段不存在');
    }

    const project = await context.scopedDb.stories.getProject(clip.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const now = new Date().toISOString();
    const additionalUpdates: Record<string, string> = { updatedAt: now };

    if (updates.status === 'generating') {
      additionalUpdates.startedAt = now;
    } else if (updates.status === 'completed' || updates.status === 'failed') {
      additionalUpdates.completedAt = now;
    }

    const updated = await db
      .update(storyVideoClips)
      .set({
        ...updates,
        ...additionalUpdates,
      })
      .where(eq(storyVideoClips.id, clipId))
      .returning()
      .get();

    return serializeGenerationParams(updated);
  });

// =============================================================================
// Storyboard AI (分镜切分 AI)
// =============================================================================

/**
 * Generate storyboard from chapter content using AI
 *
 * 将剧本/故事文本自动拆分成片段(Segment)和镜头(Shot)
 */
export const generateStoryboardFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        projectId: z.string(),
        chapterNumbers: z.array(z.number()).optional(), // 指定章节，不指定则处理全部
        targetDuration: z.number().optional(), // 目标视频时长（秒）
        segmentDuration: z.number().default(15), // 每个片段时长（秒）
        aspectRatio: z.enum(['9:16', '16:9']).default('9:16'),
        clearExisting: z.boolean().default(false), // 是否清除已有分镜
      })
    )
  )
  .handler(async ({ data, context }) => {
    const {
      projectId,
      chapterNumbers,
      targetDuration,
      segmentDuration,
      aspectRatio,
      clearExisting,
    } = data;

    const project = await context.scopedDb.stories.getProject(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    // Get chapters content
    const { chapters } = await getProjectChapters(projectId);

    if (chapters.length === 0) {
      throw new Error('项目没有章节内容，请先创建章节');
    }

    // Filter chapters if specified
    const targetChapters = chapterNumbers
      ? chapters.filter((ch) => chapterNumbers.includes(ch.chapterNumber))
      : chapters;

    if (targetChapters.length === 0) {
      throw new Error('指定的章节不存在');
    }

    // Combine chapter content
    const storyText = targetChapters
      .map((ch) => `## 第${ch.chapterNumber}章：${ch.title}\n\n${ch.content}`)
      .join('\n\n---\n\n');

    // Clear existing storyboard if requested
    if (clearExisting) {
      await clearProjectStoryboard(projectId);
    }

    // Get API key from environment
    const apiKey = process.env.OPENROUTER_KEY || process.env.AI_API_KEY || '';
    if (!apiKey) {
      throw new Error('未配置 AI API Key');
    }

    // Call AI for storyboard analysis
    const analysis = await analyzeStoryboard(storyText, {
      targetDuration,
      segmentDuration,
      aspectRatio,
      apiKey,
    });

    if (analysis.status !== 'success') {
      throw new Error(analysis.error || '分镜分析失败');
    }

    // Save to database
    const { segmentIds, shotIds } = await saveStoryboardToDb(
      projectId,
      analysis
    );

    return {
      success: true,
      analysis: analysis.analysis,
      segmentIds,
      shotIds,
    };
  });

/**
 * Get storyboard generation status
 */
export const getStoryboardStatusFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(z.object({ projectId: z.string() })))
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    return getStoryboardStatus(data.projectId);
  });

/**
 * Clear storyboard data for a project
 */
export const clearStoryboardFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(z.object({ projectId: z.string() })))
  .handler(async ({ data, context }) => {
    const project = await context.scopedDb.stories.getProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    await clearProjectStoryboard(data.projectId);
    return { success: true };
  });

/**
 * Re-analyze a single segment (regenerate shots)
 */
export const reanalyzeSegmentFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        segmentId: z.string(),
        customPrompt: z.string().optional(), // 自定义分析提示
      })
    )
  )
  .handler(async ({ data, context }) => {
    const db = getDb();

    // Get segment
    const segment = await db
      .select()
      .from(storySegments)
      .where(eq(storySegments.id, data.segmentId))
      .get();

    if (!segment) {
      throw new Error('片段不存在');
    }

    const project = await context.scopedDb.stories.getProject(
      segment.projectId
    );
    if (!project) {
      throw new Error('项目不存在');
    }

    // Delete existing shots for this segment
    await db.delete(storyShots).where(eq(storyShots.segmentId, data.segmentId));

    // Get chapter content for this segment
    const chapter = await db
      .select()
      .from(storyChapters)
      .where(
        and(
          eq(storyChapters.projectId, segment.projectId),
          eq(storyChapters.chapterNumber, segment.chapterNumber)
        )
      )
      .get();

    if (!chapter) {
      throw new Error('章节不存在');
    }

    // Get API key
    const apiKey = process.env.OPENROUTER_KEY || process.env.AI_API_KEY || '';
    if (!apiKey) {
      throw new Error('未配置 AI API Key');
    }

    // Get film settings for aspect ratio
    const settings = await db
      .select()
      .from(storyFilmSettings)
      .where(eq(storyFilmSettings.projectId, segment.projectId))
      .get();

    const aspectRatio = (settings?.aspectRatio as '9:16' | '16:9') || '9:16';

    // Re-analyze just this segment's content
    const segmentPrompt = `请只分析以下片段的镜头设计，该片段时长约${segment.duration}秒：

片段概要：${segment.summary || '无'}
叙事功能：${segment.narrativeFunction || '无'}

相关章节内容：
${chapter.content}

${data.customPrompt ? `额外要求：${data.customPrompt}` : ''}`;

    const analysis = await analyzeStoryboard(segmentPrompt, {
      targetDuration: segment.duration,
      segmentDuration: segment.duration,
      aspectRatio,
      apiKey,
    });

    if (analysis.status !== 'success' || analysis.segments.length === 0) {
      throw new Error(analysis.error || '分镜分析失败');
    }

    // Insert new shots from the first (and only) segment result
    const newShots = analysis.segments[0]?.shots || [];
    const shotIds: string[] = [];

    for (const shot of newShots) {
      const created = await db
        .insert(storyShots)
        .values({
          segmentId: data.segmentId,
          projectId: segment.projectId,
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

      shotIds.push(created.id);
    }

    return {
      success: true,
      shotIds,
      shotCount: shotIds.length,
    };
  });
