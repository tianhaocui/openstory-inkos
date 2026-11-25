/**
 * Filmmaking + storyboard SQL for OpenStory stories.
 *
 * Every query formerly issued straight from `filmmaking.fn.ts`,
 * `ai-filmmaking.fn.ts` and `server/storyboard-ai.ts` lives here. Server
 * functions call these through `context.scopedDb.stories.*`.
 */

import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '@/platform/server/db/client';
import {
  storyAssetViews,
  storyAssets,
  storyChapters,
  storyFilmSettings,
  storyKeyframes,
  storySegments,
  storyShots,
  storyVideoClips,
} from '@/platform/server/db/schema';

type FilmSettingsInsert = typeof storyFilmSettings.$inferInsert;
type FilmSettingsUpdate = Partial<FilmSettingsInsert>;
type SegmentInsert = typeof storySegments.$inferInsert;
type SegmentUpdate = Partial<SegmentInsert>;
type ShotInsert = typeof storyShots.$inferInsert;
type ShotUpdate = Partial<ShotInsert>;
type AssetInsert = typeof storyAssets.$inferInsert;
type AssetUpdate = Partial<AssetInsert>;
type AssetViewInsert = typeof storyAssetViews.$inferInsert;
type AssetViewUpdate = Partial<AssetViewInsert>;
type KeyframeInsert = typeof storyKeyframes.$inferInsert;
type KeyframeUpdate = Partial<KeyframeInsert>;
type ClipInsert = typeof storyVideoClips.$inferInsert;
type ClipUpdate = Partial<ClipInsert>;

export type StoryboardShotInput = {
  shotNumber: number;
  startTime: string;
  duration: number;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  description: string;
  action?: string;
  dialogue?: string;
  characters?: string[] | null;
  soundEffects?: string;
  ambience?: string;
  transition?: string;
};

export type StoryboardSegmentInput = {
  chapterNumber: number;
  segmentNumber: number;
  startTime: string;
  endTime: string;
  duration: number;
  narrativeFunction: string;
  summary: string;
  shots: StoryboardShotInput[];
};

