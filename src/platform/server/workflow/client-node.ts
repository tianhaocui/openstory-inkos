/**
 * Workflow Client — Node / self-hosted context.
 *
 * Replaces the Cloudflare-specific triggerWorkflow with BullMQ-based implementation.
 * Maintains the same API surface for compatibility with existing code.
 */

import { createWorkflowBinding } from './workflow-node';
import {
  assertCanGenerate,
  assertCanWrite,
  resolveEnforcementState,
  type EnforcementRow,
} from '@/platform/server/compliance/enforcement';
import { loadComplianceRecords } from '@/platform/server/db/scoped';
import { getLogger } from '@/platform/logger';

const logger = getLogger(['openstory', 'workflow', 'client-node']);

/**
 * Maps trigger paths to workflow names.
 * Mirrors the Cloudflare bindings but uses BullMQ queues instead.
 */
const TRIGGER_TO_WORKFLOW: Record<string, string> = {
  image: 'image-workflow',
  'element-vision': 'element-vision-workflow',
  'element-sheet': 'element-sheet-workflow',
  music: 'music-workflow',
  motion: 'motion-workflow',
  'motion-batch': 'motion-batch-workflow',
  'character-sheet': 'character-sheet-workflow',
  'character-voice': 'character-voice-workflow',
  'dialogue-audio': 'dialogue-audio-workflow',
  'location-sheet': 'location-sheet-workflow',
  'library-talent-sheet': 'library-talent-sheet-workflow',
  'library-location-sheet': 'library-location-sheet-workflow',
  'variant-image': 'shot-variant-workflow',
  'upscale-variant': 'upscale-shot-variant-workflow',
  'frame-prompt': 'frame-prompt-workflow',
  'motion-prompt': 'motion-prompt-workflow',
  'music-prompt': 'music-prompt-workflow',
  'recast-character': 'recast-character-workflow',
  'location-matching': 'location-matching-workflow',
  'shot-images': 'shot-images-workflow',
  'talent-matching': 'talent-matching-workflow',
  'character-sheet-from-bible': 'character-bible-workflow',
  'location-sheet-from-bible': 'location-bible-workflow',
  'frame-prompts-batch': 'frame-prompt-batch-workflow',
  'motion-prompts-batch': 'motion-prompt-batch-workflow',
  'motion-music-prompts': 'motion-music-prompts-workflow',
  'regenerate-shots': 'regenerate-shots-workflow',
  'update-stale-shots': 'update-stale-shots-workflow',
  'recast-location': 'recast-location-workflow',
  'replace-element': 'replace-element-workflow',
  'scene-split': 'scene-split-workflow',
  storyboard: 'storyboard-workflow',
  'analyze-script': 'analyze-script-workflow',
  'sequence-export': 'sequence-export-workflow',
  asset: 'asset-workflow',
  studio: 'studio-workflow',
};

/**
 * Triggers that produce nothing new and so survive a generation pause.
 */
const WRITE_ONLY_TRIGGERS = new Set(['sequence-export']);

/**
 * Build a deterministic instance ID from workflow name and optional dedup key.
 */
function buildInstanceId(
  workflowName: string,
  deduplicationId?: string,
  generation = 1
): string {
  const env = process.env.NODE_ENV === 'production' ? 'prd' : 'dev';
  const suffix = deduplicationId || `${Date.now()}-${crypto.randomUUID()}`;
  const genSuffix = generation > 1 ? `_g${generation}` : '';
  return `${env}_${workflowName}_${suffix}${genSuffix}`;
}

/**
 * Normalize trigger path (strip leading slash).
 */
function normalizeTriggerPath(triggerPath: string): string {
  return triggerPath.startsWith('/') ? triggerPath.slice(1) : triggerPath;
}

/**
 * Check if error is an "instance already exists" error.
 */
function isInstanceAlreadyExistsError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('instance.already_exists') ||
      ('code' in error && error.code === 'instance.already_exists')
    );
  }
  return false;
}

/**
 * Refuse to start durable work for a restricted account.
 */
async function assertTriggerAllowed(
  urlPath: string,
  body: { userId: string; teamId: string },
  enforcementRows?: readonly EnforcementRow[]
): Promise<void> {
  const enforcement =
    enforcementRows ??
    (await loadComplianceRecords(body.userId, body.teamId)).enforcement;
  const state = resolveEnforcementState(enforcement);
  const key = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  if (WRITE_ONLY_TRIGGERS.has(key)) {
    assertCanWrite(state);
    return;
  }
  assertCanGenerate(state);
}

