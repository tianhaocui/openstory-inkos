/**
 * Story-mode image-to-video clip generation.
 *
 * The story path is deliberately separate from MotionWorkflow: that workflow
 * writes sequences' `videoVariants` and reads scene/frame state, while a story
 * clip only has a keyframe URL, a shot row and a `storyVideoClips` status row.
 * Everything it needs is snapshotted on the payload by `generateVideoFn`;
 * `scopedDb.credentials` is handed to submit/poll so the key is resolved inside
 * the step that spends it (never serialized into the workflow payload).
 */

import { deductWorkflowCredits } from '@/billing/server/workflow-deduction';
import { micros, ZERO_MICROS } from '@/billing/money';
import { assetLeaseOwner } from '@/models/server/byteplus-asset-pool';
import { ingestArkAssets } from '@/models/server/byteplus-asset-steps';
import {
  arkStillsForMotion,
  motionCostFromUsage,
  pollMotionJob,
  resolveMotionVia,
  submitMotionJob,
} from '@/motion/server/motion-generation';
import {
  uploadVideoFromUrl,
  videoUrlFitsWorkflowCheckpoint,
} from '@/motion/server/video-storage';
import { getLogger } from '@/platform/logger';
import { OpenStoryWorkflowEntrypoint } from '@/platform/server/workflow/base-workflow';
import type { StoryVideoWorkflowInput } from '@/platform/server/workflow/types';
import type { WorkflowScopedDb } from '@/platform/server/db/scoped-workflow';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';

/** Keep batches short so a queued provider job checkpoints its poll position. */
const POLL_BATCH_DURATION_MS = 30_000;
const POLL_INTERVAL_MS = 3_000;
const MAX_BATCHES = 60;

const logger = getLogger(['openstory', 'workflow', 'story-video']);

type PollOutcome =
  | { kind: 'pending' }
  | {
      kind: 'completed';
      url: string;
      usage?: Awaited<ReturnType<typeof pollMotionJob>>['usage'];
    }
  | { kind: 'failed'; error: string };

function nowIso(): string {
  return new Date().toISOString();
}

/** A provider that reports no cost still settles against the preflight hold. */
export function storyVideoBillableMicros(
  reportedMicros: number,
  estimatedMicros: number
) {
  return reportedMicros > Number(ZERO_MICROS)
    ? micros(reportedMicros)
    : micros(estimatedMicros);
}

