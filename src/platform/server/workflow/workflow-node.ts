/**
 * BullMQ-based Workflow System — Node / self-hosted context.
 *
 * Replaces Cloudflare Workflows with BullMQ for self-hosted deployments.
 * Provides the same API surface as the CF Workflows system.
 *
 * Configuration via environment variables:
 *   - REDIS_URL: Redis connection string (default: redis://localhost:6379)
 *   - WORKFLOW_CONCURRENCY: Number of concurrent workers per workflow (default: 5)
 */

import { Queue, Worker, Job, type ConnectionOptions } from 'bullmq';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getLogger } from '@/platform/logger';

const logger = getLogger(['openstory', 'workflow', 'node']);

// ---------------------------------------------------------------------------
// Types matching Cloudflare Workflows API
// ---------------------------------------------------------------------------

export type InstanceStatus = {
  status:
    | 'queued'
    | 'running'
    | 'paused'
    | 'waiting'
    | 'waitingForPause'
    | 'complete'
    | 'errored'
    | 'terminated'
    | 'unknown';
  error?: string;
  output?: unknown;
};

const instanceStatusSchema = z.object({
  status: z.enum([
    'queued',
    'running',
    'paused',
    'waiting',
    'waitingForPause',
    'complete',
    'errored',
    'terminated',
    'unknown',
  ]),
  error: z.string().optional(),
  output: z.unknown().optional(),
});

class InstanceAlreadyExistsError extends Error {
  readonly code = 'instance.already_exists';
}

export interface WorkflowEvent<T> {
  payload: T;
  instanceId: string;
  timestamp: Date;
}

export interface WorkflowStep {
  /**
   * Execute a named step with automatic retry and durability.
   */
  do<T>(name: string, fn: () => Promise<T> | T): Promise<T>;

  /**
   * Sleep for a duration. Survives process restarts.
   */
  sleep(name: string, duration: string | number): Promise<void>;

  /**
   * Wait for an external event by type.
   */
  waitForEvent<T = unknown>(
    name: string,
    options: { type: string; timeout?: string | number }
  ): Promise<{ payload: T } | null>;
}

export interface WorkflowInstance {
  id: string;
  status(): Promise<InstanceStatus>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  terminate(): Promise<void>;
  sendEvent(event: { type: string; payload?: unknown }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Redis connection
// ---------------------------------------------------------------------------

let redisConnection: ConnectionOptions | undefined;

function getRedisConnection(): ConnectionOptions {
  if (redisConnection) return redisConnection;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const url = new URL(redisUrl);

  redisConnection = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    username: url.username || undefined,
    db: url.pathname ? parseInt(url.pathname.slice(1), 10) : 0,
  };

  return redisConnection;
}

// ---------------------------------------------------------------------------
// Workflow Registry
// ---------------------------------------------------------------------------

type WorkflowHandler<T> = (
  event: WorkflowEvent<T>,
  step: WorkflowStep
) => Promise<unknown>;

interface WorkflowRegistration<T = unknown> {
  name: string;
  handler: WorkflowHandler<T>;
  queue: Queue;
  worker?: Worker;
}

const workflowRegistry = new Map<string, WorkflowRegistration>();
const instanceEvents = new EventEmitter();
instanceEvents.setMaxListeners(1000); // Support many concurrent workflows

// ---------------------------------------------------------------------------
// Step Implementation
// ---------------------------------------------------------------------------

interface StepState {
  completedSteps: Map<string, unknown>;
  instanceId: string;
  jobId: string;
}

function createWorkflowStep(state: StepState): WorkflowStep {
  return {
    async do<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
      // Check if step was already completed (for replay/retry)
      if (state.completedSteps.has(name)) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the named step's caller owns its replay result type
        return state.completedSteps.get(name) as T;
      }

      // Execute the step
      const result = await fn();
      state.completedSteps.set(name, result);
      return result;
    },

    async sleep(name: string, duration: string | number): Promise<void> {
      if (state.completedSteps.has(`sleep:${name}`)) return;

      const ms =
        typeof duration === 'string' ? parseDuration(duration) : duration;
      await new Promise((resolve) => setTimeout(resolve, ms));
      state.completedSteps.set(`sleep:${name}`, true);
    },

    async waitForEvent<T = unknown>(
      name: string,
      options: { type: string; timeout?: string | number }
    ): Promise<{ payload: T } | null> {
      if (state.completedSteps.has(`event:${name}`)) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the named event's caller owns its payload type
        return state.completedSteps.get(`event:${name}`) as {
          payload: T;
        } | null;
      }

