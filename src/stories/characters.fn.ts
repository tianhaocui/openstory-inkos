/**
 * InkOS Characters — Server Functions
 *
 * 角色的 CRUD 操作
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authWithTeamMiddleware } from '@/platform/middleware.fn';
import { storyCharacters, storyProjects } from '@/platform/server/db/schema';
import { getDb } from '#db-client';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';

// Schemas
const createCharacterSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1, '角色名称不能为空').max(50),
  description: z.string().max(1000).optional(),
  traits: z.string().optional(), // Stored as JSON text
  backstory: z.string().optional(),
  voiceNotes: z.string().optional(),
});

const updateCharacterSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional(),
  traits: z.string().optional(), // Stored as JSON text
  backstory: z.string().optional(),
  voiceNotes: z.string().optional(),
});

const characterIdSchema = z.object({
  id: z.string(),
});

const projectIdSchema = z.object({
  projectId: z.string(),
});

/**
 * 获取故事的角色列表
 */
export const getCharactersFn = createServerFn({ method: 'GET' })
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

    const characters = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.projectId, data.projectId));

    return characters;
  });

/**
 * 创建新角色
 */
export const createCharacterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(createCharacterSchema))
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

    const id = ulid();
    const now = new Date().toISOString();

    await db.insert(storyCharacters).values({
      id,
      projectId: data.projectId,
      name: data.name,
      description: data.description || null,
      traits: data.traits || null,
      backstory: data.backstory || null,
      voiceNotes: data.voiceNotes || null,
      createdAt: now,
      updatedAt: now,
    });

    const [character] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, id))
      .limit(1);

    return character;
  });

/**
 * 更新角色
 */
export const updateCharacterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(updateCharacterSchema))
  .handler(async ({ data, context }) => {
    const { teamId } = context;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, data.id))
      .limit(1);

    if (!existing) {
      throw new Error('角色不存在');
    }

    // 验证项目所有权
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, existing.projectId))
      .limit(1);

    if (!project || project.teamId !== teamId) {
      throw new Error('角色不存在');
    }

    await db
      .update(storyCharacters)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.traits !== undefined && { traits: data.traits }),
        ...(data.backstory !== undefined && { backstory: data.backstory }),
        ...(data.voiceNotes !== undefined && { voiceNotes: data.voiceNotes }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(storyCharacters.id, data.id));

    const [character] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, data.id))
      .limit(1);

    return character;
  });

/**
 * 删除角色
 */
export const deleteCharacterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(characterIdSchema))
  .handler(async ({ data, context }) => {
    const { teamId } = context;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, data.id))
      .limit(1);

    if (!existing) {
      throw new Error('角色不存在');
    }

    // 验证项目所有权
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, existing.projectId))
      .limit(1);

    if (!project || project.teamId !== teamId) {
      throw new Error('角色不存在');
    }

    await db.delete(storyCharacters).where(eq(storyCharacters.id, data.id));

    return { success: true };
  });
