import { beforeEach, describe, expect, it, vi } from 'vitest';

const env: Record<string, string | undefined> = {};
const fetchMock =
  vi.fn<(input: string, init?: RequestInit) => Promise<unknown>>();

vi.doMock('#env', () => ({ getEnv: () => env }));
vi.doMock('@/platform/server/ai/workers-safe-fetch', () => ({
  workersSafeFetch: fetchMock,
}));

const { pollDashScopeVideoJob, submitDashScopeVideoJob } =
  await import('./dashscope-video');

const BASE = 'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1';
const KEY = 'ds-secret-test-value';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function lastCall() {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('no fetch call recorded');
  return call;
}

function requestUrl(): string {
  return lastCall()[0];
}

function requestInit(): RequestInit {
  return lastCall()[1] ?? {};
}

function sentBody(): Record<string, unknown> {
  const body = requestInit().body;
  if (typeof body !== 'string') throw new Error('expected a JSON string body');
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- the test always sends a JSON object
  return JSON.parse(body) as Record<string, unknown>;
}

describe('submitDashScopeVideoJob', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    for (const key of Object.keys(env)) delete env[key];
    env.DASHSCOPE_API_KEY = KEY;
    env.DASHSCOPE_BASE_URL = BASE;
  });

  it('posts the async protocol and stamps the host in endpointId', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ output: { task_id: 'task-1' } })
    );
    const result = await submitDashScopeVideoJob({
      prompt: 'a red fox in morning fog',
      duration: 5,
      resolution: '480P',
      ratio: 'adaptive',
    });
    expect(result.jobId).toBe('task-1');
    expect(result.endpointId).toBe(`dashscope:wan3.0-video@${BASE}`);
    expect(requestUrl()).toBe(
      `${BASE}/services/aigc/video-generation/video-synthesis`
    );
    const init = requestInit();
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('X-DashScope-Async')).toBe('enable');
    expect(headers.get('Authorization')).toBe(`Bearer ${KEY}`);
    expect(sentBody()).toMatchObject({
      model: 'wan3.0-video',
      input: { prompt: 'a red fox in morning fog' },
      parameters: { resolution: '480P', ratio: 'adaptive', duration: 5 },
    });
  });

  it('passes through reference media roles', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ output: { task_id: 'task-2' } })
    );
    // The submit helper sends exactly what the caller chose; the Wan mix-ban
    // (first_frame vs reference_*) is enforced by motion/studio before here.
    await submitDashScopeVideoJob({
      prompt: 'two characters talk',
      duration: 5,
      resolution: '480P',
      ratio: 'adaptive',
      media: [
        { type: 'reference_image', url: 'https://example.com/a.png' },
        { type: 'reference_audio', url: 'https://example.com/b.wav' },
      ],
    });
    expect(sentBody().input).toMatchObject({
      media: [
        { type: 'reference_image', url: 'https://example.com/a.png' },
        { type: 'reference_audio', url: 'https://example.com/b.wav' },
      ],
    });
  });

  it('throws without a key and never leaks it in an error', async () => {
    env.DASHSCOPE_API_KEY = undefined;
    await expect(
      submitDashScopeVideoJob({
        prompt: 'x',
        duration: 5,
        resolution: '480P',
        ratio: 'adaptive',
      })
    ).rejects.toThrow(/DASHSCOPE_API_KEY/);
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 'InvalidApiKey', message: 'bad' }, 401)
    );
    env.DASHSCOPE_API_KEY = KEY;
    const error = await submitDashScopeVideoJob({
      prompt: 'x',
      duration: 5,
      resolution: '480P',
      ratio: 'adaptive',
    }).catch((e: unknown) => e);
    expect(String(error)).not.toContain(KEY);
  });
});

describe('pollDashScopeVideoJob', () => {
  const endpointId = `dashscope:wan3.0-video@${BASE}`;

  beforeEach(() => {
    fetchMock.mockReset();
    for (const key of Object.keys(env)) delete env[key];
    env.DASHSCOPE_API_KEY = KEY;
    env.DASHSCOPE_BASE_URL = 'https://wrong.example/api/v1';
  });

  it.each([
    ['PENDING', 'pending'],
    ['RUNNING', 'processing'],
  ] as const)('maps %s to %s', async (raw, expected) => {
    fetchMock.mockResolvedValue(
      jsonResponse({ output: { task_id: 't', task_status: raw } })
    );
    const result = await pollDashScopeVideoJob('t', endpointId);
    expect(result.status).toBe(expected);
    expect(result.url).toBeUndefined();
  });

  it('maps SUCCEEDED to completed with the 24h video URL', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        output: {
          task_id: 't',
          task_status: 'SUCCEEDED',
          video_url: 'https://example.com/video.mp4',
        },
      })
    );
    const result = await pollDashScopeVideoJob('t', endpointId);
    expect(result).toMatchObject({
      jobId: 't',
      status: 'completed',
      url: 'https://example.com/video.mp4',
    });
  });

  it.each(['FAILED', 'CANCELED', 'UNKNOWN', 'GARBAGE'] as const)(
    'treats %s as a TERMINAL failure (never processing)',
    async (raw) => {
      fetchMock.mockResolvedValue(
        jsonResponse({ output: { task_id: 't', task_status: raw } })
      );
      const result = await pollDashScopeVideoJob('t', endpointId);
      expect(result.status).toBe('failed');
      expect(result.error).toContain(raw);
    }
  );

  it('reads the host from the stamp, not from live env', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ output: { task_status: 'RUNNING' } })
    );
    await pollDashScopeVideoJob('t', endpointId);
    expect(requestUrl()).toBe(`${BASE}/tasks/t`);
    expect(requestUrl()).not.toContain('wrong.example');
  });

  it('reports HTTP errors without echoing the key', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 'Forbidden', message: 'denied' }, 403)
    );
    const error = await pollDashScopeVideoJob('t', endpointId).catch(
      (e: unknown) => e
    );
    expect(String(error)).toContain('403');
    expect(String(error)).not.toContain(KEY);
  });
});
