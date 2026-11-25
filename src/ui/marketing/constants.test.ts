import { describe, expect, it } from 'vitest';
import { FAQ_ITEMS, SITE_CONFIG } from './constants';
import { buildLlmsTxt } from '@/platform/server/agent/llms';

describe('SITE_CONFIG messaging (#1255)', () => {
  it('explains longer consistent films and iteration', () => {
    expect(SITE_CONFIG.description).toMatch(/5 分钟.*AI 影片/);
    expect(SITE_CONFIG.description).toMatch(/角色连贯一致/);
    expect(SITE_CONFIG.description).toMatch(/反复打磨.*满意/);
    expect(SITE_CONFIG.taglineSub).toMatch(/5 分钟.*AI 影片/);
    expect(SITE_CONFIG.taglineSub).toMatch(/反复打磨.*满意/);
  });

  it('answers “What is OpenStory?” with the same two points', () => {
    const what = FAQ_ITEMS.find(
      (item) => item.question === 'OpenStory 是什么？'
    );
    expect(what?.answer).toMatch(/多场景影片/);
    expect(what?.answer).toMatch(/角色.*保持一致/);
    expect(what?.answer).toMatch(/反复打磨/);
  });

  it('puts the same pitch in llms.txt', () => {
    const text = buildLlmsTxt();
    expect(text).toContain(SITE_CONFIG.description);
    expect(text).toMatch(/multi-scene film with consistent characters/i);
  });
});
