/**
 * Drizzle Database Client — Node / self-hosted context.
 *
 * Activated by the `default` import condition in package.json's `imports.#db-client`.
 * Uses libsql (SQLite compatible) for local/self-hosted deployments.
 *
 * Configuration via environment variables:
 *   - DATABASE_URL: Path to SQLite file (default: ./data/openstory.db)
 *   - DATABASE_AUTH_TOKEN: Optional auth token for remote libsql (Turso)
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { relations } from '@/platform/server/db/schema/relations';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

type Database = ReturnType<typeof buildDb>;

let _db: Database | undefined;
let _client: Client | undefined;

function buildDb(client: Client) {
  return drizzle({ client, relations });
}

/**
 * Ensure the database directory exists for local file-based SQLite.
 */
async function ensureDbDir(dbPath: string): Promise<void> {
  if (dbPath.startsWith('file:')) {
    const filePath = dbPath.replace(/^file:/, '');
    await mkdir(dirname(filePath), { recursive: true });
  } else if (!dbPath.startsWith('http') && !dbPath.startsWith('libsql:')) {
    // Plain file path
    await mkdir(dirname(dbPath), { recursive: true });
  }
}

/**
 * Initialize the database client. Call this once at startup.
 * For most use cases, just call getDb() which auto-initializes.
 */
export async function initDb(): Promise<Database> {
  if (_db) return _db;

  const dbUrl = process.env.DATABASE_URL || 'file:./data/openstory.db';
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  await ensureDbDir(dbUrl);

  const client = createClient({
    url: dbUrl,
    authToken,
  });
  _client = client;

  // Enable WAL mode for better concurrent read performance
  if (dbUrl.startsWith('file:') || !dbUrl.includes('://')) {
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA busy_timeout = 5000');
    await client.execute('PRAGMA synchronous = NORMAL');
    await client.execute('PRAGMA cache_size = -64000'); // 64MB cache
    await client.execute('PRAGMA foreign_keys = ON');
  }

  const db = buildDb(client);
  _db = db;
  return db;
}

/**
 * Get the database instance. Auto-initializes if not already done.
 * Note: First call may be async internally but returns synchronously
 * after initialization.
 */
export const getDb = (): Database => {
  if (_db) return _db;

  // Synchronous initialization for compatibility with existing code
  // that expects getDb() to return immediately
  const dbUrl = process.env.DATABASE_URL || 'file:./data/openstory.db';
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  const client = createClient({
    url: dbUrl,
    authToken,
  });
  _client = client;

  const db = buildDb(client);
  _db = db;

  // Run pragma setup asynchronously (non-blocking)
  if (dbUrl.startsWith('file:') || !dbUrl.includes('://')) {
    void (async () => {
      try {
        await client.execute('PRAGMA journal_mode = WAL');
        await client.execute('PRAGMA busy_timeout = 5000');
        await client.execute('PRAGMA synchronous = NORMAL');
        await client.execute('PRAGMA cache_size = -64000');
        await client.execute('PRAGMA foreign_keys = ON');
      } catch {
        // Ignore pragma errors — they're optimizations, not requirements
      }
    })();
  }

  return db;
};

/**
 * Get the raw libsql client for direct SQL execution.
 */
export const getClient = (): Client => {
  if (_client) return _client;
  getDb();
  if (!_client) throw new Error('Database client failed to initialize');
  return _client;
};

/**
 * Close the database connection. Call during graceful shutdown.
 */
export async function closeDb(): Promise<void> {
  if (_client) {
    _client.close();
    _client = undefined;
    _db = undefined;
  }
}
