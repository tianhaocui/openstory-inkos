import { describe, expect, it } from 'vitest';
import { micros } from '@/billing/money';
import { buildPricingCatalog } from './pricing-catalog';

const falPricing = {
  'xai/grok-imagine-video/v1.5/image-to-video': {
    unitPrice: micros(10_000),
    unit: 'units',
  },
};

function rows(vias: { byteplus: boolean; xai: boolean; google: boolean }) {
  const catalog = buildPricingCatalog({ falPricing, falUpdatedAt: null, vias });
  return Object.fromEntries(
    catalog.sections.flatMap((s) => s.rows.map((r) => [r.name, r]))
  );
}

describe('buildPricingCatalog native vias', () => {
  it('quotes each direct provider when its platform key is live', () => {
    const r = rows({ byteplus: true, xai: true, google: true });
    expect(r['Grok Imagine Image 2.0']).toMatchObject({
      via: 'xAI',
      price: '$0.04 / 张图像',
    });
    expect(r['Grok Imagine Video 1.5']).toMatchObject({
      via: 'xAI',
      price: '$0.08 / 秒起',
    });
    expect(r['Nano Banana 2']).toMatchObject({
      via: 'Google',
      price: '$0.07 / 张图像起',
    });
    expect(r['Gemini Omni Flash 1.1']).toMatchObject({ via: 'Google' });
    expect(r['Seedream 5.0 Pro']).toMatchObject({ via: 'BytePlus' });
    expect(r['Grok 4.6']).toMatchObject({
      via: 'xAI',
      price: '输入 $2.00 / 百万 token · 输出 $6.00 / 百万 token',
    });
    expect(r['Gemini 3.1 Pro']).toMatchObject({ via: 'Google' });
  });

  it('falls back to fal / OpenRouter without keys', () => {
    const r = rows({ byteplus: false, xai: false, google: false });
    expect(r['Grok Imagine Image 2.0']?.via).toBe('fal.ai');
    expect(r['Grok Imagine Video 1.5']).toMatchObject({
      via: 'fal.ai',
      price: '$0.01 / 次生成起',
    });
    expect(r['Seedream 5.0 Pro']?.via).toBe('fal.ai');
    expect(r['Grok 4.6']?.via).toBe('OpenRouter');
  });
});