      const timeoutMs = options.timeout
        ? typeof options.timeout === 'string'
          ? parseDuration(options.timeout)
          : options.timeout
        : 60000; // Default 1 minute

      const eventKey = `${state.instanceId}:${options.type}`;

      const result = await new Promise<{ payload: T } | null>((resolve) => {
        const timer = setTimeout(() => {
          instanceEvents.removeAllListeners(eventKey);
          resolve(null);
        }, timeoutMs);

        instanceEvents.once(eventKey, (payload: T) => {
          clearTimeout(timer);
          resolve({ payload });
        });
      });

      state.completedSteps.set(`event:${name}`, result);
      return result;
    },
  };
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return parseInt(duration, 10);

  const value = parseInt(match[1] ?? '0', 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value;
  }
}

// ---------------------------------------------------------------------------
// Instance State Storage (using Redis)
// ---------------------------------------------------------------------------

import { createClient, type RedisClientType } from 'redis';

let redisClient: RedisClientType | undefined;

async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redisClient = createClient({ url: redisUrl });
  await redisClient.connect();
  return redisClient;
}

async function getInstanceState(instanceId: string): Promise<InstanceStatus> {
  const client = await getRedisClient();
  const data = await client.get(`workflow:instance:${instanceId}`);
  if (!data) return { status: 'unknown' };
  const parsed: unknown = JSON.parse(data);
  return instanceStatusSchema.parse(parsed);
}

async function setInstanceState(
  instanceId: string,
  state: InstanceStatus
): Promise<void> {
  const client = await getRedisClient();
  await client.set(
    `workflow:instance:${instanceId}`,
    JSON.stringify(state),
    { EX: 7 * 24 * 60 * 60 } // 7 days TTL
  );
}

async function getStepState(instanceId: string): Promise<Map<string, unknown>> {
  const client = await getRedisClient();
  const data = await client.get(`workflow:steps:${instanceId}`);
  if (!data) return new Map();
  return new Map(Object.entries(JSON.parse(data)));
}

async function saveStepState(
  instanceId: string,
  steps: Map<string, unknown>
): Promise<void> {
  const client = await getRedisClient();
  await client.set(
    `workflow:steps:${instanceId}`,
    JSON.stringify(Object.fromEntries(steps)),
    { EX: 7 * 24 * 60 * 60 }
  );
}

// ---------------------------------------------------------------------------
// Workflow Definition & Registration
// ---------------------------------------------------------------------------

export interface WorkflowDefinition<T> {
  name: string;
  readonly __payload?: T;
}

/**
 * Define a workflow. Call this once per workflow type at startup.
 */
export function defineWorkflow<T>(name: string): WorkflowDefinition<T> {
  return { name };
}

/**
 * Register a workflow handler. Must be called before starting workers.
 */
export function registerWorkflow<T>(
  definition: WorkflowDefinition<T>,
  handler: WorkflowHandler<T>
): void {
  const queue = new Queue(definition.name, {
    connection: getRedisConnection(),
  });

  workflowRegistry.set(definition.name, {
    name: definition.name,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- registry erases payload type and restores it at the registered handler boundary
    handler: handler as WorkflowHandler<unknown>,
    queue,
  });
}

// ---------------------------------------------------------------------------
// Workflow Triggering
// ---------------------------------------------------------------------------

export interface CreateWorkflowOptions {
  id?: string;
  params: unknown;
}

/**
 * Create a workflow binding (compatible with CF Workflows API).
 */