export function createStoryFilmmakingMethods(db: Database) {
  // -------------------------------------------------------------------------
  // Film settings
  // -------------------------------------------------------------------------

  async function getFilmSettings(projectId: string) {
    const [settings] = await db
      .select()
      .from(storyFilmSettings)
      .where(eq(storyFilmSettings.projectId, projectId))
      .limit(1);
    return settings;
  }

  async function createFilmSettings(values: FilmSettingsInsert) {
    const [settings] = await db
      .insert(storyFilmSettings)
      .values(values)
      .returning();
    return settings;
  }

  async function updateFilmSettings(
    projectId: string,
    patch: FilmSettingsUpdate
  ) {
    const [settings] = await db
      .update(storyFilmSettings)
      .set(patch)
      .where(eq(storyFilmSettings.projectId, projectId))
      .returning();
    return settings;
  }

  // -------------------------------------------------------------------------
  // Aggregate status counts
  // -------------------------------------------------------------------------

  async function countFilmStatus(projectId: string) {
    const [
      chapters,
      segments,
      shots,
      characterAssets,
      sceneAssets,
      keyframes,
      approvedKeyframes,
      videoClips,
      generatedClips,
    ] = await Promise.all([
      db
        .select({ value: count() })
        .from(storyChapters)
        .where(eq(storyChapters.projectId, projectId))
        .limit(1),
      db
        .select({ value: count() })
        .from(storySegments)
        .where(eq(storySegments.projectId, projectId))
        .limit(1),
      db
        .select({ value: count() })
        .from(storyShots)
        .where(eq(storyShots.projectId, projectId))
        .limit(1),
      db
        .select({ value: count() })
        .from(storyAssets)
        .where(
          and(
            eq(storyAssets.projectId, projectId),
            eq(storyAssets.type, 'character-design')
          )
        )
        .limit(1),
      db
        .select({ value: count() })
        .from(storyAssets)
        .where(
          and(
            eq(storyAssets.projectId, projectId),
            eq(storyAssets.type, 'scene-asset')
          )
        )
        .limit(1),
      db
        .select({ value: count() })
        .from(storyKeyframes)
        .where(eq(storyKeyframes.projectId, projectId))
        .limit(1),
      db
        .select({ value: count() })
        .from(storyKeyframes)
        .where(
          and(
            eq(storyKeyframes.projectId, projectId),
            eq(storyKeyframes.status, 'approved')
          )
        )
        .limit(1),
      db
        .select({ value: count() })
        .from(storyVideoClips)
        .where(eq(storyVideoClips.projectId, projectId))
        .limit(1),
      db
        .select({ value: count() })
        .from(storyVideoClips)
        .where(
          and(
            eq(storyVideoClips.projectId, projectId),
            eq(storyVideoClips.status, 'completed')
          )
        )
        .limit(1),
    ]);
    return {
      chapters: chapters[0]?.value ?? 0,
      segments: segments[0]?.value ?? 0,
      shots: shots[0]?.value ?? 0,
      characterAssets: characterAssets[0]?.value ?? 0,
      sceneAssets: sceneAssets[0]?.value ?? 0,
      keyframes: keyframes[0]?.value ?? 0,
      approvedKeyframes: approvedKeyframes[0]?.value ?? 0,
      videoClips: videoClips[0]?.value ?? 0,
      generatedClips: generatedClips[0]?.value ?? 0,
    };
  }

  // -------------------------------------------------------------------------
  // Segments
  // -------------------------------------------------------------------------

  async function listSegments(projectId: string, chapterNumber?: number) {
    if (chapterNumber !== undefined) {
      return db
        .select()
        .from(storySegments)
        .where(
          and(
            eq(storySegments.projectId, projectId),
            eq(storySegments.chapterNumber, chapterNumber)
          )
        )
        .orderBy(
          asc(storySegments.chapterNumber),
          asc(storySegments.segmentNumber)
        );
    }
    return db
      .select()
      .from(storySegments)
      .where(eq(storySegments.projectId, projectId))
      .orderBy(
        asc(storySegments.chapterNumber),
        asc(storySegments.segmentNumber)
      );
  }

  async function getSegment(segmentId: string) {
    const [segment] = await db
      .select()
      .from(storySegments)
      .where(eq(storySegments.id, segmentId))
      .limit(1);
    return segment;
  }

  async function getSegmentProjectId(segmentId: string) {
    const [segment] = await db
      .select({ projectId: storySegments.projectId })
      .from(storySegments)
      .where(eq(storySegments.id, segmentId))
      .limit(1);
    return segment?.projectId;
  }

  async function createSegment(values: SegmentInsert) {
    const [segment] = await db.insert(storySegments).values(values).returning();
    return segment;
  }

  async function batchCreateSegments(values: SegmentInsert[]) {
    if (values.length === 0) return [];
    return db.insert(storySegments).values(values).returning();
  }

  async function updateSegment(segmentId: string, patch: SegmentUpdate) {
    const [segment] = await db
      .update(storySegments)
      .set(patch)
      .where(eq(storySegments.id, segmentId))
      .returning();
    return segment;
  }

  // -------------------------------------------------------------------------
  // Shots
  // -------------------------------------------------------------------------

  async function listShotsBySegment(segmentId: string) {
    return db
      .select()
      .from(storyShots)
      .where(eq(storyShots.segmentId, segmentId))
      .orderBy(asc(storyShots.shotNumber));
  }

  async function listShotsForSegment(segmentId: string, projectId: string) {
    return db
      .select()
      .from(storyShots)
      .where(
        and(
          eq(storyShots.segmentId, segmentId),
          eq(storyShots.projectId, projectId)
        )
      )
      .orderBy(asc(storyShots.shotNumber));
  }

  async function listShotsByProject(projectId: string) {
    return db
      .select()
      .from(storyShots)
      .where(eq(storyShots.projectId, projectId))
      .orderBy(asc(storyShots.shotNumber));
  }

  async function getShot(shotId: string) {
    const [shot] = await db
      .select()
      .from(storyShots)
      .where(eq(storyShots.id, shotId))
      .limit(1);
    return shot;
  }

  async function getShotByIdAndProject(shotId: string, projectId: string) {
    const [shot] = await db
      .select()
      .from(storyShots)
      .where(
        and(eq(storyShots.id, shotId), eq(storyShots.projectId, projectId))
      )
      .limit(1);
    return shot;
  }

  async function createShot(values: ShotInsert) {
    const [shot] = await db.insert(storyShots).values(values).returning();
    return shot;
  }

  async function batchCreateShots(values: ShotInsert[]) {
    if (values.length === 0) return [];
    return db.insert(storyShots).values(values).returning();
  }

  async function updateShot(
    shotId: string,
    projectId: string,
    patch: ShotUpdate
  ) {
    const [shot] = await db
      .update(storyShots)
      .set(patch)
      .where(
        and(eq(storyShots.id, shotId), eq(storyShots.projectId, projectId))
      )
      .returning();
    return shot;
  }

  async function deleteShotsBySegment(segmentId: string) {
    await db.delete(storyShots).where(eq(storyShots.segmentId, segmentId));
  }

  // -------------------------------------------------------------------------
  // Assets
  // -------------------------------------------------------------------------

  async function listAssets(projectId: string, type?: string) {
    if (type) {
      return db
        .select()
        .from(storyAssets)
        .where(
          and(eq(storyAssets.projectId, projectId), eq(storyAssets.type, type))
        )
        .orderBy(desc(storyAssets.createdAt));
    }
    return db
      .select()
      .from(storyAssets)
      .where(eq(storyAssets.projectId, projectId))
      .orderBy(desc(storyAssets.createdAt));
  }

  async function getAsset(assetId: string) {
    const [asset] = await db
      .select()
      .from(storyAssets)
      .where(eq(storyAssets.id, assetId))
      .limit(1);
    return asset;
  }

  async function getAssetByIdAndProject(assetId: string, projectId: string) {
    const [asset] = await db
      .select()
      .from(storyAssets)
      .where(
        and(eq(storyAssets.id, assetId), eq(storyAssets.projectId, projectId))
      )
      .limit(1);
    return asset;
  }

  async function getAssetProjectId(assetId: string) {
    const [asset] = await db
      .select({ projectId: storyAssets.projectId })
      .from(storyAssets)
      .where(eq(storyAssets.id, assetId))
      .limit(1);
    return asset?.projectId;
  }

  async function findAssetByNameType(
    projectId: string,
    name: string,
    type: string
  ) {
    const [asset] = await db
      .select({ id: storyAssets.id })
      .from(storyAssets)
      .where(
        and(
          eq(storyAssets.projectId, projectId),
          eq(storyAssets.name, name),
          eq(storyAssets.type, type)
        )
      )
      .limit(1);
    return asset;
  }

  async function listProjectAssets(projectId: string) {
    return db
      .select({ id: storyAssets.id, name: storyAssets.name })
      .from(storyAssets)
      .where(eq(storyAssets.projectId, projectId));
  }

  async function createAsset(values: AssetInsert) {
    const [asset] = await db.insert(storyAssets).values(values).returning();
    return asset;
  }

  async function updateAsset(assetId: string, patch: AssetUpdate) {
    const [asset] = await db
      .update(storyAssets)
      .set(patch)
      .where(eq(storyAssets.id, assetId))
      .returning();
    return asset;
  }

  // -------------------------------------------------------------------------
  // Asset views
  // -------------------------------------------------------------------------

  async function listAssetViews(assetId: string) {
    return db
      .select()
      .from(storyAssetViews)
      .where(eq(storyAssetViews.assetId, assetId));
  }

  async function createAssetView(values: AssetViewInsert) {
    const [view] = await db.insert(storyAssetViews).values(values).returning();
    return view;
  }

  async function updateAssetView(viewId: string, patch: AssetViewUpdate) {
    const [view] = await db
      .update(storyAssetViews)
      .set(patch)
      .where(eq(storyAssetViews.id, viewId))
      .returning();
    return view;
  }

  async function listAssetImageUrls(projectId: string, assetIds: string[]) {
    if (assetIds.length === 0) return [];
    return db
      .select({ imageUrl: storyAssetViews.imageUrl })
      .from(storyAssetViews)
      .innerJoin(storyAssets, eq(storyAssetViews.assetId, storyAssets.id))
      .where(
        and(
          eq(storyAssets.projectId, projectId),
          inArray(storyAssets.id, assetIds)
        )
      );
  }

  // -------------------------------------------------------------------------
  // Keyframes
  // -------------------------------------------------------------------------

  async function listKeyframes(
    projectId: string,
    options?: { segmentId?: string; status?: string }
  ) {
    const conditions = [eq(storyKeyframes.projectId, projectId)];
    if (options?.segmentId) {
      conditions.push(eq(storyKeyframes.segmentId, options.segmentId));
    }
    if (options?.status) {
      conditions.push(eq(storyKeyframes.status, options.status));
    }
    return db
      .select()
      .from(storyKeyframes)
      .where(and(...conditions))
      .orderBy(desc(storyKeyframes.createdAt));
  }

  async function getKeyframeProjectId(keyframeId: string) {
    const [keyframe] = await db
      .select({ projectId: storyKeyframes.projectId })
      .from(storyKeyframes)
      .where(eq(storyKeyframes.id, keyframeId))
      .limit(1);
    return keyframe?.projectId;
  }

  async function getKeyframeByIdAndProject(
    keyframeId: string,
    projectId: string
  ) {
    const [keyframe] = await db
      .select()
      .from(storyKeyframes)
      .where(
        and(
          eq(storyKeyframes.id, keyframeId),
          eq(storyKeyframes.projectId, projectId)
        )
      )
      .limit(1);
    return keyframe;
  }

  async function getLatestKeyframe(projectId: string, shotId: string) {
    const [keyframe] = await db
      .select()
      .from(storyKeyframes)
      .where(
        and(
          eq(storyKeyframes.projectId, projectId),
          eq(storyKeyframes.shotId, shotId)
        )
      )
      .orderBy(desc(storyKeyframes.createdAt))
      .limit(1);
    return keyframe;
  }

  async function createKeyframe(values: KeyframeInsert) {
    const [keyframe] = await db
      .insert(storyKeyframes)
      .values(values)
      .returning();
    return keyframe;
  }

  async function updateKeyframe(keyframeId: string, patch: KeyframeUpdate) {
    const [keyframe] = await db
      .update(storyKeyframes)
      .set(patch)
      .where(eq(storyKeyframes.id, keyframeId))
      .returning();
    return keyframe;
  }

  // -------------------------------------------------------------------------
  // Video clips
  // -------------------------------------------------------------------------

  async function listVideoClips(
    projectId: string,
    options?: { segmentId?: string; status?: string }
  ) {
    const conditions = [eq(storyVideoClips.projectId, projectId)];
    if (options?.segmentId) {
      conditions.push(eq(storyVideoClips.segmentId, options.segmentId));
    }
    if (options?.status) {
      conditions.push(eq(storyVideoClips.status, options.status));
    }
    return db
      .select()
      .from(storyVideoClips)
      .where(and(...conditions))
      .orderBy(desc(storyVideoClips.createdAt));
  }

  async function getVideoClipProjectId(clipId: string) {
    const [clip] = await db
      .select({ projectId: storyVideoClips.projectId })
      .from(storyVideoClips)
      .where(eq(storyVideoClips.id, clipId))
      .limit(1);
    return clip?.projectId;
  }

  async function createVideoClip(values: ClipInsert) {
    const [clip] = await db.insert(storyVideoClips).values(values).returning();
    return clip;
  }

  async function updateVideoClip(clipId: string, patch: ClipUpdate) {
    const [clip] = await db
      .update(storyVideoClips)
      .set(patch)
      .where(eq(storyVideoClips.id, clipId))
      .returning();
    return clip;
  }

  // -------------------------------------------------------------------------
  // Shared chapter read for the AI pipelines
  // -------------------------------------------------------------------------

  async function getChapterByNumber(projectId: string, chapterNumber: number) {
    const [chapter] = await db
      .select()
      .from(storyChapters)
      .where(
        and(
          eq(storyChapters.projectId, projectId),
          eq(storyChapters.chapterNumber, chapterNumber)
        )
      )
      .limit(1);
    return chapter;
  }

  // -------------------------------------------------------------------------
  // Storyboard AI persistence
  // -------------------------------------------------------------------------

  async function getProjectChapters(projectId: string) {
    return db
      .select({
        chapterNumber: storyChapters.chapterNumber,
        title: storyChapters.title,
        content: storyChapters.content,
        wordCount: storyChapters.wordCount,
      })
      .from(storyChapters)
      .where(eq(storyChapters.projectId, projectId))
      .orderBy(asc(storyChapters.chapterNumber));
  }

  async function saveStoryboardSegments(
    projectId: string,
    segments: StoryboardSegmentInput[]
  ) {
    const segmentIds: string[] = [];
    const shotIds: string[] = [];
    for (const segment of segments) {
      const [createdSegment] = await db
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
        .returning();
      if (!createdSegment)
        throw new Error('Failed to insert storyboard segment');
      segmentIds.push(createdSegment.id);

      for (const shot of segment.shots) {
        const [createdShot] = await db
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
          .returning();
        if (!createdShot) throw new Error('Failed to insert storyboard shot');
        shotIds.push(createdShot.id);
      }
    }
    return { segmentIds, shotIds };
  }

  async function clearProjectStoryboard(projectId: string) {
    // Shots are cascade-deleted with their segments.
    await db
      .delete(storySegments)
      .where(eq(storySegments.projectId, projectId));
  }

  async function getStoryboardRows(projectId: string) {
    const segments = await db
      .select()
      .from(storySegments)
      .where(eq(storySegments.projectId, projectId));
    const shots = await db
      .select()
      .from(storyShots)
      .where(eq(storyShots.projectId, projectId));
    return { segments, shots };
  }

  return {
    getFilmSettings,
    createFilmSettings,
    updateFilmSettings,
    countFilmStatus,
    listSegments,
    getSegment,
    getSegmentProjectId,
    createSegment,
    batchCreateSegments,
    updateSegment,
    listShotsBySegment,
    listShotsForSegment,
    listShotsByProject,
    getShot,
    getShotByIdAndProject,
    createShot,
    batchCreateShots,
    updateShot,
    deleteShotsBySegment,
    listAssets,
    getAsset,
    getAssetByIdAndProject,
    getAssetProjectId,
    findAssetByNameType,
    listProjectAssets,
    createAsset,
    updateAsset,
    listAssetViews,
    createAssetView,
    updateAssetView,
    listAssetImageUrls,
    listKeyframes,
    getKeyframeProjectId,
    getKeyframeByIdAndProject,
    getLatestKeyframe,
    createKeyframe,
    updateKeyframe,
    listVideoClips,
    getVideoClipProjectId,
    createVideoClip,
    updateVideoClip,
    getChapterByNumber,
    getProjectChapters,
    saveStoryboardSegments,
    clearProjectStoryboard,
    getStoryboardRows,
  };
}

export type StoryFilmmakingDb = ReturnType<typeof createStoryFilmmakingMethods>;
