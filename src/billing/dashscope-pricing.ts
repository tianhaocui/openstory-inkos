/**
 * DashScope rate card (advertised, NOT bill-verified).
 *
 * Alibaba publishes no pricing API we can mirror into `model_pricing`, so the
 * rate is a hand-maintained card merged into the effective pricing map at read
 * time. A fresh deploy is therefore correct immediately — there is no window
 * where a Wan job bills $0 because a seed/cron has not run (#1069's failure
 * mode).
 *
 * RATES: read from help.aliyun.com/zh/model-studio/wan3-0-video on
 * **2026-11-26** — Beijing 480P is ¥0.30/second list (¥0.21 promo). The card
 * uses the HIGHER list price converted at ~7.1 CNY/USD so the credit gate
 * over-estimates; an under-estimate lets a team spend past its balance.
 *
 * DashScope's task response reports no `cost` and no billable units, so the
 * exact post-generation charge is ZERO and this spend is UNAUDITED (same shape
 * as native xAI / Google / Ark). Confirm against a real Alibaba invoice before
 * leaning on the estimate, and re-date this line when bumping.
 */

import { dashScopePricingKey } from '@/models/dashscope';
import { micros, multiplyMicros, type Microdollars } from './money';
import type { EffectiveFalPricing } from '@/billing/server/fal-pricing-live';

/** ~$0.0423/s, rounded up to a whole microdollar per cent. */
const WAN_480P_PER_SECOND = micros(42_300);

export const DASHSCOPE_RATE_CARD: Record<string, EffectiveFalPricing> = {
  'wan3.0-video': {
    unitPrice: WAN_480P_PER_SECOND,
    unit: 'seconds',
    typicalUnitsPerCall: 5,
  },
};

/** True when this id is priced by the DashScope card rather than by fal. */
export function isDashScopePricedModel(endpointId: string): boolean {
  return dashScopePricingKey(endpointId) in DASHSCOPE_RATE_CARD;
}

/** Per-second advertised estimate, used by pre-flight metadata. */
export function dashScopeDurationCost(
  durationSeconds: number
): Microdollars | null {
  const pricing = DASHSCOPE_RATE_CARD['wan3.0-video'];
  if (!pricing) return null;
  return multiplyMicros(pricing.unitPrice, Math.max(0, durationSeconds));
}
