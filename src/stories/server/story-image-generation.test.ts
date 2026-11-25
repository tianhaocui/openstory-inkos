import { describe, expect, it, vi } from 'vitest';
import { generateAndStoreStoryImage } from './story-image-generation';
import type { CredentialScopedDb } from '@/platform/server/db/scoped-workflow';
import type { ImageGenerationResult } from '@/stills/server/image-generation';

const credentials: CredentialScopedDb = {
  userId: 'user-1',
  resolveKey: async () => ({ key: 'test-key', source: 'team' }),
  resolveOptionalKey: async () => undefined,
};

describe('generateAndStoreStoryImage', () => {
  it('passes story settings and references to the provider and stores the result', async () => {
    const generate = vi.fn().mockResolvedValue({
      imageUrls: ['https://provider.example/image.png'],
      parameters: {},
      generatedAt: '2026-09-20T00:00:00.000Z',
      processingTimeMs: 42,
      via: 'fal',
      metadata: {
        prompt: 'A cinematic close-up',
        model: 'gpt_image_2',
        endpointId: 'openai/gpt-image-2.5/flare/text-to-image',
        dimensions: [{ width: 0, height: 0 }],
        file_sizes: [0],
        usedOwnKey: true,
      },
    });
    const store = vi.fn(
      async (_url: string, buildPath: (extension: string) => string) => ({
        url: '/r2/thumbnails/story.png',
        path: buildPath('png'),
        contentType: 'image/png',
      })
    );

    const result = await generateAndStoreStoryImage(
      {
        teamId: 'team-1',
        userId: 'user-1',
        projectId: 'project-1',
        recordId: 'keyframe-1',
        kind: 'keyframes',
        model: 'gpt_image_2',
        prompt: 'A cinematic close-up',
        aspectRatio: '9:16',
        referenceImageUrls: ['/r2/thumbnails/reference.png'],
        credentials,
      },
      { generate, store, createId: () => 'image-1' }
    );

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt_image_2',
        prompt: 'A cinematic close-up',
        imageSize: 'portrait_16_9',
        numImages: 1,
        outputFormat: 'png',
        referenceImageUrls: ['/r2/thumbnails/reference.png'],
      }),
      expect.objectContaining({
        observability: expect.objectContaining({
          userId: 'user-1',
          tags: ['stories', 'keyframes'],
        }),
      })
    );
    expect(store).toHaveBeenCalledWith(
      'https://provider.example/image.png',
      expect.any(Function)
    );
    expect(result).toEqual(
      expect.objectContaining({
        url: '/r2/thumbnails/story.png',
        path: 'teams/team-1/stories/project-1/keyframes/keyframe-1/image-1.png',
        via: 'fal',
      })
    );
  });

  it('does not persist when the provider returns no image', async () => {
    const store = vi.fn();

    await expect(
      generateAndStoreStoryImage(
        {
          teamId: 'team-1',
          userId: 'user-1',
          projectId: 'project-1',
          recordId: 'keyframe-1',
          kind: 'keyframes',
          model: 'gpt_image_2',
          prompt: 'A cinematic close-up',
          aspectRatio: '16:9',
          credentials,
        },
        {
          generate: vi.fn().mockResolvedValue({
            imageUrls: [],
            parameters: {
              model: 'gpt_image_2',
              prompt: 'A cinematic close-up',
            },
            generatedAt: '2026-09-20T00:00:00.000Z',
            processingTimeMs: 42,
            via: 'fal',
            metadata: {
              prompt: 'A cinematic close-up',
              model: 'gpt_image_2',
              endpointId: 'openai/gpt-image-2.5/flare/text-to-image',
              dimensions: [],
              file_sizes: [],
              usedOwnKey: true,
            },
          } satisfies ImageGenerationResult),
          store,
          createId: () => 'image-1',
        }
      )
    ).rejects.toThrow('Image provider returned no image');
    expect(store).not.toHaveBeenCalled();
  });
});
