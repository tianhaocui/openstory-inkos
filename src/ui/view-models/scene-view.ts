/**
 * SceneView — UI 层的「分镜场景」展示模型。
 *
 * 影片线是 scenes（orderIndex），小说影视线是 story_segments（segmentNumber
 * + chapterNumber）。两者在 UI 上都是 Story 下的 Scene，映射只发生在前端。
 */

import type { scenes, storySegments } from '@/platform/server/db/schema';

type FilmSceneRow = typeof scenes.$inferSelect;
type StorySegmentRow = typeof storySegments.$inferSelect;

export type SceneView = {
  id: string;
  storyId: string;
  title: string;
  order: number;
  summary: string | null;
  source: 'film' | 'novel';
};

export type SceneViewInput =
  | {
      kind: 'film';
      row: Pick<
        FilmSceneRow,
        'id' | 'sequenceId' | 'orderIndex' | 'title' | 'storyBeat'
      >;
    }
  | {
      kind: 'novel';
      row: Pick<
        StorySegmentRow,
        'id' | 'projectId' | 'chapterNumber' | 'segmentNumber' | 'summary'
      >;
    };

export function toSceneView(input: SceneViewInput): SceneView {
  if (input.kind === 'film') {
    const { id, sequenceId, orderIndex, title, storyBeat } = input.row;
    return {
      id,
      storyId: sequenceId,
      title: title?.trim() || `场景 ${orderIndex + 1}`,
      order: orderIndex,
      summary: storyBeat ?? null,
      source: 'film',
    };
  }

  const { id, projectId, chapterNumber, segmentNumber, summary } = input.row;
  return {
    id,
    storyId: projectId,
    title: `第 ${chapterNumber} 章 · 段落 ${segmentNumber}`,
    order: segmentNumber,
    summary: summary ?? null,
    source: 'novel',
  };
}
