/**
 * DashScope async video-synthesis submit + poll. Shared by the sequence
 * motion path and the studio path so both stamp and read the same
 * `endpointId` shape (`dashscope:<model>@<workspace baseUrl>`).
 *
 * No SDK: the workspace-scoped Maas endpoint is a plain HTTP API, and the
 * async protocol is two calls (submit with `X-DashScope-Async: enable`, then
 * poll the task). `workersSafeFetch` is used because a bare `fetch` method
 * loses its `this` binding inside workerd.
 *
 * NEVER log the request headers: they carry the Bearer key. Error messages
 * carry only the HTTP status and the provider's `code`/`message`.
 */

import {
  DASHSCOPE_MODEL_ID,
  dashScopeEndpointId,
  dashScopeEndpointParts,
} from '@/models/dashscope';
import { workersSafeFetch } from '@/platform/server/ai/workers-safe-fetch';
import { FAL_REQUEST_TIMEOUT_MS } from '@/models/server/fal-deadline-fetch';
import type { TokenUsage } from '@tanstack/ai';
import { getDashScopeBaseUrl, getDashScopeKey } from './dashscope-config';

type DashScopeMediaType =
  | 'first_frame'
  | 'reference_image'
  | 'reference_video'
  | 'reference_audio';

export type DashScopeMedia = { type: DashScopeMediaType; url: string };

export type DashScopeSubmitOptions = {
  prompt: string;
  duration: number;
  resolution: '480P' | '720P' | '1080P';
  /** `adaptive` follows the first frame / reference images. */
  ratio: string;
  media?: DashScopeMedia[];
  modelId?: string;
};

export type DashScopeSubmitResult = {
  jobId: string;
  endpointId: string;
  usedOwnKey: false;
};

export type DashScopeStatusResult = {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url?: string;
  error?: string;
  // Kept structurally compatible with `VideoJobStatusResult`: the async task
  // reports neither progress nor cost, but workflow callers read both fields.
  progress?: number;
  usage?: TokenUsage;
};

function field(value: unknown, key: string): unknown {
  return value && typeof value === 'object'
    ? Reflect.get(value, key)
    : undefined;
}

function dashScopeError(status: number, body: unknown): string {
  const code = field(body, 'code');
  const message = field(body, 'message');
  const parts = [`HTTP ${status}`];
  if (typeof code === 'string' || typeof code === 'number') {
    parts.push(`code=${String(code)}`);
  }
  if (typeof message === 'string') parts.push(message.slice(0, 400));
  return `DashScope error: ${parts.join(' ')}`;
}

/** Parse a JSON response without ever echoing request headers. */
async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

export async function submitDashScopeVideoJob(
  options: DashScopeSubmitOptions
): Promise<DashScopeSubmitResult> {
  const key = getDashScopeKey();
  const baseUrl = getDashScopeBaseUrl();
  if (!key || !baseUrl) {
    throw new Error(
      'DASHSCOPE_API_KEY and DASHSCOPE_BASE_URL are required for the DashScope video via'
    );
  }
  const modelId = options.modelId ?? DASHSCOPE_MODEL_ID;
  const input: Record<string, unknown> = { prompt: options.prompt };
  if (options.media?.length) input.media = options.media;
  const body = {
    model: modelId,
    input,
    parameters: {
      resolution: options.resolution,
      ratio: options.ratio,
      duration: options.duration,
    },
  };
  const response = await workersSafeFetch(
    `${baseUrl}/services/aigc/video-generation/video-synthesis`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // Async protocol: the response is a task id, not the video.
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FAL_REQUEST_TIMEOUT_MS),
    }
  );
  const parsed = await readJson(response);
  if (!response.ok) throw new Error(dashScopeError(response.status, parsed));
  const output = field(parsed, 'output');
  const taskId = field(output, 'task_id');
  if (typeof taskId !== 'string' || taskId.length === 0) {
    throw new Error('DashScope submit returned no output.task_id');
  }
  return {
    jobId: taskId,
    // Host travels with the stamp; poll must not re-read env for it.
    endpointId: dashScopeEndpointId(modelId, baseUrl),
    usedOwnKey: false,
  };
}

/**
 * Poll a submitted task. `endpointId` is the submission stamp; its embedded
 * base URL is authoritative. The fallback to env is only for legacy stamps
 * written before the host was included.
 */
export async function pollDashScopeVideoJob(
  jobId: string,
  endpointId: string
): Promise<DashScopeStatusResult> {
  const key = getDashScopeKey();
  if (!key) {
    throw new Error(
      `Motion job ${jobId} was submitted to DashScope but no DASHSCOPE_API_KEY is available to poll it`
    );
  }
  const baseUrl =
    dashScopeEndpointParts(endpointId)?.baseUrl ?? getDashScopeBaseUrl();
  if (!baseUrl) {
    throw new Error(
      `DashScope poll has no workspace base URL for job ${jobId}`
    );
  }
  const response = await workersSafeFetch(
    `${baseUrl}/tasks/${encodeURIComponent(jobId)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(FAL_REQUEST_TIMEOUT_MS),
    }
  );
  const parsed = await readJson(response);
  if (!response.ok) throw new Error(dashScopeError(response.status, parsed));

  const output = field(parsed, 'output');
  const rawStatus = field(output, 'task_status') ?? field(output, 'status');
  const status = typeof rawStatus === 'string' ? rawStatus.toUpperCase() : '';
  const rawUrl = field(output, 'video_url');
  const url =
    typeof rawUrl === 'string' && rawUrl.length > 0 ? rawUrl : undefined;
  const rawError = field(output, 'message') ?? field(output, 'error');
  const error =
    typeof rawError === 'string' && rawError.length > 0
      ? rawError.slice(0, 400)
      : undefined;

  switch (status) {
    case 'PENDING':
      return { jobId, status: 'pending' };
    case 'RUNNING':
      return { jobId, status: 'processing' };
    case 'SUCCEEDED':
      if (!url) {
        return {
          jobId,
          status: 'failed',
          error: error ?? 'DashScope task succeeded without a video_url',
        };
      }
      // The URL is valid for ~24h. The workflow uploads it to R2 in the next
      // step; never checkpoint the bytes themselves (1 MiB step.do cap).
      return { jobId, status: 'completed', url };
    case 'FAILED':
    case 'CANCELED':
    // UNKNOWN is a TERMINAL provider verdict, not "keep polling". Mapping it
    // to processing would spin the poll loop forever on a rejected task.
    case 'UNKNOWN':
    default:
      return {
        jobId,
        status: 'failed',
        error:
          error ??
          (status
            ? `DashScope task ended with status ${status}`
            : 'DashScope task returned no status'),
      };
  }
}
