/**
 * InkOS AI Writer — Server Functions
 *
 * 基于 InkOS 的 AI 写作能力，整合到 OpenStory
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { getCustomAiConfig } from '@/models/server/custom-ai-config';
import { authWithTeamMiddleware } from '@/platform/middleware.fn';
import type { ScopedDb } from '@/platform/server/db/scoped';
import { ulid } from 'ulid';

type StoriesDb = ScopedDb['stories'];

// ============================================================================
// Types & Constants
// ============================================================================

// AI endpoint settings come from the shared getEnv()-backed module:
// `process.env` does not see Worker secrets in production.

// ============================================================================
// Schemas
// ============================================================================

const continueWritingSchema = z.object({
  projectId: z.string(),
  instruction: z.string().optional(), // 用户的续写指示
});

const analyzeChapterSchema = z.object({
  chapterId: z.string(),
});

const chatCompletionResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })),
});

const storySettingsSchema = z
  .object({
    genre: z.string().optional(),
    tone: z.string().optional(),
    targetLength: z.number().optional(),
    language: z.string().optional(),
  })
  .passthrough();

const chapterAnalysisSchema = z.object({
  facts: z
    .array(
      z.object({
        subject: z.string(),
        predicate: z.string(),
        object: z.string(),
      })
    )
    .optional(),
  hooks: z
    .array(
      z.object({
        hookId: z.string(),
        type: z.string().optional(),
        expectedPayoff: z.string().optional(),
        payoffTiming: z.string().optional(),
      })
    )
    .optional(),
  summary: z
    .object({
      events: z.string().optional(),
      mood: z.string().optional(),
      characters: z.array(z.string()).optional(),
      stateChanges: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

async function callAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const aiConfig = getCustomAiConfig();
  const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiConfig.apiKey ?? ''}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 8000,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error: ${response.status} - ${error}`);
  }

  // A malformed completion used to surface through an unchecked assertion;
  // treat it as an empty answer instead.
  const parsed = chatCompletionResponseSchema.safeParse(await response.json());
  if (!parsed.success) return '';
  return parsed.data.choices[0]?.message.content || '';
}

type ChapterAnalysisParse =
  | { ok: true; analysis: unknown; data: z.infer<typeof chapterAnalysisSchema> }
  | { ok: false };

function parseChapterAnalysis(response: string): ChapterAnalysisParse {
  try {
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch?.[1] ?? response;
    const analysis: unknown = JSON.parse(jsonStr);
    const validated = chapterAnalysisSchema.safeParse(analysis);
    if (!validated.success) return { ok: false };
    return { ok: true, analysis, data: validated.data };
  } catch {
    // 如果解析失败，返回原始响应
    return { ok: false };
  }
}

/**
 * `story_projects.settings` is a JSON column, so Drizzle hands back an object.
 * Legacy rows can still hold a raw JSON string; accept both without asserting.
 */
function readStorySettings(
  value: unknown
): z.infer<typeof storySettingsSchema> {
  const direct = storySettingsSchema.safeParse(value);
  if (direct.success) return direct.data;
  if (typeof value === 'string') {
    const decoded: unknown = JSON.parse(value);
    const fromJson = storySettingsSchema.safeParse(decoded);
    if (fromJson.success) return fromJson.data;
  }
  return {};
}

/**
 * 构建故事上下文（用于 AI 理解故事状态）
 */
async function buildStoryContext(projectId: string, storiesDb: StoriesDb) {
  const loaded = await storiesDb.loadStoryContext(projectId);
  if (!loaded) throw new Error('项目不存在');
  const { project, chapters, characters, hooks, facts, summaries } = loaded;

  const settings = readStorySettings(project.settings);

  return {
    project,
    settings,
    chapters,
    characters,
    hooks,
    facts,
    summaries,
    currentChapter: chapters.length,
    totalWordCount: chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
  };
}

/**
 * 构建写作系统提示词（InkOS 风格）
 */