export class StoryVideoWorkflow extends OpenStoryWorkflowEntrypoint<StoryVideoWorkflowInput> {
  protected override async runImpl(
    event: Readonly<WorkflowEvent<StoryVideoWorkflowInput>>,
    step: WorkflowStep,
    scopedDb: WorkflowScopedDb
  ): Promise<{ clipId: string; videoUrl: string }> {
    const input = event.payload;

    await step.do('mark-generating', async () => {
      await scopedDb.stories.updateVideoClip(input.clipId, {
        status: 'generating',
        startedAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    // The via is resolved from live keys inside the run (the submit step must
    // use the same via as the key that is actually available now). BytePlus
    // needs its still registered before submit — never fall back to a public
    // URL, which is how a throttled ingest once surfaced as a fal error.
    const submitVia = await step.do('resolve-story-video-via', () =>
      resolveMotionVia(input.model, scopedDb.credentials)
    );
    const leaseOwner = assetLeaseOwner('motion', event.instanceId);
    const arkAssets =
      submitVia === 'byteplus'
        ? await ingestArkAssets(step, {
            prefix: `story-video-${input.clipId}`,
            stills: arkStillsForMotion({ imageUrl: input.imageUrl }),
            ledger: scopedDb.bytePlusAssets,
            owner: leaseOwner,
            credentials: scopedDb.credentials,
          })
        : {};

    // The key is resolved HERE (inside the spending step) by submitMotionJob
    // through `scopedDb.credentials` — no key value rides on the payload.
    const job = await step.do('submit-story-video', async () =>
      submitMotionJob({
        imageUrl: input.imageUrl,
        prompt: input.prompt,
        model: input.model,
        duration: input.duration,
        aspectRatio: input.aspectRatio,
        arkAssets,
        scopedDb: scopedDb.credentials,
      })
    );

    let videoUrl: string | undefined;
    let usage: Awaited<ReturnType<typeof pollMotionJob>>['usage'];

    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      if (batch > 0) {
        await step.sleep(`story-video-poll-wait-${batch}`, 1);
      }

      const poll = await step.do(
        `story-video-poll-${batch}`,
        async (): Promise<PollOutcome> => {
          const deadline = Date.now() + POLL_BATCH_DURATION_MS;
          while (Date.now() < deadline) {
            const result = await pollMotionJob(
              job.jobId,
              job.modelKey,
              scopedDb.credentials,
              job.via,
              job.endpointId
            );
            if (result.status === 'completed') {
              return result.url
                ? { kind: 'completed', url: result.url, usage: result.usage }
                : { kind: 'failed', error: 'No video URL returned' };
            }
            if (result.status === 'failed') {
              return {
                kind: 'failed',
                error: result.error ?? 'Video generation failed',
              };
            }
            await new Promise((resolve) =>
              setTimeout(resolve, POLL_INTERVAL_MS)
            );
          }
          return { kind: 'pending' };
        }
      );

      if (poll.kind === 'completed') {
        videoUrl = poll.url;
        usage = poll.usage;
        break;
      }
      if (poll.kind === 'failed') {
        throw new NonRetryableError(poll.error);
      }
    }

    if (!videoUrl) {
      throw new NonRetryableError('Story video job timed out');
    }

    const stored = await step.do('upload-story-video', async () => {
      // A data: MP4 would blow the 1 MiB step checkpoint limit; park it before
      // crossing the boundary instead of silently losing bytes on replay.
      if (!videoUrlFitsWorkflowCheckpoint(videoUrl)) {
        throw new NonRetryableError(
          'Inline video bytes are too large to checkpoint; provider must return a URL'
        );
      }
      return uploadVideoFromUrl(
        videoUrl,
        (extension) =>
          `teams/${input.teamId}/stories/${input.projectId}/${input.clipId}/video.${extension}`
      );
    });

    if (submitVia === 'byteplus') {
      try {
        await step.do('release-story-video-ark-leases', async () => {
          await scopedDb.bytePlusAssets.releaseOwner(leaseOwner);
        });
      } catch (releaseError) {
        // A lease TTL is the backstop; never fail a rendered, paid-for clip
        // because the bookkeeping release could not land.
        logger.error('Failed to release BytePlus leases for story clip', {
          err: releaseError,
        });
      }
    }

    const settled = await step.do('settle-story-video-billing', async () => {
      const priced = await motionCostFromUsage(job.via, usage, {
        modelKey: job.modelKey,
        hasReferenceImages: false,
      });
      const costMicros = storyVideoBillableMicros(
        Number(priced.cost),
        input.estimatedCostMicros
      );
      await deductWorkflowCredits({
        scopedDb,
        costMicros,
        usedOwnKey: job.usedOwnKey,
        description: `Story video clip (${job.modelKey})`,
        idempotencyKey: `${event.instanceId}:story-video`,
        metadata: {
          endpointId: priced.endpointId,
          unitsBilled: priced.unitsBilled,
          modelKey: job.modelKey,
        },
        workflowName: 'StoryVideoGeneration',
        reservationId: input.reservationId,
      });
      return {
        costMicros: Number(costMicros),
        endpointId: priced.endpointId,
        unitsBilled: priced.unitsBilled,
      };
    });

    await step.do('complete-story-video', async () => {
      const completedAt = nowIso();
      await scopedDb.stories.updateVideoClip(input.clipId, {
        videoUrl: stored.url,
        videoPath: stored.path,
        status: 'completed',
        completedAt,
        updatedAt: completedAt,
        generationParams: {
          model: input.model,
          jobId: job.jobId,
          via: job.via,
          endpointId: job.endpointId,
          duration: input.duration,
          billedMicros: settled.costMicros,
        },
      });
      // Same back-link shape as the keyframe path: the shot always points at
      // the clip that last rendered it.
      if (input.shotId) {
        await scopedDb.stories.updateShot(input.shotId, input.projectId, {
          videoClipId: input.clipId,
          updatedAt: completedAt,
        });
      }
    });

    return { clipId: input.clipId, videoUrl: stored.url };
  }

  protected override async onFailure({
    event,
    error,
    scopedDb,
  }: {
    event: Readonly<WorkflowEvent<StoryVideoWorkflowInput>>;
    error: string;
    scopedDb: WorkflowScopedDb;
  }): Promise<void> {
    // The base class zeroes an owned reservation before calling this hook.
    try {
      await scopedDb.bytePlusAssets.releaseOwner(
        assetLeaseOwner('motion', event.instanceId)
      );
    } catch (releaseError) {
      logger.error('Failed to release BytePlus leases after story failure', {
        err: releaseError,
      });
    }
    await scopedDb.stories.updateVideoClip(event.payload.clipId, {
      status: 'failed',
      errorMessage: error,
      updatedAt: nowIso(),
    });
  }
}
