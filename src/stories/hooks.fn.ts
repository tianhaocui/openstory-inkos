/**
 * InkOS Hooks — Server Functions
 *
 * 伏笔的 CRUD 操作
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authWithTeamMiddleware } from '@/platform/middleware.fn';
import { ulid } from 'ulid';

// Schemas
const createHookSchema = z.object({
  projectId: z.string(),
  hookId: z.string().min(1, '伏笔标识不能为空').max(50),
  type: z
    .enum(['foreshadow', 'mystery', 'promise', 'question', 'tension'])
    .default('mystery'),
  expectedPayoff: z.string().max(500).optional(),
  payoffTiming: z.enum(['soon', 'mid', 'late', 'climax']).default('mid'),
  notes: z.string().optional(),
});

const updateHookSchema = z.object({
  id: z.string(),
  hookId: z.string().min(1).max(50).optional(),
  type: z
    .enum(['foreshadow', 'mystery', 'promise', 'question', 'tension'])
    .optional(),
  status: z.enum(['open', 'advanced', 'resolved', 'abandoned']).optional(),
  expectedPayoff: z.string().max(500).optional(),
  payoffTiming: z.enum(['soon', 'mid', 'late', 'climax']).optional(),
  notes: z.string().optional(),
});

const hookIdSchema = z.object({
  id: z.string(),
});

const projectIdSchema = z.object({
  projectId: z.string(),
});

/**
 * 获取故事的伏笔列表
 */
export const getHooksFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(projectIdSchema))
  .handler(async ({ data, context }) => {
    const storiesDb = context.scopedDb.stories;

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    return storiesDb.listHooks(data.projectId);
  });

/**
 * 创建新伏笔
 */
export const createHookFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(createHookSchema))
  .handler(async ({ data, context }) => {
    const storiesDb = context.scopedDb.stories;

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(data.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const id = ulid();
    const now = new Date().toISOString();

    return storiesDb.createHook({
      id,
      projectId: data.projectId,
      hookId: data.hookId,
      type: data.type,
      status: 'open',
      expectedPayoff: data.expectedPayoff || '',
      payoffTiming: data.payoffTiming,
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    });
  });

/**
 * 更新伏笔
 */
export const updateHookFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(updateHookSchema))
  .handler(async ({ data, context }) => {
    const storiesDb = context.scopedDb.stories;
    const existing = await storiesDb.getHook(data.id);

    if (!existing) {
      throw new Error('伏笔不存在');
    }

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(existing.projectId);
    if (!project) {
      throw new Error('伏笔不存在');
    }

    return storiesDb.updateHook(data.id, {
      ...(data.hookId !== undefined && { hookId: data.hookId }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.expectedPayoff !== undefined && {
        expectedPayoff: data.expectedPayoff,
      }),
      ...(data.payoffTiming !== undefined && {
        payoffTiming: data.payoffTiming,
      }),
      ...(data.notes !== undefined && { notes: data.notes }),
      updatedAt: new Date().toISOString(),
    });
  });

/**
 * 删除伏笔
 */
export const deleteHookFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(hookIdSchema))
  .handler(async ({ data, context }) => {
    const storiesDb = context.scopedDb.stories;
    const existing = await storiesDb.getHook(data.id);

    if (!existing) {
      throw new Error('伏笔不存在');
    }

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(existing.projectId);
    if (!project) {
      throw new Error('伏笔不存在');
    }

    await storiesDb.deleteHook(data.id);

    return { success: true };
  });
