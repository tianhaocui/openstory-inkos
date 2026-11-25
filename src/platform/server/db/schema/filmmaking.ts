/**
 * Filmmaking Pipeline Tables — Drizzle Schema
 *
 * Extends OpenStory with video production capabilities:
 * - Segments: 15-second story beats
 * - Shots: Individual camera setups within segments
 * - Assets: Character designs, scene assets (multi-angle)
 * - Keyframes: Key visual moments for video generation
 * - Video Clips: Generated video segments with status tracking
 *
 * Follows the 6-stage pipeline:
 * 原始故事 → 剧本创作(InkOS) → 分镜切分 → 资产设定 → 关键帧生成 → 视频生成
 */

import {
  integer,
  sqliteTable,
  text,
  index,
  real,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { storyProjects } from './inkos';

// ---------------------------------------------------------------------------
// Segments — 15-second story beats
// ---------------------------------------------------------------------------

/**
 * A segment is a ~15-second portion of the film.
 * Each chapter/act is divided into multiple segments.
 */
export const storySegments = sqliteTable(
  'story_segments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    // Which chapter this segment belongs to (maps to InkOS chapter)
    chapterNumber: integer('chapter_number').notNull(),
    // Segment number within the chapter (1, 2, 3...)
    segmentNumber: integer('segment_number').notNull(),
    // Time codes
    startTime: text('start_time').notNull(), // "00:00:00" format
    endTime: text('end_time').notNull(),
    duration: integer('duration').notNull().default(15), // seconds
    // Narrative function of this segment
    narrativeFunction: text('narrative_function'), // "开场钩子", "情节转折", "情感高潮"
    // Summary of what happens in this segment
    summary: text('summary'),
    // Status
    status: text('status').notNull().default('draft'), // draft, storyboarded, keyframed, generated
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_segments_project_idx').on(table.projectId),
    index('story_segments_chapter_idx').on(
      table.projectId,
      table.chapterNumber
    ),
    index('story_segments_order_idx').on(
      table.projectId,
      table.chapterNumber,
      table.segmentNumber
    ),
  ]
);

// ---------------------------------------------------------------------------
// Shots — Individual camera setups
// ---------------------------------------------------------------------------

/**
 * Shot types for cinematography
 */
export type ShotSize =
  | 'extreme-wide' // 大远景
  | 'wide' // 远景
  | 'full' // 全景
  | 'medium-wide' // 中远景
  | 'medium' // 中景
  | 'medium-close' // 中近景
  | 'close-up' // 近景
  | 'extreme-close' // 特写
  | 'insert'; // 插入镜头

export type CameraAngle =
  | 'eye-level' // 平视
  | 'high' // 俯视
  | 'low' // 仰视
  | 'dutch' // 倾斜
  | 'overhead' // 鸟瞰
  | 'pov'; // 主观视角

export type CameraMovement =
  | 'static' // 固定
  | 'pan' // 摇镜
  | 'tilt' // 俯仰
  | 'dolly' // 推拉
  | 'track' // 跟踪
  | 'crane' // 升降
  | 'handheld' // 手持
  | 'zoom'; // 变焦

/**
 * A shot is a single camera setup within a segment.
 * Contains all cinematographic details needed for keyframe/video generation.
 */
export const storyShots = sqliteTable(
  'story_shots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    segmentId: text('segment_id')
      .notNull()
      .references(() => storySegments.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    // Shot number within segment
    shotNumber: integer('shot_number').notNull(),
    // Time within segment
    startTime: text('start_time').notNull(), // relative to segment start
    duration: real('duration').notNull(), // seconds (can be fractional)
    // Cinematography
    shotSize: text('shot_size'), // ShotSize
    cameraAngle: text('camera_angle'), // CameraAngle
    cameraMovement: text('camera_movement'), // CameraMovement
    // Content
    description: text('description').notNull(), // Visual description of the shot
    action: text('action'), // What's happening in the shot
    dialogue: text('dialogue'), // Any spoken lines
    // Characters in shot (JSON array of character IDs)
    characters: text('characters', { mode: 'json' }).$type<string[]>(),
    // Audio
    soundEffects: text('sound_effects'), // SFX notes
    music: text('music'), // Music cues
    ambience: text('ambience'), // Background audio
    // Transition to next shot
    transition: text('transition').default('cut'), // cut, fade, dissolve, wipe
    // Generation metadata
    keyframeId: text('keyframe_id'), // Link to generated keyframe
    videoClipId: text('video_clip_id'), // Link to generated video
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_shots_segment_idx').on(table.segmentId),
    index('story_shots_project_idx').on(table.projectId),
    index('story_shots_order_idx').on(table.segmentId, table.shotNumber),
  ]
);