function buildWriterSystemPrompt(
  context: Awaited<ReturnType<typeof buildStoryContext>>
): string {
  const { settings, characters, hooks } = context;

  const parts = [
    '你是一位专业的中文小说作家，负责续写长篇小说。',
    '',
    '## 写作原则',
    '- 盐溶于汤：人物价值观和野心靠行动表现，不靠口号。',
    "- Show don't tell：用行为、证据、细节和场景让读者自己感到人物状态。",
    '- 明喻节制：别把「像/仿佛/如同」当默认修辞反复用，每个场景最多 1 处。',
    '- 反注水：每个场景都推动冲突、因果、情绪、证据、压迫、回报或关系。',
    '- 高潮即场景：冲突爆发、反转、生死、揭露这些关键拍必须当场一拍一拍演出。',
    '- 回报要有铺垫：反转、打脸、和解、复仇、身份揭露都要有证据链和因果链。',
    '- 配角要有动机：压迫者也有利益、误判或恐惧，不要写成无脑工具人。',
    '- 移动端优先：段落短，信息密，少写空泛抒情和装饰性废话。',
    '',
  ];

  if (settings.genre) {
    parts.push(`## 故事类型: ${settings.genre}`);
  }
  if (settings.tone) {
    parts.push(`## 故事基调: ${settings.tone}`);
  }

  if (characters.length > 0) {
    parts.push('', '## 主要角色');
    for (const char of characters) {
      parts.push(`- **${char.name}**: ${char.description || '暂无描述'}`);
    }
  }

  if (hooks.length > 0) {
    const openHooks = hooks.filter(
      (h) => h.status === 'open' || h.status === 'advanced'
    );
    if (openHooks.length > 0) {
      parts.push('', '## 待处理伏笔（需要在后续章节回收）');
      for (const hook of openHooks) {
        parts.push(
          `- **${hook.hookId}** (${hook.type}): ${hook.expectedPayoff || '待揭晓'}`
        );
      }
    }
  }

  parts.push(
    '',
    '## 输出格式',
    '直接输出章节正文，不要输出标题、章节号或其他元信息。',
    '正文应该是完整的小说章节，约 1500-3000 字。'
  );

  return parts.join('\n');
}

/**
 * 构建章节分析系统提示词（用于提取事实和伏笔）
 */
function buildAnalyzerSystemPrompt(): string {
  return `你是一位专业的小说编辑，负责分析章节内容并提取关键信息。

请分析给定的章节，提取以下信息：

1. **事实 (Facts)**: 故事中的客观事实，格式为"主体-谓词-宾语"
   - 例如: "张三-位置-北京", "李四-知道-张三的秘密"

2. **伏笔 (Hooks)**: 章节中埋下的悬念或待解决的问题
   - 包括: 类型 (foreshadow/mystery/promise/question/tension)
   - 预期结局时机 (soon/mid/late/climax)

3. **章节摘要**: 简短描述本章的主要事件和情绪

请以 JSON 格式输出：
\`\`\`json
{
  "facts": [
    {"subject": "主体", "predicate": "谓词", "object": "宾语"}
  ],
  "hooks": [
    {"hookId": "标识", "type": "类型", "expectedPayoff": "预期结局", "payoffTiming": "时机"}
  ],
  "summary": {
    "events": "主要事件",
    "mood": "情绪基调",
    "characters": ["出场角色"],
    "stateChanges": "状态变化"
  }
}
\`\`\``;
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * AI 续写下一章
 */
export const continueWritingFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(continueWritingSchema))
  .handler(async ({ data, context: authContext }) => {
    const { teamId } = authContext;
    const storiesDb = authContext.scopedDb.stories;

    // 构建故事上下文
    const storyContext = await buildStoryContext(data.projectId, storiesDb);

    // 验证项目所有权
    if (storyContext.project.teamId !== teamId) {
      throw new Error('项目不存在');
    }

    // 构建用户提示词
    const userPromptParts = ['## 当前故事进度'];

    if (storyContext.chapters.length === 0) {
      userPromptParts.push('这是故事的第一章，请创作一个引人入胜的开篇。');
      userPromptParts.push(`故事名称: ${storyContext.project.name}`);
      if (storyContext.project.description) {
        userPromptParts.push(`故事简介: ${storyContext.project.description}`);
      }
    } else {
      // 添加最近章节内容作为上下文
      const recentChapters = storyContext.chapters.slice(-3);
      userPromptParts.push(`当前是第 ${storyContext.currentChapter + 1} 章`);
      userPromptParts.push(
        `总字数: ${storyContext.totalWordCount.toLocaleString()} 字`
      );
      userPromptParts.push('', '## 最近章节内容');

      for (const chapter of recentChapters) {
        userPromptParts.push(
          `### 第 ${chapter.chapterNumber} 章: ${chapter.title}`
        );
        // 只取最后 2000 字
        const content =
          chapter.content.length > 2000
            ? '...' + chapter.content.slice(-2000)
            : chapter.content;
        userPromptParts.push(content);
        userPromptParts.push('');
      }

      // 添加章节摘要
      if (storyContext.summaries.length > 0) {
        userPromptParts.push('## 之前章节摘要');
        for (const summary of storyContext.summaries.slice(-5)) {
          userPromptParts.push(`第 ${summary.chapter} 章: ${summary.events}`);
        }
      }
    }

    if (data.instruction) {
      userPromptParts.push('', '## 用户指示', data.instruction);
    }

    userPromptParts.push('', '请续写下一章的内容。');

    const systemPrompt = buildWriterSystemPrompt(storyContext);
    const userPrompt = userPromptParts.join('\n');

    // 调用 AI
    const content = await callAI(systemPrompt, userPrompt);

    // 创建新章节
    const chapterNumber = storyContext.currentChapter + 1;
    const id = ulid();
    const now = new Date().toISOString();
    const wordCount = content.replace(/\s/g, '').length;

    return storiesDb.createChapter({
      id,
      projectId: data.projectId,
      chapterNumber,
      title: `第${chapterNumber}章`,
      content,
      wordCount,
      status: 'draft',
      generatedBy: getCustomAiConfig().model,
      createdAt: now,
      updatedAt: now,
    });
  });

