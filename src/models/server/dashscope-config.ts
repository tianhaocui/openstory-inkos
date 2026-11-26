/**
 * DashScope (Alibaba Model Studio / 百炼) env — the native via for Wan video.
 *
 * Platform key only: there is no team BYOK row and no Settings page for it
 * (same shape as ElevenLabs / Ark). A team on its own fal key stays on fal —
 * routing their job onto our DashScope account would bill us for it.
 *
 * The via is claimed at submit and STAMPED on the job; poll and billing only
 * read the stamp. `DASHSCOPE_BASE_URL` is a non-secret var (it is the workspace
 * host, in wrangler.jsonc), but the key is a Worker secret.
 */

import { getEnv } from '#env';
import type { MediaVia } from '@/models/via';

function optionalEnv(name: string): string | undefined {
  const value = Reflect.get(getEnv(), name);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** The platform DashScope key, or undefined when not configured. */
export function getDashScopeKey(): string | undefined {
  return optionalEnv('DASHSCOPE_API_KEY');
}

/** Workspace base URL, e.g. `https://<workspace>.cn-beijing.maas.aliyuncs.com/api/v1`. */
export function getDashScopeBaseUrl(): string | undefined {
  return optionalEnv('DASHSCOPE_BASE_URL');
}

/**
 * True when the platform can submit to DashScope at all.
 *
 * E2E is hermetic: Playwright forwards the developer's `.env.local` into the
 * worker (`CLOUDFLARE_INCLUDE_PROCESS_ENV`), so a laptop key could silently
 * bill a replay run. The via therefore stays OFF under `E2E_TEST` unless a
 * base URL is wired — and even then only in record mode, which is the run
 * that is allowed to talk to real providers.
 */
export function isDashScopeConfigured(): boolean {
  if (!getDashScopeKey()) return false;
  const env = getEnv();
  if (env.E2E_TEST === 'true' && !getDashScopeBaseUrl()) return false;
  if (env.E2E_TEST === 'true' && env.E2E_RECORD !== '1') return false;
  return true;
}

/**
 * After xAI / Google / BytePlus have been ruled out, claim DashScope for a
 * native model when the platform key is live and the team is not on its own
 * fal key; otherwise fall back to fal.
 */
export function claimDashScopeVia(options: {
  native: boolean;
  usingOwnFalKey: boolean;
}): Extract<MediaVia, 'dashscope' | 'fal'> {
  if (!options.native) return 'fal';
  if (options.usingOwnFalKey) return 'fal';
  return isDashScopeConfigured() ? 'dashscope' : 'fal';
}