// ---------------------------------------------------------------------------
// Assets — Character designs and scene assets
// ---------------------------------------------------------------------------

export type AssetType =
  | 'character-design' // 角色设定图
  | 'scene-asset' // 场景资产
  | 'prop' // 道具
  | 'vehicle' // 载具
  | 'creature' // 生物/怪物
  | 'effect'; // 特效参考

export type AssetViewAngle =
  | 'front' // 正面
  | 'side-left' // 左侧
  | 'side-right' // 右侧
  | 'back' // 背面
  | 'three-quarter' // 3/4视角
  | 'top' // 俯视
  | 'close-up' // 特写
  | 'full-body' // 全身
  | 'expression-sheet'; // 表情集

/**
 * Visual assets for the production.
 * Each asset can have multiple views/angles.
 */
export const storyAssets = sqliteTable(
  'story_assets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    // Asset identification
    name: text('name').notNull(),
    type: text('type').notNull(), // AssetType
    // For character assets, link to storyCharacters
    characterId: text('character_id'),
    // For scene assets, which scene this belongs to
    sceneName: text('scene_name'),
    // Visual description for generation
    description: text('description').notNull(),
    // Style notes (e.g., "皮克斯卡通渲染", "赛博朋克")
    styleNotes: text('style_notes'),
    // Color palette (JSON: { primary: "#xxx", secondary: "#xxx", accent: "#xxx" })
    colorPalette: text('color_palette', { mode: 'json' }).$type<{
      primary?: string;
      secondary?: string;
      accent?: string;
      [key: string]: string | undefined;
    }>(),
    // Key visual identifiers for consistency
    visualIdentifiers: text('visual_identifiers'), // e.g., "月桂花环、火焰吊坠、香烟"
    // Status
    status: text('status').notNull().default('draft'), // draft, generating, completed, approved
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_assets_project_idx').on(table.projectId),
    index('story_assets_type_idx').on(table.projectId, table.type),
    index('story_assets_character_idx').on(table.projectId, table.characterId),
  ]
);

/**
 * Individual views/angles for an asset.
 * A character might have front, side, back views.
 * A scene might have wide, medium, close-up views.
 */
export const storyAssetViews = sqliteTable(
  'story_asset_views',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    assetId: text('asset_id')
      .notNull()
      .references(() => storyAssets.id, { onDelete: 'cascade' }),
    // View type
    viewAngle: text('view_angle').notNull(), // AssetViewAngle
    // Generation prompt (full prompt used for this view)
    prompt: text('prompt'),
    // Generated image
    imageUrl: text('image_url'),
    imagePath: text('image_path'), // Local file path
    // Generation metadata
    generatedBy: text('generated_by'), // Model used
    generationParams: text('generation_params', { mode: 'json' }).$type<
      Record<string, unknown>
    >(),
    // Status
    status: text('status').notNull().default('pending'), // pending, generating, completed, failed
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_asset_views_asset_idx').on(table.assetId),
    index('story_asset_views_angle_idx').on(table.assetId, table.viewAngle),
  ]
);

// ---------------------------------------------------------------------------
// Keyframes — Key visual moments
// ---------------------------------------------------------------------------

/**
 * Keyframes are the most important visual moments in the film.
 * Used as reference frames for video generation (image-to-video).
 */
