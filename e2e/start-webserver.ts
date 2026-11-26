/**
 * Playwright webServer launcher.
 *
 * Migrate + seed the test D1 *before* Workerd opens it. Playwright starts
 * this process first, then globalSetup; if seed ran in globalSetup it would
 * open a second Miniflare against the same SQLite while vite already holds
 * it (SQLITE_BUSY_RECOVERY, workerd dies, every spec gets connection refused).
 *
 * Args after the script name are forwarded to vite (e.g. `dev --port=3001`).
 */

import { execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';

execFileSync('bun', ['scripts/migrate-local-d1.ts', '--test'], {
  stdio: 'inherit',
});
execFileSync('bun', ['scripts/seed.ts', '--test'], {
  stdio: 'inherit',
});

const vite = resolve(process.cwd(), 'node_modules/.bin/vite');
// Replay runs talk to aimock (:4010), which ignores credentials, but the
// platform LLM-key lookup still requires a non-empty key to exist before it
// will route the call. `playwright.config.ts` already injects dummy xAI /
// ElevenLabs keys for exactly this reason; do the same for OpenRouter / fal
// here, without ever overwriting a real key (recording runs keep theirs).
const workerEnv: NodeJS.ProcessEnv = { ...process.env };
if (process.env.E2E_RECORD !== '1') {
  workerEnv.OPENROUTER_KEY ||= 'test-mock-key';
  workerEnv.FAL_KEY ||= 'test-mock-key';
}
const child = spawn(vite, process.argv.slice(2), {
  stdio: 'inherit',
  env: workerEnv,
});

const shutdown = (signal: NodeJS.Signals) => {
  if (!child.killed) child.kill(signal);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});
