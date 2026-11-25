/**
 * Composition-root bridge for the self-hosted Node server (#1489).
 *
 * `server-node.ts` is platform infrastructure and must stay domain-blind, but
 * the fal-pricing cron route calls into the billing domain. Keeping the single
 * domain import in an allowlisted composition root preserves the lazy load:
 * the billing module is evaluated only when the route is actually called.
 */
export async function refreshFalPricingForCron(): Promise<void> {
  const { refreshFalPricing } =
    await import('@/billing/server/refresh-fal-pricing');
  await refreshFalPricing();
}