export const storyKeyframes = sqliteTable(
  'story_keyframes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    // Which segment/shot this keyframe belongs to
    segmentId: text('segment_id').references(() => storySegments.id, {
      onDelete: 'set null',
    }),
    shotId: text('shot_id').references(() => storyShots.id, {
      onDelete: 'set null',
    }),
    // Keyframe identification
    name: text('name').notNull(),
    // Why this moment was selected as a keyframe
    selectionReason: text('selection_reason'), // "决定性瞬间", "情绪顶点", "情节转折"
    // Visual description
    description: text('description').notNull(),
    // Full generation prompt
    prompt: text('prompt'),
    // Aspect ratio (9:16 for vertical, 16:9 for horizontal)
    aspectRatio: text('aspect_ratio').notNull().default('9:16'),
    // Generated image
    imageUrl: text('image_url'),
    imagePath: text('image_path'),
    // Reference assets used (JSON array of asset IDs)
    referenceAssets: text('reference_assets', { mode: 'json' }).$type<
      string[]
    >(),
    // Generation metadata
    generatedBy: text('generated_by'),
    generationParams: text('generation_params', { mode: 'json' }).$type<
      Record<string, unknown>
    >(),
    // Status
    status: text('status').notNull().default('pending'), // pending, generating, completed, approved, rejected
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_keyframes_project_idx').on(table.projectId),
    index('story_keyframes_segment_idx').on(table.segmentId),
    index('story_keyframes_shot_idx').on(table.shotId),
  ]
);

// ---------------------------------------------------------------------------
// Video Clips — Generated video segments
// ---------------------------------------------------------------------------

/**
 * Generated video clips.
 * Each clip corresponds to a segment or portion of a segment.
 */
export const storyVideoClips = sqliteTable(
  'story_video_clips',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    // Source keyframe (for image-to-video generation)
    keyframeId: text('keyframe_id').references(() => storyKeyframes.id, {
      onDelete: 'set null',
    }),
    // Which segment this clip is for
    segmentId: text('segment_id').references(() => storySegments.id, {
      onDelete: 'set null',
    }),
    // Clip identification
    name: text('name').notNull(),
    // Duration in seconds
    duration: integer('duration').notNull().default(15),
    // Aspect ratio
    aspectRatio: text('aspect_ratio').notNull().default('9:16'),
    // Generation prompt/instructions
    prompt: text('prompt'),
    motionPrompt: text('motion_prompt'), // Camera/subject motion instructions
    // Generated video
    videoUrl: text('video_url'),
    videoPath: text('video_path'),
    thumbnailUrl: text('thumbnail_url'),
    thumbnailPath: text('thumbnail_path'),
    // Generation metadata
    generatedBy: text('generated_by'), // e.g., "seedance-2.5"
    generationParams: text('generation_params', { mode: 'json' }).$type<
      Record<string, unknown>
    >(),
    // Quality metrics
    qualityScore: real('quality_score'), // 0-1 quality rating
    // Status
    status: text('status').notNull().default('pending'), // pending, queued, generating, completed, failed, approved
    errorMessage: text('error_message'),
    // Timestamps
    queuedAt: text('queued_at'),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_video_clips_project_idx').on(table.projectId),
    index('story_video_clips_keyframe_idx').on(table.keyframeId),
    index('story_video_clips_segment_idx').on(table.segmentId),
    index('story_video_clips_status_idx').on(table.projectId, table.status),
  ]
);

// ---------------------------------------------------------------------------
// Film Project Settings — Extended settings for video production
// ---------------------------------------------------------------------------

/**
 * Extended project settings for film/video production.
 * Stored separately to keep the main storyProjects table clean.
 */
export const storyFilmSettings = sqliteTable(
  'story_film_settings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    projectId: text('project_id')
      .notNull()
      .unique()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    // Video format
    aspectRatio: text('aspect_ratio').notNull().default('9:16'), // 9:16 竖屏, 16:9 横屏
    resolution: text('resolution').notNull().default('1080x1920'), // width x height
    frameRate: integer('frame_rate').notNull().default(24),
    // Target duration
    targetDuration: integer('target_duration'), // total seconds
    segmentDuration: integer('segment_duration').notNull().default(15), // seconds per segment
    // Visual style
    visualStyle: text('visual_style'), // "皮克斯卡通渲染", "真人写实", "2D动画"
    colorGrading: text('color_grading'), // LUT/color style notes
    // Audio settings
    hasVoiceover: integer('has_voiceover', { mode: 'boolean' }).default(false),
    hasSoundtrack: integer('has_soundtrack', { mode: 'boolean' }).default(true),
    // Generation preferences
    preferredVideoModel: text('preferred_video_model'), // e.g., "seedance-2.5"
    preferredImageModel: text('preferred_image_model'), // e.g., "flux-pro"
    // Export settings
    exportFormat: text('export_format').notNull().default('mp4'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('story_film_settings_project_idx').on(table.projectId)]
);
