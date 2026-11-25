/**
 * Node.js Server Entry — Self-hosted deployment.
 *
 * Replaces Cloudflare Workers with a standalone Node.js server using Hono.
 * Compatible with TanStack Start SSR and provides the same API surface.
 *
 * Usage:
 *   NODE_ENV=production node dist/server/server-node.js
 *
 * Environment variables:
 *   - PORT: HTTP port (default: 3000)
 *   - HOST: Bind address (default: 0.0.0.0)
 *   - DATABASE_URL: SQLite/libsql path (default: file:./data/openstory.db)
 *   - STORAGE_ROOT: File storage directory (default: ./storage)
 *   - REDIS_URL: Redis for BullMQ workflows (default: redis://localhost:6379)
 */

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { compress } from 'hono/compress';
import { initDb, closeDb } from './db/client-node';
import { serveFile as serveStorageFile } from './storage/storage-node';
import {
  startWorkflowWorkers,
  stopWorkflowWorkers,
} from './workflow/workflow-node';
import { getLogger, toErrorPayload } from '@/platform/logger';
import { refreshFalPricingForCron } from './api-v1/cron-fal-pricing';
import { STORAGE_BUCKETS, type StorageBucket } from './storage/buckets';

const logger = getLogger(['openstory', 'server-node']);

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

// Serve built client assets
app.use(
  '/assets/*',
  serveStatic({
    root: './dist/client',
    rewriteRequestPath: (path) => path,
  })
);

// Serve public files
app.use(
  '/*',
  serveStatic({
    root: './public',
    rewriteRequestPath: (path) => path,
  })
);

// ---------------------------------------------------------------------------
// Storage Routes (R2 replacement)
// ---------------------------------------------------------------------------

/**
 * Serve stored media files. Replaces the /r2/$ Cloudflare route.
 * Supports Range requests for video seeking.
 */
app.get('/r2/*', async (c) => {
  const key = c.req.path.slice(4); // Remove '/r2/' prefix
  if (!key) {
    return c.text('Not found', 404);
  }

  const response = await serveStorageFile(key, c.req.raw);
  return response;
});

/**
 * Upload endpoint for proxied uploads (matching R2's getSignedUploadUrl pattern).
 */
app.put('/api/storage/upload', async (c) => {
  const { bucket, path, contentType } = c.req.query();
  if (!bucket || !path) {
    return c.json({ error: 'Missing bucket or path' }, 400);
  }

  try {
    const { uploadFile } = await import('./storage/storage-node');
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
  });
});

// ---------------------------------------------------------------------------
// Cron Job Endpoints (replaces Cloudflare scheduled triggers)
// ---------------------------------------------------------------------------

app.post('/api/cron/reconcile', async (c) => {
  // Verify internal cron token if configured
  const cronToken = process.env.CRON_SECRET;
  if (cronToken && c.req.header('Authorization') !== `Bearer ${cronToken}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { reconcileAllStuckJobs } = await import('./cron/reconcile-all');
    await reconcileAllStuckJobs();
    return c.json({ success: true });
  } catch (error) {
    logger.error('Cron reconcile failed:', {
      err: toErrorPayload(error),
    });
    return c.json({ error: 'Reconcile failed' }, 500);
  }
});

app.post('/api/cron/fal-pricing', async (c) => {
  const cronToken = process.env.CRON_SECRET;
  if (cronToken && c.req.header('Authorization') !== `Bearer ${cronToken}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    await refreshFalPricingForCron();
    return c.json({ success: true });
  } catch (error) {
    logger.error('Fal pricing refresh failed:', {
      err: toErrorPayload(error),
    });
    return c.json({ error: 'Refresh failed' }, 500);
  }
});

// ---------------------------------------------------------------------------
// TanStack Start SSR Handler
// ---------------------------------------------------------------------------

// Import the TanStack Start handler for SSR
// In production, this is bundled into dist/server/index.js by Vite
// We use dynamic import to load it from the built output
app.all('*', async (c) => {
  try {
    // Use the Vite-built SSR handler from dist/server/index.js
    // which includes the full TanStack Start app
    const distPath = new URL('../index.js', import.meta.url).pathname;
    const mod = await import(distPath);

    // The default export from the built server is the fetch handler
    if (mod.default?.fetch) {
      return await mod.default.fetch(c.req.raw, c.env, c.executionCtx);
    }

    // Fallback: try to use it as a direct handler
    if (typeof mod.default === 'function') {
      return await mod.default(c.req.raw);
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

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  logger.info('Initializing database...');
  await initDb();

  if (process.env.REDIS_URL) {
    logger.info('Starting workflow workers...');
    await startWorkflowWorkers();
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

    // Stop accepting new connections
    server.close();

    // Stop workflow workers
    await stopWorkflowWorkers();

    // Close database connection
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

export { app };
