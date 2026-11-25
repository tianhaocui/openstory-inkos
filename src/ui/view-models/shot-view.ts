/**
 * ShotView（UI 展示模型）— Scene 下的「镜头」。
 *
 * 与 `src/shots/shot-view.ts` 的领域读模型不同：这里只取展示需要的字段，
 * 把 shots（影片线）与 story_shots（小说影视线）归一到同一形状。纯前端
 * adapter，不碰数据库、不改任何 server function 行为。
 */

import type { shots, storyShots } from '@/platform/server/db/schema';

type FilmShotRow = typeof shots.$inferSelect;
type StoryShotRow = typeof storyShots.$inferSelect;

export type ShotView = {
  id: string;
  sceneId: string | null;
  storyId: string;
  number: number;
  description: string | null;
  source: 'film' | 'novel';
};

export type ShotViewInput =
  | {
      kind: 'film';
      // `shots` 没有 description 列（提示词在版本表里）；展示层允许调用方
      // 传入已解析的描述，缺省时为 null。
      row: Pick<FilmShotRow, 'id' | 'sequenceId' | 'sceneId' | 'shotNumber'> & {
        description?: string | null;
      };
    }
  | {
      kind: 'novel';
      row: Pick<
        StoryShotRow,
        'id' | 'projectId' | 'segmentId' | 'shotNumber' | 'description'
      >;
    };

export function toShotView(input: ShotViewInput): ShotView {
  if (input.kind === 'film') {
    const { id, sequenceId, sceneId, shotNumber, description } = input.row;
    return {
      id,
      sceneId: sceneId ?? null,
      storyId: sequenceId,
      number: shotNumber ?? 0,
      description: description ?? null,
      source: 'film',
    };
  }

  const { id, projectId, segmentId, shotNumber, description } = input.row;
  return {
    id,
    sceneId: segmentId,
    storyId: projectId,
    number: shotNumber,
    description,
    source: 'novel',
  };
}