export function createWorkflowBinding<T>(workflowName: string): {
  create(options: CreateWorkflowOptions): Promise<WorkflowInstance>;
  get(id: string): Promise<WorkflowInstance>;
  readonly __payload?: T;
} {
  return {
    async create(options: CreateWorkflowOptions): Promise<WorkflowInstance> {
      const registration = workflowRegistry.get(workflowName);
      if (!registration) {
        throw new Error(`Workflow '${workflowName}' not registered`);
      }

      const instanceId = options.id || `${workflowName}-${randomUUID()}`;

      // Check for existing instance with same ID
      const existingState = await getInstanceState(instanceId);
      if (existingState.status !== 'unknown') {
        throw new InstanceAlreadyExistsError(
          `instance.already_exists: ${instanceId}`
        );
      }

      // Initialize instance state
      await setInstanceState(instanceId, { status: 'queued' });

      // Add job to queue
      await registration.queue.add(
        workflowName,
        {
          instanceId,
          payload: options.params,
          timestamp: new Date().toISOString(),
        },
        {
          jobId: instanceId,
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

      return createWorkflowInstanceProxy(instanceId, workflowName);
    },

    async get(id: string): Promise<WorkflowInstance> {
      return createWorkflowInstanceProxy(id, workflowName);
    },
  };
}

function createWorkflowInstanceProxy(
  instanceId: string,
  workflowName: string
): WorkflowInstance {
  return {
    id: instanceId,

    async status(): Promise<InstanceStatus> {
      return getInstanceState(instanceId);
    },

    async pause(): Promise<void> {
      const state = await getInstanceState(instanceId);
      if (state.status === 'running') {
        await setInstanceState(instanceId, { ...state, status: 'paused' });
      }
    },

    async resume(): Promise<void> {
      const state = await getInstanceState(instanceId);
      if (state.status === 'paused') {
        await setInstanceState(instanceId, { ...state, status: 'running' });
      }
    },

    async terminate(): Promise<void> {
      await setInstanceState(instanceId, { status: 'terminated' });
      const registration = workflowRegistry.get(workflowName);
      if (registration) {
        const job = await registration.queue.getJob(instanceId);
        if (job) {
          await job.remove();
        }
      }
    },

    async sendEvent(event: { type: string; payload?: unknown }): Promise<void> {
      const eventKey = `${instanceId}:${event.type}`;
      instanceEvents.emit(eventKey, event.payload);
    },
  };
}

// ---------------------------------------------------------------------------
// Worker Management
// ---------------------------------------------------------------------------

const workers: Worker[] = [];

function parseWorkflowJobData(value: unknown): {
  instanceId: string;
  payload: unknown;
  timestamp: string;
} {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Workflow job data must be an object');
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed to a non-null object above
  const record = value as Record<string, unknown>;
  if (
    typeof record.instanceId !== 'string' ||
    typeof record.timestamp !== 'string'
  ) {
    throw new Error('Workflow job data is missing instanceId or timestamp');
  }
  return {
    instanceId: record.instanceId,
    payload: record.payload,
    timestamp: record.timestamp,
  };
}

/**
 * Start workflow workers for all registered workflows.
 */
export async function startWorkflowWorkers(): Promise<void> {
  const concurrency = parseInt(process.env.WORKFLOW_CONCURRENCY || '5', 10);

  for (const [name, registration] of workflowRegistry) {
    const worker = new Worker(
      name,
      async (job: Job) => {
        const { instanceId, payload, timestamp } = parseWorkflowJobData(
          job.data
        );

        // Update status to running
        await setInstanceState(instanceId, { status: 'running' });

        // Load any previously completed steps
        const completedSteps = await getStepState(instanceId);

        const stepState: StepState = {
          completedSteps,
          instanceId,
          jobId: String(job.id ?? instanceId),
        };

        const event: WorkflowEvent<unknown> = {
          payload,
          instanceId,
          timestamp: new Date(timestamp),
        };

        const step = createWorkflowStep(stepState);

        try {
          const result = await registration.handler(event, step);

          // Save final step state
          await saveStepState(instanceId, stepState.completedSteps);

          // Mark complete
          await setInstanceState(instanceId, {
            status: 'complete',
            output: result,
          });

          return result;
        } catch (error) {
          // Save step state for potential retry
          await saveStepState(instanceId, stepState.completedSteps);

          const errorMessage =
            error instanceof Error ? error.message : String(error);

          await setInstanceState(instanceId, {
            status: 'errored',
            error: errorMessage,
          });

          throw error;
        }
      },
      {
        connection: getRedisConnection(),
        concurrency,
      }
    );

    worker.on('failed', (_job, error) => {
      logger.error(`[Workflow] ${name} failed`, { err: error });
    });

    worker.on('completed', (job) => {
      logger.info(`[Workflow] ${name} completed`, { jobId: job.id });
    });

    registration.worker = worker;
    workers.push(worker);
  }
}

/**
 * Stop all workflow workers gracefully.
 */
export async function stopWorkflowWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;

  // Close Redis connections
  if (redisClient) {
    await redisClient.quit();
    redisClient = undefined;
  }

  // Close queue connections
  for (const registration of workflowRegistry.values()) {
    await registration.queue.close();
  }
}

// ---------------------------------------------------------------------------
// Exports for OpenStory Compatibility
// ---------------------------------------------------------------------------

export { type WorkflowEvent as WorkflowEventType };
