import { describe, expect, test } from 'vitest';
import { getCfBindingForTriggerPath } from '@/platform/server/workflow/trigger-bindings';
import type { CloudflareEnv } from '@/platform/server/workflow/types';
import { isStoryVideoInFlight } from './ai-filmmaking.fn';
import { storyVideoBillableMicros } from './server/workflows/story-video-workflow';

describe('story-video trigger binding', () => {
  test('resolves STORY_VIDEO_WORKFLOW instead of throwing missing-binding', () => {
    const binding = { create: async () => ({ id: 'stub-run' }) };
    const env = { STORY_VIDEO_WORKFLOW: binding };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test stub supplies only the binding under test
    const cfEnv = env as unknown as CloudflareEnv;
    const resolved = getCfBindingForTriggerPath('/story-video', cfEnv);
    expect(resolved).toBe(binding);
  });
});

describe('story video in-flight guard', () => {
  test('queued work is never charged or queued twice', () => {
    expect(isStoryVideoInFlight('pending')).toBe(true);
    expect(isStoryVideoInFlight('queued')).toBe(true);
    expect(isStoryVideoInFlight('generating')).toBe(true);
  });

  test('terminal clips are eligible for a fresh attempt', () => {
    expect(isStoryVideoInFlight('completed')).toBe(false);
    expect(isStoryVideoInFlight('failed')).toBe(false);
    expect(isStoryVideoInFlight('approved')).toBe(false);
  });
});

describe('story video settlement floor', () => {
  test('uses reported usage when the provider bills it', () => {
    expect(storyVideoBillableMicros(42_000, 30_000)).toBe(42_000);
  });

  test('never settles a $0 generation', () => {
    expect(storyVideoBillableMicros(0, 30_000)).toBe(30_000);
    expect(storyVideoBillableMicros(-1, 30_000)).toBe(30_000);
  });
});
