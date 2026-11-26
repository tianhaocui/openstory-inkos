/**
 * Single source of truth for the self-hosted / custom OpenAI-compatible AI
 * endpoint (`AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL`).
 *
 * This is a platform fallback for LLM calls (and the story/film direct Chat
 * Completions path) — it is env-only, never a team BYOK row and never a
 * Settings-page provider. Reading it through `getEnv()` (not `process.env`)
 * is load-bearing: in Cloudflare Workers the secret lives on `env`, and
 * `process.env` does not see it.
 *
 * The base URL is operator-controlled config, not a caller-supplied URL, but
 * it still must not be able to silently downgrade to plaintext or smuggle
 * credentials in userinfo. `http://` is allowed only for loopback hosts so
 * e2e can point at aimock.
 */

import { getEnv } from '#env';

const DEFAULT_CUSTOM_AI_BASE_URL =
  'https://kiro.dakalami.com/aiclient2api/claude-kiro-oauth/v1';
const DEFAULT_CUSTOM_AI_MODEL = 'claude-opus-4-6';
const DEFAULT_CUSTOM_AI_MAX_TOKENS = 8192;

export type CustomAiConfig = {
  baseUrl: string;
  apiKey: string | undefined;
  /** Registry-independent wire name — the adapter sends this verbatim. */
  model: string;
  maxTokens: number;
};

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1'
  );
}

/** Reject non-HTTPS endpoints and URLs carrying userinfo. Loopback HTTP is
 *  the e2e hook (aimock), mirroring the other native `*_BASE_URL` overrides. */
function assertCustomAiBaseUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`AI_BASE_URL is not a valid URL: '${raw}'`);
  }
  if (url.username || url.password) {
    throw new Error('AI_BASE_URL must not contain credentials in userinfo');
  }
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && isLoopbackHost(url.hostname))
  ) {
    throw new Error(
      `AI_BASE_URL must use https (http is allowed only for loopback hosts): '${raw}'`
    );
  }
}

export function getCustomAiConfig(): CustomAiConfig {
  const env = getEnv();
  const baseUrl = env.AI_BASE_URL || DEFAULT_CUSTOM_AI_BASE_URL;
  assertCustomAiBaseUrl(baseUrl);
  return {
    baseUrl,
    apiKey: env.AI_API_KEY || undefined,
    model: env.AI_MODEL || DEFAULT_CUSTOM_AI_MODEL,
    maxTokens: DEFAULT_CUSTOM_AI_MAX_TOKENS,
  };
}
