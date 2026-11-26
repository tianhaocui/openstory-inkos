import { describe, expect, it } from 'vitest';
import { DASHSCOPE_MODEL_ID, dashScopeEndpointId } from '@/models/dashscope';
import {
  DASHSCOPE_RATE_CARD,
  dashScopeDurationCost,
  isDashScopePricedModel,
} from './dashscope-pricing';
import { micros } from './money';

describe('DASHSCOPE_RATE_CARD', () => {
  it('prices every native DashScope catalog id', () => {
    expect(isDashScopePricedModel(DASHSCOPE_MODEL_ID)).toBe(true);
    expect(DASHSCOPE_RATE_CARD[DASHSCOPE_MODEL_ID]).toBeDefined();
  });

  it('recognises a stamped endpoint id (host stripped)', () => {
    const stamped = dashScopeEndpointId(
      DASHSCOPE_MODEL_ID,
      'https://workspace.maas.aliyuncs.com/api/v1'
    );
    expect(isDashScopePricedModel(stamped)).toBe(true);
    expect(isDashScopePricedModel('fal-ai/some-model')).toBe(false);
  });

  it('quotes a per-second advertised estimate, never $0', () => {
    expect(DASHSCOPE_RATE_CARD[DASHSCOPE_MODEL_ID]?.unit).toBe('seconds');
    const fiveSeconds = dashScopeDurationCost(5);
    expect(fiveSeconds).not.toBeNull();
    expect(fiveSeconds).toBeGreaterThan(micros(0));
    expect(fiveSeconds).toBe(micros(42_300 * 5));
  });
});
