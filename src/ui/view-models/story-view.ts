/**
 * StoryView — UI 层的「故事」展示模型。
 *
 * 两条数据线（影片序列 sequences / 小说故事项目 story_projects）在 UI 上
 * 都叫 Story。这里只做纯前端映射：不写库、不调用 server function，也不把
 * 两张表合并成一张。source 仅用于将来按来源决定跳转与文案，当前统一展示。
 */

import type { Sequence, storyProjects } from '@/platform/server/db/schema';

type NovelStoryRow = typeof storyProjects.$inferSelect;

export type StoryView = {
  id: string;
  title: string;
  description: string | null;
  updatedAt: string;
  source: 'film' | 'novel';
};

export type FilmStoryInput = Pick<
  Sequence,
  'id' | 'title' | 'script' | 'updatedAt'
>;
type NovelStoryInput = Pick<
  NovelStoryRow,
  'id' | 'name' | 'description' | 'updatedAt'
>;

export type StoryViewInput =
  | { kind: 'film'; row: FilmStoryInput }
  | { kind: 'novel'; row: NovelStoryInput };

const UNTITLED_FILM = '未命名影片';

function isoDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  return value instanceof Date ? value.toISOString() : value;
}

/** 影片序列 → StoryView。列表卡片用它统一标题缺省文案。 */
export function filmToStoryView(row: FilmStoryInput): StoryView {
  return {
    id: row.id,
    title: row.title.trim() || UNTITLED_FILM,
    description: row.script ?? null,
    updatedAt: isoDate(row.updatedAt),
    source: 'film',
  };
}

function novelToStoryView(row: NovelStoryInput): StoryView {
  return {
    id: row.id,
    title: row.name.trim() || '未命名故事',
    description: row.description ?? null,
    updatedAt: isoDate(row.updatedAt),
    source: 'novel',
  };
}

/** 两条数据来源的统一入口；详情页用它把当前影片映射成 Story。 */
export function toStoryView(input: StoryViewInput): StoryView {
  return input.kind === 'film'
    ? filmToStoryView(input.row)
    : novelToStoryView(input.row);
}
