/**
 * InkOS Chapters — Server Functions
 *
 * 章节的 CRUD 操作
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authWithTeamMiddleware } from '@/platform/middleware.fn';
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
    const storiesDb = context.scopedDb.stories;

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    return storiesDb.listChapters(data.projectId);
  });

/**
 * 获取单个章节
 */
export const getChapterFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(chapterIdSchema))
  .handler(async ({ data, context }) => {
    const storiesDb = context.scopedDb.stories;
    const chapter = await storiesDb.getChapter(data.id);

    if (!chapter) {
      throw new Error('章节不存在');
    }

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(chapter.projectId);
    if (!project) {
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
    const storiesDb = context.scopedDb.stories;

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    // 获取当前最大章节号
    const lastChapterNumber = await storiesDb.getLastChapterNumber(
      data.projectId
    );

    const chapterNumber =
      lastChapterNumber !== undefined ? lastChapterNumber + 1 : 1;
    const id = ulid();
    const now = new Date().toISOString();
    const wordCount = data.content.replace(/\s/g, '').length;

    return storiesDb.createChapter({
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
  });

/**
 * 更新章节
 */
export const updateChapterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(updateChapterSchema))
  .handler(async ({ data, context }) => {
    const storiesDb = context.scopedDb.stories;
    const existing = await storiesDb.getChapter(data.id);

    if (!existing) {
      throw new Error('章节不存在');
    }

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(existing.projectId);
    if (!project) {
      throw new Error('章节不存在');
    }

    const wordCount = data.content
      ? data.content.replace(/\s/g, '').length
      : existing.wordCount;

    return storiesDb.updateChapter(data.id, {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.status !== undefined && { status: data.status }),
      wordCount,
      updatedAt: new Date().toISOString(),
    });
  });

/**
 * 删除章节
 */
export const deleteChapterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(chapterIdSchema))
  .handler(async ({ data, context }) => {
    const storiesDb = context.scopedDb.stories;
    const existing = await storiesDb.getChapter(data.id);

    if (!existing) {
      throw new Error('章节不存在');
    }

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(existing.projectId);
    if (!project) {
      throw new Error('章节不存在');
    }

    await storiesDb.deleteChapter(data.id);

    return { success: true };
  });
