/**
 * Scene-split found more stills/motion than the click envelope could grow to
 * cover (#1310 / #1328). That is a top-up prompt, not a generation failure.
 *
 * The persisted `sequence.statusError` is the classification source (same
 * pattern as content-checker warnings): match a stable phrase so a child-
 * workflow prefix cannot hide it, and keep old copy ("Add credits and retry")
 * working for sequences that already failed.
 */

import { microsToDisplayUsd, type Microdollars } from './money';

export const CREDITS_SHORT_TITLE = '充值点数后继续';

const CREDITS_SHORT_PATTERN = /not enough credits to generate|所需点数不足/i;
const SCENE_COUNT_PATTERN = /images for (\d+) scenes|生成 (\d+) 个场景/i;
const AMOUNT_PATTERN = /add (\$[\d.]+) more|再充值 (\$[\d.]+)/i;

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return '';
}

export function isCreditsShortError(error: unknown): boolean {
  return CREDITS_SHORT_PATTERN.test(messageOf(error));
}

export function creditsShortStatusError(opts: {
  sceneCount: number;
  neededMicros: Microdollars;
}): string {
  const amountBit =
    opts.neededMicros > 0
      ? `请再充值 ${microsToDisplayUsd(opts.neededMicros)}，然后继续。`
      : '请充值点数后继续。';
  return `生成 ${opts.sceneCount} 个场景的图片所需点数不足。${amountBit}`;
}

export function creditsShortHint(error: string | null | undefined): string {
  const message = error ?? '';
  const scenesMatch = message.match(SCENE_COUNT_PATTERN);
  const scenes = scenesMatch?.[1] ?? scenesMatch?.[2];
  const amountMatch = message.match(AMOUNT_PATTERN);
  const amount = amountMatch?.[1] ?? amountMatch?.[2];
  const sceneBit = scenes
    ? `此序列包含 ${scenes} 个场景，超过首次估算。`
    : '场景拆分后的工作量超过首次估算。';
  const amountBit = amount
    ? `请再充值 ${amount}，然后继续生成。`
    : '请充值点数后继续生成。';
  return `${sceneBit} ${amountBit}`;
}
