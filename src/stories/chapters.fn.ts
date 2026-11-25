/**
 * InkOS Chapters — Server Functions
 *
 * 章节的 CRUD 操作
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authWithTeamMiddleware } from '@/platform/middleware.fn';
import { storyChapters, storyProjects } from '@/platform/server/db/schema';
import { getDb } from '#db-client';
import { eq, desc } from 'drizzle-orm';
import { ulid } from 'ulid';

// Schemas
const createChapterSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1, '章节标题不能为空').max(100),
  content: z.string().default(''),
});

const updateChapterSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(100).optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'review', 'final']).optional(),
});

const chapterIdSchema = z.object({
  id: z.string(),
});

const projectIdSchema = z.object({
  projectId: z.string(),
});

/**
 * 获取故事的章节列表
 */
export const getChaptersFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(projectIdSchema))
  .handler(async ({ data, context }) => {
    const { teamId } = context;
    const db = getDb();

    // 验证项目所有权
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, data.projectId))
      .limit(1);

    if (!project || project.teamId !== teamId) {
      throw new Error('项目不存在');
    }

    const chapters = await db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.projectId, data.projectId))
      .orderBy(storyChapters.chapterNumber);

    return chapters;
  });

/**
 * 获取单个章节
 */
export const getChapterFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(chapterIdSchema))
  .handler(async ({ data, context }) => {
    const { teamId } = context;
    const db = getDb();

    const [chapter] = await db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.id, data.id))
      .limit(1);

    if (!chapter) {
      throw new Error('章节不存在');
    }

    // 验证项目所有权
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, chapter.projectId))
      .limit(1);

    if (!project || project.teamId !== teamId) {
      throw new Error('章节不存在');
    }

    return chapter;
  });

/**
 * 创建新章节
 */
export const createChapterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(createChapterSchema))
  .handler(async ({ data, context }) => {
    const { teamId } = context;
    const db = getDb();

    // 验证项目所有权
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, data.projectId))
      .limit(1);

    if (!project || project.teamId !== teamId) {
      throw new Error('项目不存在');
    }

    // 获取当前最大章节号
    const [lastChapter] = await db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.projectId, data.projectId))
      .orderBy(desc(storyChapters.chapterNumber))
      .limit(1);

    const chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;
    const id = ulid();
    const now = new Date().toISOString();
    const wordCount = data.content.replace(/\s/g, '').length;

    await db.insert(storyChapters).values({
      id,
      projectId: data.projectId,
      chapterNumber,
      title: data.title,
      content: data.content,
      wordCount,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });

    const [chapter] = await db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.id, id))
      .limit(1);

    return chapter;
  });

/**
 * 更新章节
 */
export const updateChapterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(updateChapterSchema))
  .handler(async ({ data, context }) => {
    const { teamId } = context;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.id, data.id))
      .limit(1);

    if (!existing) {
      throw new Error('章节不存在');
    }

    // 验证项目所有权
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, existing.projectId))
      .limit(1);

    if (!project || project.teamId !== teamId) {
      throw new Error('章节不存在');
    }

    const wordCount = data.content
      ? data.content.replace(/\s/g, '').length
      : existing.wordCount;

    await db
      .update(storyChapters)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.status !== undefined && { status: data.status }),
        wordCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(storyChapters.id, data.id));

    const [chapter] = await db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.id, data.id))
      .limit(1);

    return chapter;
  });

/**
 * 删除章节
 */
export const deleteChapterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(chapterIdSchema))
  .handler(async ({ data, context }) => {
    const { teamId } = context;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.id, data.id))
      .limit(1);

    if (!existing) {
      throw new Error('章节不存在');
    }

    // 验证项目所有权
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, existing.projectId))
      .limit(1);

    if (!project || project.teamId !== teamId) {
      throw new Error('章节不存在');
    }

    await db.delete(storyChapters).where(eq(storyChapters.id, data.id));

    return { success: true };
  });