/**
 * Reusable instance statuses — matches CF implementation.
 */
const REUSABLE_INSTANCE_STATUSES = new Set([
  'queued',
  'running',
  'paused',
  'waiting',
  'waitingForPause',
  'complete',
]);

const MAX_TRIGGER_GENERATIONS = 3;

/**
 * Trigger a durable workflow.
 *
 * Every workflow runs on BullMQ: this resolves the queue for `urlPath`
 * and adds a job. Returns the workflow instance id (persisted as
 * `workflowRunId` on the relevant DB row).
 */
export async function triggerWorkflow<
  T extends { userId: string; teamId: string },
>(
  urlPath: string,
  body: T,
  options?: {
    deduplicationId?: string;
    enforcement?: readonly EnforcementRow[];
  }
): Promise<string> {
  logger.info('[TriggerWorkflow]', { url: urlPath, body, options });

  // Enforcement backstop
  await assertTriggerAllowed(urlPath, body, options?.enforcement);

  // E2E mock mode
  const env = process.env;
  if (env.E2E_TEST === 'true' && env.E2E_FULL_PIPELINE !== 'true') {
    const mockId = options?.deduplicationId ?? `mock-${Date.now()}`;
    logger.info(`Skipping workflow trigger: ${urlPath} (mock ID: ${mockId})`);
    return mockId;
  }

  const key = normalizeTriggerPath(urlPath);
  const workflowName = TRIGGER_TO_WORKFLOW[key];
  if (!workflowName) {
    throw new Error(
      `[triggerWorkflow] no workflow mapped for trigger path '${key}'. Add it to TRIGGER_TO_WORKFLOW.`
    );
  }

  const binding = createWorkflowBinding(workflowName);

  // Without deduplication, create with random ID
  if (!options?.deduplicationId) {
    const instance = await binding.create({
      id: buildInstanceId(workflowName),
      params: body,
    });
    logger.info('[TriggerWorkflow] Response', { workflowRunId: instance.id });
    return instance.id;
  }

  // With deduplication, try multiple generations on conflict
  let lastError: unknown;
  for (
    let generation = 1;
    generation <= MAX_TRIGGER_GENERATIONS;
    generation++
  ) {
    const id = buildInstanceId(
      workflowName,
      options.deduplicationId,
      generation
    );

    try {
      const instance = await binding.create({ id, params: body });
      logger.info('[TriggerWorkflow] Response', { workflowRunId: instance.id });
      return instance.id;
    } catch (error) {
      if (!isInstanceAlreadyExistsError(error)) throw error;
      lastError = error;

      // Check existing instance status
      try {
        const existingInstance = await binding.get(id);
        const status = await existingInstance.status();

        if (REUSABLE_INSTANCE_STATUSES.has(status.status)) {
          logger.info(
            `[triggerWorkflow] ${id} already exists (${status.status}); reusing existing instance`
          );
          return id;
        }

        if (status.status !== 'errored') {
          logger.warn(
            `[triggerWorkflow] ${id} already exists but is not reusable (status: ${status.status}); rethrowing`
          );
          throw error;
        }

        logger.warn(
          `[triggerWorkflow] ${id} already exists and errored; advancing to generation ${generation + 1}`
        );
      } catch (statusError) {
        // If we can't get status, rethrow original error
        if (!isInstanceAlreadyExistsError(statusError)) {
          throw error;
        }
      }
    }
  }

  throw new Error(
    `[triggerWorkflow] '${workflowName}' exhausted ${MAX_TRIGGER_GENERATIONS} instance generations for deduplication id '${options.deduplicationId}' — every one errored`,
    { cause: lastError }
  );
}

/**
 * Get the workflow name from a run ID.
 */
export function workflowNameFromRunId(runId: string): string | null {
  const segments = runId.split('_');
  // Try segment[1] first (top-level), then segment[0] (child)
  for (const segment of [segments[1], segments[0]]) {
    if (segment) {
      // Check if it matches a workflow name pattern
      for (const [trigger, workflow] of Object.entries(TRIGGER_TO_WORKFLOW)) {
        if (workflow.startsWith(segment) || segment === trigger) {
          return workflow;
        }
      }
    }
  }
  return null;
}
