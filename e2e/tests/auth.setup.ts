/**
 * Auth Setup - Runs once before all tests to create authenticated session
 * Saves both browser state (cookies) and user info to disk for reuse
 */

import fs from 'node:fs';
import path from 'node:path';
import { test as setup } from 'playwright/test';
import { authenticateUser, createTestUser } from '../fixtures/auth.fixture';

const authDir = path.join(import.meta.dirname, '../.auth');
const authFile = path.join(authDir, 'user.json');
const userInfoFile = path.join(authDir, 'user-info.json');

setup('authenticate', async ({ page }) => {
  // Cold `vite dev` transforms the whole route tree on the first page load;
  // on a fresh machine the /verify hydration can outlast the 30s local default.
  setup.setTimeout(120_000);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const freshUser = await createTestUser({ name: 'E2E Shared User' });
  await authenticateUser(page, freshUser.email);

  await page.context().storageState({ path: authFile });
  fs.writeFileSync(userInfoFile, JSON.stringify(freshUser, null, 2));
});
