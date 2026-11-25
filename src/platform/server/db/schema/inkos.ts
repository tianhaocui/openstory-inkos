/**
 * InkOS Story Memory Tables — Drizzle Schema
 *
 * Integrates InkOS's temporal memory database (facts, chapter summaries, hooks)
 * into OpenStory's unified database schema.
 *
 * These tables store:
 * - Facts: Temporal knowledge graph (subject-predicate-object with chapter validity)
 * - Chapter Summaries: Per-chapter metadata for story continuity
 * - Hooks: Narrative tension tracking (foreshadowing, plot threads)
 */

import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { teams } from './teams';
import { user } from './auth';

// ---------------------------------------------------------------------------
// Story Projects (container for InkOS stories within a team)
// ---------------------------------------------------------------------------

export const storyProjects = sqliteTable(
  'story_projects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    // Story settings (genre, tone, etc.)
    settings: text('settings', { mode: 'json' }).$type<{
      genre?: string;
      tone?: string;
      targetLength?: number;
      language?: string;
      inkos?: {
        bookId: string;
        studioUrl: string;
        status: 'creating' | 'ready' | 'unavailable';
        error?: string;
        lastSyncAt?: string;
        lastArtifactKind?: 'script' | 'interactive-film';
      };
    }>(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_projects_team_idx').on(table.teamId),
    index('story_projects_user_idx').on(table.userId),
  ]
);

// ---------------------------------------------------------------------------
// Facts — Temporal Knowledge Graph
// ---------------------------------------------------------------------------

/**
 * Facts table stores subject-predicate-object triples with temporal validity.
 * Enables queries like "what did character X know in chapter 5?"
 *
 * Examples:
 *   - subject: "Alice", predicate: "location", object: "Paris", validFrom: 3, validUntil: 7
 *   - subject: "Bob", predicate: "knows", object: "Alice's secret", validFrom: 5, validUntil: null
 */
export const storyFacts = sqliteTable(
  'story_facts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    predicate: text('predicate').notNull(),
    object: text('object').notNull(),
    // Temporal validity — chapter range where this fact holds
    validFromChapter: integer('valid_from_chapter').notNull(),
    validUntilChapter: integer('valid_until_chapter'), // null = still valid
    // Which chapter introduced this fact
    sourceChapter: integer('source_chapter').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_facts_project_idx').on(table.projectId),
    index('story_facts_subject_idx').on(table.projectId, table.subject),
    index('story_facts_predicate_idx').on(table.projectId, table.predicate),
    index('story_facts_valid_idx').on(
      table.projectId,
      table.validFromChapter,
      table.validUntilChapter
    ),
    index('story_facts_source_idx').on(table.projectId, table.sourceChapter),
  ]
);

// ---------------------------------------------------------------------------
// Chapter Summaries
// ---------------------------------------------------------------------------

/**
 * Chapter summaries store per-chapter metadata for story continuity.
 * Used by the consolidator to maintain context across chapters.
 */
export const storyChapterSummaries = sqliteTable(
  'story_chapter_summaries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    chapter: integer('chapter').notNull(),
    title: text('title').notNull(),
    // Comma-separated character names present in this chapter
    characters: text('characters').notNull().default(''),
    // Summary of key events
    events: text('events').notNull().default(''),
    // State changes that occurred (e.g., "Alice learned Bob's secret")
    stateChanges: text('state_changes').notNull().default(''),
    // Hook activity in this chapter (advances, payoffs, new seeds)
    hookActivity: text('hook_activity').notNull().default(''),
    // Emotional tone/mood of the chapter
    mood: text('mood').notNull().default(''),
    // Chapter type (e.g., "action", "dialogue", "exposition", "climax")
    chapterType: text('chapter_type').notNull().default(''),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_summaries_project_chapter_idx').on(
      table.projectId,
      table.chapter
    ),
  ]
);

// ---------------------------------------------------------------------------
// Hooks — Narrative Tension Tracking
// ---------------------------------------------------------------------------

/**
 * Hooks track narrative tension elements: foreshadowing, plot threads,
 * unresolved questions. The hook system ensures payoffs happen at
 * appropriate intervals and prevents narrative loose ends.
 *
 * Hook lifecycle: open → (advanced)* → resolved | abandoned
 */
