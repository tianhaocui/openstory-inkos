/**
 * InkOS Stories — Server Functions
 *
 * 故事项目的 CRUD 操作
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authWithTeamMiddleware } from '@/platform/middleware.fn';
import { storyProjects } from '@/platform/server/db/schema';
import { getDb } from '#db-client';
import { eq, desc } from 'drizzle-orm';
import { createOrReuseInkOSBook } from './server/inkos-studio';

// Schemas
const createStorySchema = z.object({
  name: z.string().min(1, '故事名称不能为空').max(100),
  description: z.string().max(500).optional(),
  genre: z.string().optional(),
  tone: z.string().optional(),
  targetLength: z.number().int().min(1000).default(100000),
});

const updateStorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  genre: z.string().optional(),
  tone: z.string().optional(),
  targetLength: z.number().int().min(1000).optional(),
});

const storyIdSchema = z.object({
  id: z.string(),
});

// Server Functions

/**
 * 获取用户的故事列表
 */
export const getStoriesFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .handler(async ({ context }) => {
    const { teamId } = context;
    const db = getDb();
    
    const stories = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.teamId, teamId))
      .orderBy(desc(storyProjects.updatedAt));
    
    return stories;
  });

/**
 * 获取单个故事详情
 */
export const getStoryFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(storyIdSchema))
  .handler(async ({ data, context }) => {
    const { teamId } = context;
    const db = getDb();
    
    const [story] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, data.id))
      .limit(1);
    
    if (!story || story.teamId !== teamId) {
      throw new Error('故事不存在');
    }
    
    return story;
  });

/**
 * 创建新故事
 */
export const createStoryFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(createStorySchema))
  .handler(async ({ data, context }) => {
    const { teamId, user } = context;
    const db = getDb();
    
    const now = new Date().toISOString();
    
    const settings = {
      genre: data.genre || undefined,
      tone: data.tone || undefined,
      targetLength: data.targetLength,
    };
    
    const [story] = await db.insert(storyProjects).values([{
      teamId,
      userId: user.id,
      name: data.name,
      description: data.description || null,
      settings,
      createdAt: now,
      updatedAt: now,
    }]).returning();

    if (!story) throw new Error('故事创建失败');

    const inkos = await createOrReuseInkOSBook({
      title: data.name,
      description: data.description,
      genre: data.genre,
      targetLength: data.targetLength,
    });

    const [linkedStory] = await db
      .update(storyProjects)
      .set({
        settings: { ...settings, inkos },
        updatedAt: new Date().toISOString(),
      })
      .where(eq(storyProjects.id, story.id))
      .returning();

    return linkedStory ?? story;
  });

/**
 * 更新故事
 */
export const updateStoryFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(updateStorySchema))
  .handler(async ({ data, context }) => {
    const { teamId } = context;
    const db = getDb();
    
    // 验证所有权
    const [existing] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, data.id))
      .limit(1);
    
    if (!existing || existing.teamId !== teamId) {
      throw new Error('故事不存在');
    }
    
    // 合并 settings
    const existingSettings = existing.settings || {};
    const newSettings = {
      ...existingSettings,
      ...(data.genre !== undefined && { genre: data.genre }),
      ...(data.tone !== undefined && { tone: data.tone }),
      ...(data.targetLength !== undefined && { targetLength: data.targetLength }),
    };
    
    await db
      .update(storyProjects)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        settings: newSettings,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(storyProjects.id, data.id));
    
    const [story] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, data.id))
      .limit(1);
    
    return story;
  });

/**
 * 删除故事
 */
export const deleteStoryFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(storyIdSchema))
  .handler(async ({ data, context }) => {
    const { teamId } = context;
    const db = getDb();
    
    // 验证所有权
    const [existing] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, data.id))
      .limit(1);
    
    if (!existing || existing.teamId !== teamId) {
      throw new Error('故事不存在');
    }
    
    await db
      .delete(storyProjects)
      .where(eq(storyProjects.id, data.id));
    
    return { success: true };
  });
