import { describe, expect, it } from 'vitest';
import { buildInkOSBookUrl, normalizeInkOSBookId } from './inkos-studio';

describe('InkOS Studio links', () => {
  it('uses the same safe id derivation as InkOS Studio', () => {
    expect(normalizeInkOSBookId('夜间派送：第一季')).toBe('夜间派送-第一季');
    expect(normalizeInkOSBookId('A story / with punctuation')).toBe(
      'a-story-with-punctuation',
    );
  });

  it('opens the linked InkOS book route', () => {
    expect(buildInkOSBookUrl('https://inkos.example/', '夜间派送-第一季')).toBe(
      'https://inkos.example/#/book/%E5%A4%9C%E9%97%B4%E6%B4%BE%E9%80%81-%E7%AC%AC%E4%B8%80%E5%AD%A3',
    );
  });
});