/**
 * 分析章节，提取事实和伏笔
 */
export const analyzeChapterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(zodValidator(analyzeChapterSchema))
  .handler(async ({ data, context: authContext }) => {
    const storiesDb = authContext.scopedDb.stories;

    // 获取章节
    const chapter = await storiesDb.getChapter(data.chapterId);

    if (!chapter) {
      throw new Error('章节不存在');
    }

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(chapter.projectId);

    if (!project) {
      throw new Error('章节不存在');
    }

    // 调用 AI 分析
    const systemPrompt = buildAnalyzerSystemPrompt();
    const userPrompt = `请分析以下章节内容：\n\n## 第 ${chapter.chapterNumber} 章: ${chapter.title}\n\n${chapter.content}`;

    const response = await callAI(systemPrompt, userPrompt);

    // 解析 JSON 响应
    const parsed = parseChapterAnalysis(response);
    if (!parsed.ok) {
      return { raw: response, parsed: false };
    }

    const now = new Date().toISOString();
    const { facts = [], hooks = [], summary } = parsed.data;

    // 保存事实到数据库
    if (facts.length > 0) {
      await storiesDb.insertFacts(
        facts.map((fact) => ({
          projectId: chapter.projectId,
          subject: fact.subject,
          predicate: fact.predicate,
          object: fact.object,
          validFromChapter: chapter.chapterNumber,
          sourceChapter: chapter.chapterNumber,
          createdAt: now,
        }))
      );
    }

    // 保存伏笔到数据库
    if (hooks.length > 0) {
      await storiesDb.insertHooks(
        hooks.map((hook) => ({
          id: ulid(),
          projectId: chapter.projectId,
          hookId: hook.hookId,
          type: hook.type || 'mystery',
          status: 'open',
          startChapter: chapter.chapterNumber,
          expectedPayoff: hook.expectedPayoff || '',
          payoffTiming: hook.payoffTiming || 'mid',
          createdAt: now,
          updatedAt: now,
        }))
      );
    }

    // 保存章节摘要
    if (summary) {
      await storiesDb.insertSummary({
        projectId: chapter.projectId,
        chapter: chapter.chapterNumber,
        title: chapter.title,
        events: summary.events || '',
        mood: summary.mood || '',
        characters: Array.isArray(summary.characters)
          ? summary.characters.join(', ')
          : '',
        stateChanges: summary.stateChanges || '',
        createdAt: now,
        updatedAt: now,
      });
    }

    return { analysis: parsed.data, parsed: true };
  });

/**
 * 重写/润色章节
 */
export const rewriteChapterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .validator(
    zodValidator(
      z.object({
        chapterId: z.string(),
        instruction: z.string().min(1, '请提供重写指示'),
      })
    )
  )
  .handler(async ({ data, context: authContext }) => {
    const { teamId } = authContext;
    const storiesDb = authContext.scopedDb.stories;

    // 获取章节
    const chapter = await storiesDb.getChapter(data.chapterId);

    if (!chapter) {
      throw new Error('章节不存在');
    }

    // 验证项目所有权
    const project = await storiesDb.getOwnedProject(chapter.projectId);

    if (!project || project.teamId !== teamId) {
      throw new Error('章节不存在');
    }

    const storyContext = await buildStoryContext(chapter.projectId, storiesDb);
    const systemPrompt = buildWriterSystemPrompt(storyContext);

    const userPrompt = `## 原章节内容
${chapter.content}

## 重写指示
${data.instruction}

请根据指示重写这一章节，保持故事的连贯性。直接输出重写后的正文。`;

    const newContent = await callAI(systemPrompt, userPrompt);
    const wordCount = newContent.replace(/\s/g, '').length;

    // 更新章节
    return storiesDb.updateChapter(data.chapterId, {
      content: newContent,
      wordCount,
      updatedAt: new Date().toISOString(),
    });
  });
