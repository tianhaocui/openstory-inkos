import {
  type SheetProgressActivity,
  sheetProgressActivitySchema,
} from '@/platform/realtime';

export type { SheetProgressActivity };

/** Longer than a slow 4-panel + headshot (those finish in ~2–5 min). */
export const SHEET_PROGRESS_STALE_MS = 10 * 60 * 1000;

export function isSheetProgressStale(
  tsMs: number | undefined,
  now = Date.now()
): boolean {
  if (tsMs === undefined) return false;
  return now - tsMs > SHEET_PROGRESS_STALE_MS;
}

/** What the UI should say for an in-flight talent-sheet run. */
export function sheetProgressCopy(
  activity: SheetProgressActivity,
  variant: 'short' | 'long' = 'short'
): string {
  if (activity === 'portrait') {
    return variant === 'long'
      ? '正在根据上传的设定图创建肖像…'
      : '正在创建肖像…';
  }
  return variant === 'long' ? '正在生成演员设定图…' : '正在生成设定图…';
}

export function parseSheetProgressActivity(
  value: unknown
): SheetProgressActivity | undefined {
  const parsed = sheetProgressActivitySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function activityFromProgress(data: {
  status: string;
  activity?: SheetProgressActivity;
}): SheetProgressActivity {
  if (data.status === 'sheet_ready') return 'portrait';
  return parseSheetProgressActivity(data.activity) ?? 'sheet';
}
