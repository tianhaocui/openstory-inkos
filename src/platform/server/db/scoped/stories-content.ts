/**
 * Story content queries (projects / chapters / characters / hooks / AI memory).
 *
 * All InkOS SQL lives here so server functions only call team-scoped methods on
 * `context.scopedDb.stories`. The factory keeps the same query shapes as the
 * original handlers — including the "fetch row, then check its project's team"
 * ownership checks — so refactoring does not change what a caller can see.
 */

import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '@/platform/server/db/client';
import {
  storyChapterSummaries,
  storyChapters,
  storyCharacters,
  storyFacts,
  storyHooks,
  storyProjects,
} from '@/platform/server/db/schema';

type ProjectInsert = typeof storyProjects.$inferInsert;
type ProjectUpdate = Partial<ProjectInsert>;
type ChapterInsert = typeof storyChapters.$inferInsert;
type ChapterUpdate = Partial<ChapterInsert>;
type CharacterInsert = typeof storyCharacters.$inferInsert;
type CharacterUpdate = Partial<CharacterInsert>;
type HookInsert = typeof storyHooks.$inferInsert;
type HookUpdate = Partial<HookInsert>;
type FactInsert = typeof storyFacts.$inferInsert;
type SummaryInsert = typeof storyChapterSummaries.$inferInsert;

export function createStoryContentMethods(db: Database, teamId: string) {
  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  async function listProjects() {
    return db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.teamId, teamId))
      .orderBy(desc(storyProjects.updatedAt));
  }

  /** Team-scoped read: a project owned by another team reads as absent. */
  async function getOwnedProject(projectId: string) {
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(
        and(eq(storyProjects.id, projectId), eq(storyProjects.teamId, teamId))
      )
      .limit(1);
    return project;
  }

  async function createProject(values: ProjectInsert) {
    const [project] = await db
      .insert(storyProjects)
      .values([values])
      .returning();
    return project;
  }

  async function updateProject(projectId: string, patch: ProjectUpdate) {
    const [project] = await db
      .update(storyProjects)
      .set(patch)
      .where(eq(storyProjects.id, projectId))
      .returning();
    return project;
  }

  async function deleteProject(projectId: string) {
    await db.delete(storyProjects).where(eq(storyProjects.id, projectId));
  }

  // -------------------------------------------------------------------------
  // Chapters
  // -------------------------------------------------------------------------

  async function listChapters(projectId: string) {
    return db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.projectId, projectId))
      .orderBy(storyChapters.chapterNumber);
  }

  async function getChapter(chapterId: string) {
    const [chapter] = await db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.id, chapterId))
      .limit(1);
    return chapter;
  }

  async function getLastChapterNumber(projectId: string) {
    const [chapter] = await db
      .select({ chapterNumber: storyChapters.chapterNumber })
      .from(storyChapters)
      .where(eq(storyChapters.projectId, projectId))
      .orderBy(desc(storyChapters.chapterNumber))
      .limit(1);
    return chapter?.chapterNumber;
  }

  /** Insert a chapter and read it back by its id. */
  async function createChapter(values: ChapterInsert) {
    await db.insert(storyChapters).values(values);
    return getChapter(values.id ?? '');
  }

  async function updateChapter(chapterId: string, patch: ChapterUpdate) {
    await db
      .update(storyChapters)
      .set(patch)
      .where(eq(storyChapters.id, chapterId));
    return getChapter(chapterId);
  }

  async function deleteChapter(chapterId: string) {
    await db.delete(storyChapters).where(eq(storyChapters.id, chapterId));
  }

  // -------------------------------------------------------------------------
  // Characters
  // -------------------------------------------------------------------------

  async function listCharacters(projectId: string) {
    return db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.projectId, projectId));
  }

  async function getCharacter(characterId: string) {
    const [character] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, characterId))
      .limit(1);
    return character;
  }

  async function createCharacter(values: CharacterInsert) {
    await db.insert(storyCharacters).values(values);
    return getCharacter(values.id ?? '');
  }

  async function updateCharacter(characterId: string, patch: CharacterUpdate) {
    await db
      .update(storyCharacters)
      .set(patch)
      .where(eq(storyCharacters.id, characterId));
    return getCharacter(characterId);
  }

  async function deleteCharacter(characterId: string) {
    await db.delete(storyCharacters).where(eq(storyCharacters.id, characterId));
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  async function listHooks(projectId: string) {
    return db
      .select()
      .from(storyHooks)
      .where(eq(storyHooks.projectId, projectId));
  }

  async function getHook(hookId: string) {
    const [hook] = await db
      .select()
      .from(storyHooks)
      .where(eq(storyHooks.id, hookId))
      .limit(1);
    return hook;
  }

  async function createHook(values: HookInsert) {
    await db.insert(storyHooks).values(values);
    return getHook(values.id ?? '');
  }

  async function insertHook(values: HookInsert) {
    await db.insert(storyHooks).values(values);
  }

  async function insertHooks(values: HookInsert[]) {
    for (const hook of values) {
      await db.insert(storyHooks).values(hook);
    }
  }

  async function updateHook(hookId: string, patch: HookUpdate) {
    await db.update(storyHooks).set(patch).where(eq(storyHooks.id, hookId));
    return getHook(hookId);
  }

  async function deleteHook(hookId: string) {
    await db.delete(storyHooks).where(eq(storyHooks.id, hookId));
  }

  // -------------------------------------------------------------------------
  // AI writer memory (facts + summaries)
  // -------------------------------------------------------------------------

  async function insertFacts(values: FactInsert[]) {
    for (const fact of values) {
      await db.insert(storyFacts).values(fact);
    }
  }

  async function insertSummary(values: SummaryInsert) {
    await db.insert(storyChapterSummaries).values(values);
  }

  /**
   * All the reads `buildStoryContext` needs, in the same order and shape as
   * before. Team ownership is still checked by the caller after the project
   * row comes back.
   */
  async function loadStoryContext(projectId: string) {
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, projectId))
      .limit(1);
    if (!project) return null;

    const chapters = await db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.projectId, projectId))
      .orderBy(storyChapters.chapterNumber);
    const characters = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.projectId, projectId));
    const hooks = await db
      .select()
      .from(storyHooks)
      .where(eq(storyHooks.projectId, projectId));
    const facts = await db
      .select()
      .from(storyFacts)
      .where(eq(storyFacts.projectId, projectId));
    const summaries = await db
      .select()
      .from(storyChapterSummaries)
      .where(eq(storyChapterSummaries.projectId, projectId));

    return { project, chapters, characters, hooks, facts, summaries };
  }

  return {
    listProjects,
    getOwnedProject,
    createProject,
    updateProject,
    deleteProject,
    listChapters,
    getChapter,
    getLastChapterNumber,
    createChapter,
    updateChapter,
    deleteChapter,
    listCharacters,
    getCharacter,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    listHooks,
    getHook,
    createHook,
    insertHook,
    insertHooks,
    updateHook,
    deleteHook,
    insertFacts,
    insertSummary,
    loadStoryContext,
  };
}
