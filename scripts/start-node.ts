#!/usr/bin/env bun
/**
 * Node.js Server Starter for OpenStory
 *
 * This script starts the OpenStory server in Node.js/Bun mode,
 * wrapping the Vite-built SSR output with local storage, database,
 * and workflow backends.
 *
 * Usage:
 *   bun scripts/start-node.ts
 *   NODE_ENV=production bun scripts/start-node.ts
 */

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { compress } from 'hono/compress';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// Import platform modules
import { initDb, closeDb } from '../src/platform/server/db/client-node';
import {
  serveFile as serveStorageFile,
  uploadFile,
} from '../src/platform/server/storage/storage-node';
import {
  startWorkflowWorkers,
  stopWorkflowWorkers,
} from '../src/platform/server/workflow/workflow-node';
import { getLogger, toErrorPayload } from '../src/platform/logger';
import {
  STORAGE_BUCKETS,
  type StorageBucket,
} from '../src/platform/server/storage/buckets';

const logger = getLogger(['openstory', 'server-node']);
const scriptDir = dirname(fileURLToPath(import.meta.url));

function storageBucket(value: string): StorageBucket | undefined {
  return Object.values(STORAGE_BUCKETS).find((bucket) => bucket === value);
}

// ---------------------------------------------------------------------------
// Hono App Setup
// ---------------------------------------------------------------------------

const app = new Hono();

// Middleware
app.use('*', honoLogger());
app.use('*', compress());
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Static File Serving
// ---------------------------------------------------------------------------

const distClient = resolve(scriptDir, '../dist/client');
const publicDir = resolve(scriptDir, '../public');

// Serve built client assets
if (existsSync(distClient)) {
  app.use(
    '/assets/*',
    serveStatic({
      root: distClient,
      rewriteRequestPath: (path) => path,
    })
  );
}

// Serve public files
if (existsSync(publicDir)) {
  app.use(
    '/*',
    serveStatic({
      root: publicDir,
      rewriteRequestPath: (path) => path,
    })
  );
}

// ---------------------------------------------------------------------------
// Storage Routes (R2 replacement)
// ---------------------------------------------------------------------------

app.get('/r2/*', async (c) => {
  const key = c.req.path.slice(4); // Remove '/r2/' prefix
  if (!key) {
    return c.text('Not found', 404);
  }
  const response = await serveStorageFile(key, c.req.raw);
  return response;
});

app.put('/api/storage/upload', async (c) => {
  const { bucket, path, contentType } = c.req.query();
  if (!bucket || !path) {
    return c.json({ error: 'Missing bucket or path' }, 400);
  }

  try {
    const body = await c.req.arrayBuffer();
    const resolvedBucket = storageBucket(bucket);
    if (!resolvedBucket) {
      return c.json({ error: 'Invalid bucket' }, 400);
    }
    const result = await uploadFile(resolvedBucket, path, body, {
      contentType: contentType || 'application/octet-stream',
    });
    return c.json(result);
  } catch (error) {
    logger.error('Upload failed:', { err: toErrorPayload(error) });
    return c.json({ error: 'Upload failed' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    mode: 'node',
  });
});

// ---------------------------------------------------------------------------
// Cron Job Endpoints
// ---------------------------------------------------------------------------

app.post('/api/cron/reconcile', async (c) => {
  const cronToken = process.env.CRON_SECRET;
  if (cronToken && c.req.header('Authorization') !== `Bearer ${cronToken}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { reconcileAllStuckJobs } =
      await import('../src/platform/server/cron/reconcile-all');
    await reconcileAllStuckJobs();
    return c.json({ success: true });
  } catch (error) {
    logger.error('Cron reconcile failed:', {
      err: toErrorPayload(error),
    });
    return c.json({ error: 'Reconcile failed' }, 500);
  }
});

// ---------------------------------------------------------------------------
// TanStack Start SSR Handler
// ---------------------------------------------------------------------------

// Load the Vite-built SSR handler
const distServerIndex = resolve(scriptDir, '../dist/server/index.js');

app.all('*', async (c) => {
  try {
    if (!existsSync(distServerIndex)) {
      logger.error(
        'dist/server/index.js not found. Run `bun run build` first.'
      );
      return c.text('Server not built. Run bun run build first.', 500);
    }

    // Dynamic import of the built SSR handler
    const mod = await import(distServerIndex);

    // The Cloudflare Workers entry exports a default with fetch method
    if (mod.default?.fetch) {
      // Create a minimal env object for the handler
      const env = {
        // Database and storage are handled by our Node implementations
        // These would normally be Cloudflare bindings
      };
      return await mod.default.fetch(c.req.raw, env, {});
    }

    logger.error('SSR handler not found in dist/server/index.js');
    return c.text('Internal Server Error', 500);
  } catch (error) {
    logger.error('SSR handler error:', { err: toErrorPayload(error) });
    return c.text('Internal Server Error', 500);
  }
});

// ---------------------------------------------------------------------------
// Server Lifecycle
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  logger.info('Initializing database...');
  await initDb();

  // Only start workflow workers if Redis is available
  if (process.env.REDIS_URL) {
    logger.info('Starting workflow workers...');
    try {
      await startWorkflowWorkers();
    } catch (error) {
      logger.warn('Workflow workers not started (Redis not available):', {
        err: toErrorPayload(error),
      });
    }
  } else {
    logger.info('Skipping workflow workers (REDIS_URL not set)');
  }

  logger.info(`Starting server on ${HOST}:${PORT}...`);
  const server = serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });

  logger.info(`OpenStory server running at http://${HOST}:${PORT}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close();

    if (process.env.REDIS_URL) {
      await stopWorkflowWorkers();
    }
    await closeDb();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server:', { err: toErrorPayload(error) });
  process.exit(1);
});
