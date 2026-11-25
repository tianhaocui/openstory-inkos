import type { AspectRatio } from '@/models/aspect-ratios';
import type { TextToImageModel } from '@/models/models';
import type { CredentialScopedDb } from '@/platform/server/db/scoped-workflow';
import { generateId } from '@/platform/id';
import {
  generateImageWithProvider,
  type ImageGenerationResult,
} from '@/stills/server/image-generation';
import { uploadImageFromUrl } from '@/stills/server/image-storage';
import { aspectRatioToImageSize } from '@/models/aspect-ratios';

type StoryImageKind = 'assets' | 'keyframes';

export type StoryImageGenerationInput = {
  teamId: string;
  userId: string;
  projectId: string;
  recordId: string;
  kind: StoryImageKind;
  model: TextToImageModel;
  prompt: string;
  aspectRatio: AspectRatio;
  referenceImageUrls?: string[];
  credentials: CredentialScopedDb;
};

type StoredImage = {
  url: string;
  path: string;
  contentType: string;
};

type StoryImageDependencies = {
  generate: typeof generateImageWithProvider;
  store: (
    imageUrl: string,
    buildPath: (extension: string) => string
  ) => Promise<StoredImage>;
  createId: () => string;
};

const defaultDependencies: StoryImageDependencies = {
  generate: generateImageWithProvider,
  store: uploadImageFromUrl,
  createId: generateId,
};

export type StoredStoryImage = StoredImage & {
  metadata: ImageGenerationResult['metadata'];
  via: ImageGenerationResult['via'];
};

/** Generate and permanently store a story image before returning its metadata. */
export async function generateAndStoreStoryImage(
  input: StoryImageGenerationInput,
  dependencies: StoryImageDependencies = defaultDependencies
): Promise<StoredStoryImage> {
  const generation = await dependencies.generate(
    {
      model: input.model,
      prompt: input.prompt,
      imageSize: aspectRatioToImageSize(input.aspectRatio),
      numImages: 1,
      outputFormat: 'png',
      referenceImageUrls: input.referenceImageUrls,
    },
    {
      scopedDb: input.credentials,
      observability: {
        userId: input.userId,
        tags: ['stories', input.kind],
        metadata: {
          projectId: input.projectId,
          recordId: input.recordId,
        },
      },
    }
  );

  const generatedUrl = generation.imageUrls[0];
  if (!generatedUrl) {
    throw new Error('Image provider returned no image');
  }

  const stored = await dependencies.store(generatedUrl, (extension) =>
    [
      'teams',
      input.teamId,
      'stories',
      input.projectId,
      input.kind,
      input.recordId,
      `${dependencies.createId()}.${extension}`,
    ].join('/')
  );

  return {
    ...stored,
    metadata: generation.metadata,
    via: generation.via,
  };
}
