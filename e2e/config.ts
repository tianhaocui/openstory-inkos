/**
 * Shared E2E server URL.
 *
 * `playwright.config.ts` boots its own `vite dev` on `E2E_PORT` (default 3001)
 * with `E2E_TEST=true`. Node-side fixtures must talk to that same server.
 *
 * On machines where a stale, auto-respawning `vite preview` owns :3001 (a
 * preview started without E2E_TEST returns 404 for `/api/test/*`), set
 * `E2E_PORT=3002` to isolate the run instead of kill-looping the orphan.
 * CI keeps the default 3001, so no workflow change is needed.
 */
export const E2E_PORT = process.env.E2E_PORT ?? '3001';

export const TEST_BASE_URL = `http://localhost:${E2E_PORT}`;
