import { describe, expect, it } from 'vitest';
import { micros } from './money';
import {
  CREDITS_SHORT_TITLE,
  creditsShortHint,
  creditsShortStatusError,
  isCreditsShortError,
} from './credits-short';

describe('isCreditsShortError', () => {
  it('matches the persisted reservation-short statusError', () => {
    expect(
      isCreditsShortError(
        'Not enough credits to generate images for 11 scenes. Add credits and retry.'
      )
    ).toBe(true);
  });

  it('matches when a child-workflow prefix wraps the statusError', () => {
    expect(
      isCreditsShortError(
        'Child workflow analyze-script:1 failed: Not enough credits to generate images for 11 scenes. Add $4.20 more, then continue.'
      )
    ).toBe(true);
  });

  it('matches Error instances', () => {
    expect(
      isCreditsShortError(
        new Error(
          'Not enough credits to generate images for 3 scenes. Add credits, then continue.'
        )
      )
    ).toBe(true);
  });

  it('does not match unrelated failures', () => {
    expect(isCreditsShortError('Generation was interrupted')).toBe(false);
    expect(isCreditsShortError('Blocked by the content checker')).toBe(false);
    expect(isCreditsShortError(undefined)).toBe(false);
  });
});

describe('creditsShortStatusError', () => {
  it('names the scene count and how much more is needed', () => {
    expect(
      creditsShortStatusError({
        sceneCount: 11,
        neededMicros: micros(4_200_000),
      })
    ).toBe('生成 11 个场景的图片所需点数不足。请再充值 $4.20，然后继续。');
  });

  it('omits a $0.00 shortfall', () => {
    expect(
      creditsShortStatusError({
        sceneCount: 4,
        neededMicros: micros(0),
      })
    ).toBe('生成 4 个场景的图片所需点数不足。请充值点数后继续。');
  });
});

describe('creditsShortHint', () => {
  it('uses scene count and amount from the stored message', () => {
    expect(
      creditsShortHint(
        creditsShortStatusError({
          sceneCount: 11,
          neededMicros: micros(4_200_000),
        })
      )
    ).toBe(
      '此序列包含 11 个场景，超过首次估算。 请再充值 $4.20，然后继续生成。'
    );
  });

  it('still reads the pre-#1328 copy', () => {
    expect(
      creditsShortHint(
        'Not enough credits to generate images for 11 scenes. Add credits and retry.'
      )
    ).toBe('此序列包含 11 个场景，超过首次估算。 请充值点数后继续生成。');
  });

  it('falls back when the message has no scene count', () => {
    expect(creditsShortHint('Not enough credits to generate images.')).toBe(
      '场景拆分后的工作量超过首次估算。 请充值点数后继续生成。'
    );
  });
});

describe('CREDITS_SHORT_TITLE', () => {
  it('is a top-up prompt, not a failure', () => {
    expect(CREDITS_SHORT_TITLE).toBe('充值点数后继续');
    expect(CREDITS_SHORT_TITLE.toLowerCase()).not.toContain('fail');
  });
});
