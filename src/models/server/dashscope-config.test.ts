import { beforeEach, describe, expect, it, vi } from 'vitest';

const env: Record<string, string | undefined> = {};

vi.doMock('#env', () => ({ getEnv: () => env }));

const {
  claimDashScopeVia,
  getDashScopeBaseUrl,
  getDashScopeKey,
  isDashScopeConfigured,
} = await import('./dashscope-config');

describe('DashScope config', () => {
  beforeEach(() => {
    for (const key of Object.keys(env)) delete env[key];
  });

  it('is off with no key and treats an empty key as absent', () => {
    expect(isDashScopeConfigured()).toBe(false);
    expect(getDashScopeKey()).toBeUndefined();
    env.DASHSCOPE_API_KEY = '';
    expect(isDashScopeConfigured()).toBe(false);
  });

  it('is on with a platform key and exposes the workspace URL', () => {
    env.DASHSCOPE_API_KEY = 'ds-test';
    env.DASHSCOPE_BASE_URL = 'https://example.maas.aliyuncs.com/api/v1';
    expect(isDashScopeConfigured()).toBe(true);
    expect(getDashScopeKey()).toBe('ds-test');
    expect(getDashScopeBaseUrl()).toBe(
      'https://example.maas.aliyuncs.com/api/v1'
    );
  });

  // Playwright forwards the developer's .env.local into the worker; a laptop
  // key must never bill a replay run.
  it('is off under E2E_TEST without a wired base URL', () => {
    env.DASHSCOPE_API_KEY = 'ds-test';
    env.E2E_TEST = 'true';
    expect(isDashScopeConfigured()).toBe(false);
  });

  it('is still off under E2E_TEST with a base URL but no record flag', () => {
    env.DASHSCOPE_API_KEY = 'ds-test';
    env.E2E_TEST = 'true';
    env.DASHSCOPE_BASE_URL = 'https://example.maas.aliyuncs.com/api/v1';
    expect(isDashScopeConfigured()).toBe(false);
  });

  it('allows the route only in e2e record mode', () => {
    env.DASHSCOPE_API_KEY = 'ds-test';
    env.E2E_TEST = 'true';
    env.E2E_RECORD = '1';
    env.DASHSCOPE_BASE_URL = 'https://example.maas.aliyuncs.com/api/v1';
    expect(isDashScopeConfigured()).toBe(true);
  });
});

describe('claimDashScopeVia', () => {
  beforeEach(() => {
    for (const key of Object.keys(env)) delete env[key];
  });

  it('returns fal for a non-native model or a team on its own fal key', () => {
    expect(claimDashScopeVia({ native: false, usingOwnFalKey: false })).toBe(
      'fal'
    );
    env.DASHSCOPE_API_KEY = 'ds-test';
    expect(claimDashScopeVia({ native: true, usingOwnFalKey: true })).toBe(
      'fal'
    );
  });

  it('claims dashscope only for a native model with a live platform key', () => {
    expect(claimDashScopeVia({ native: true, usingOwnFalKey: false })).toBe(
      'fal'
    );
    env.DASHSCOPE_API_KEY = 'ds-test';
    expect(claimDashScopeVia({ native: true, usingOwnFalKey: false })).toBe(
      'dashscope'
    );
  });
});
