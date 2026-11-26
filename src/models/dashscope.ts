/**
 * DashScope (Alibaba Model Studio) video catalog facts shared by client and
 * server code. No env access here — the server half lives in
 * `server/dashscope-config.ts`.
 *
 * The submitted `endpointId` deliberately carries the workspace host. A poll
 * only reads the stamp: re-resolving the host from live env can send a job id
 * to a different workspace than the one that issued it.
 */

export const DASHSCOPE_MODEL_ID = 'wan3.0-video';

export type DashScopeResolution = '480P' | '720P' | '1080P';

/**
 * App resolution tier → DashScope's spelled token. Wan has no 4K tier, so a
 * 4K ask is served at 1080P rather than rejected (same shape as the fal
 * resolution picker). Absent → 480P, the cheapest tier and the one used by the
 * minimal async probe.
 */
export function dashScopeResolution(
  resolution: string | undefined
): DashScopeResolution {
  switch (resolution) {
    case '720p':
    case '720P':
      return '720P';
    case '1080p':
    case '1080P':
    case '4k':
      return '1080P';
    default:
      return '480P';
  }
}

const ENDPOINT_PREFIX = 'dashscope:';

/** Host-free id used by pricing and estimation (which cannot read env). */
export function dashScopeBaseEndpointId(modelId: string): string {
  return `${ENDPOINT_PREFIX}${modelId}`;
}

/** Stable pricing key + durable host stamp, in one string. */
export function dashScopeEndpointId(modelId: string, baseUrl: string): string {
  return `${dashScopeBaseEndpointId(modelId)}@${baseUrl}`;
}

export function dashScopeEndpointParts(
  endpointId: string
): { modelId: string; baseUrl?: string } | undefined {
  if (!endpointId.startsWith(ENDPOINT_PREFIX)) return undefined;
  const rest = endpointId.slice(ENDPOINT_PREFIX.length);
  const at = rest.indexOf('@');
  const modelId = at === -1 ? rest : rest.slice(0, at);
  const baseUrl = at === -1 ? undefined : rest.slice(at + 1);
  if (!modelId) return undefined;
  return { modelId, ...(baseUrl && { baseUrl }) };
}

/**
 * Key used by the static pricing card and `model_usage` exclusion. Works for
 * both a bare catalog id (`wan3.0-video`, what estimators resolve) and a
 * stamped endpoint id (`dashscope:wan3.0-video@https://…`).
 */
export function dashScopePricingKey(endpointId: string): string {
  return dashScopeEndpointParts(endpointId)?.modelId ?? endpointId;
}