export const storyHooks = sqliteTable(
  'story_hooks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    // Human-readable hook identifier (e.g., "alice-secret", "door-mystery")
    hookId: text('hook_id').notNull(),
    // Chapter where this hook was planted
    startChapter: integer('start_chapter').notNull().default(0),
    // Hook type: "foreshadow", "mystery", "promise", "question", "tension"
    type: text('type').notNull().default(''),
    // Status: "open", "advanced", "resolved", "abandoned"
    status: text('status').notNull().default('open'),
    // Last chapter where this hook was advanced/referenced
    lastAdvancedChapter: integer('last_advanced_chapter').notNull().default(0),
    // Description of expected payoff
    expectedPayoff: text('expected_payoff').notNull().default(''),
    // When payoff should occur: "soon", "mid", "late", "climax"
    payoffTiming: text('payoff_timing').notNull().default(''),
    // Additional notes about the hook
    notes: text('notes').notNull().default(''),
    // Hook causality / promotion metadata (Phase 7)
    dependsOn: text('depends_on', { mode: 'json' }).$type<string[]>(),
    paysOffInArc: text('pays_off_in_arc'),
    coreHook: integer('core_hook', { mode: 'boolean' }).default(false),
    halfLifeChapters: integer('half_life_chapters'),
    advancedCount: integer('advanced_count').default(0),
    // Whether the seed has been promoted into the live ledger
    promoted: integer('promoted', { mode: 'boolean' }).default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_hooks_project_idx').on(table.projectId),
    index('story_hooks_project_hook_idx').on(table.projectId, table.hookId),
    index('story_hooks_status_idx').on(table.projectId, table.status),
    index('story_hooks_last_advanced_idx').on(
      table.projectId,
      table.lastAdvancedChapter
    ),
  ]
);

// ---------------------------------------------------------------------------
// Story Chapters (the actual chapter content)
// ---------------------------------------------------------------------------

/**
 * Stores the actual chapter content for InkOS stories.
 */
export const storyChapters = sqliteTable(
  'story_chapters',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    chapterNumber: integer('chapter_number').notNull(),
    title: text('title').notNull(),
    // The actual chapter content (markdown)
    content: text('content').notNull(),
    // Word count for tracking
    wordCount: integer('word_count').notNull().default(0),
    // Generation metadata
    generatedBy: text('generated_by'), // Model used
    generationPrompt: text('generation_prompt'), // Prompt used
    sourceType: text('source_type')
      .$type<'manual' | 'inkos-script' | 'inkos-interactive'>()
      .notNull()
      .default('manual'),
    sourceKey: text('source_key'),
    sourceRevision: integer('source_revision').notNull().default(0),
    sourceHash: text('source_hash'),
    sourceUpdatedAt: text('source_updated_at'),
    // Status: "draft", "review", "final"
    status: text('status').notNull().default('draft'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_chapters_project_idx').on(table.projectId),
    uniqueIndex('story_chapters_project_number_idx').on(
      table.projectId,
      table.chapterNumber
    ),
    uniqueIndex('story_chapters_source_key_unique')
      .on(table.projectId, table.sourceType, table.sourceKey)
      .where(sql`${table.sourceKey} IS NOT NULL`),
  ]
);

export const storySyncReceipts = sqliteTable(
  'story_sync_receipts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    artifactKind: text('artifact_kind').notNull(),
    revision: integer('revision').notNull(),
    payloadHash: text('payload_hash').notNull(),
    receivedAt: text('received_at').notNull(),
    appliedAt: text('applied_at').notNull(),
  },
  (table) => [
    uniqueIndex('story_sync_receipts_provider_event_unique').on(
      table.provider,
      table.eventId
    ),
    index('story_sync_receipts_project_idx').on(table.projectId),
  ]
);

// ---------------------------------------------------------------------------
// Story Characters (character bible)
// ---------------------------------------------------------------------------

/**
 * Character definitions for InkOS stories.
 * Links to OpenStory's cast system for visual representation.
 */
export const storyCharacters = sqliteTable(
  'story_characters',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    projectId: text('project_id')
      .notNull()
      .references(() => storyProjects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Character description and traits
    description: text('description'),
    traits: text('traits'), // Simple text, parse as JSON when needed,
    backstory: text('backstory'),
    // Voice/dialogue style notes
    voiceNotes: text('voice_notes'),
    // Link to OpenStory character (for visual representation)
    openStoryCharacterId: text('openstory_character_id'),
    // First appearance
    introducedInChapter: integer('introduced_in_chapter'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('story_characters_project_idx').on(table.projectId),
    index('story_characters_name_idx').on(table.projectId, table.name),
  ]
);
