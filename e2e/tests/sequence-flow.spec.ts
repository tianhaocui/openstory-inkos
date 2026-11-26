/**
 * Sequence Creation Flow E2E Tests
 *
 * Tests the complete flow:
 * 1. Create sequence with suggested talent
 * 2. Generate and select variants
 * 3. Recast character with different talent
 */

import { TEST_BASE_URL } from '../config';
import { expect } from 'playwright/test';
import { test as testWithUser } from '../fixtures/auth.fixture';
import { setupMockRoutes } from '../mocks/handlers';
import {
  fillScriptEditor,
  openComposerReference,
  waitForHydration,
} from '../fixtures/test-utils';
import {
  createTestTalentSet,
  cleanupTalentById,
  type TestTalent,
} from '../fixtures/talent.fixture';
import {
  createTestSequence,
  createTestShot,
  createTestCharacter,
  cleanupSequenceById,
  getTestShot,
  getTestCharacter,
  type TestSequence,
  type TestShot,
  type TestCharacter,
} from '../fixtures/sequence.fixture';

// Each test creates its own data with unique names for parallel execution
testWithUser.describe('Sequence Creation Flow', () => {
  let testTalents: TestTalent[] = [];

  testWithUser.beforeEach(async ({ page, testUser }) => {
    // Setup mock routes for AI/workflow calls
    await setupMockRoutes(page);

    // Create test talent for the test user's team with unique names
    const suffix = crypto.randomUUID().slice(0, 8);
    testTalents = await createTestTalentSet(testUser.teamId, [
      `E2E Test Actor One ${suffix}`,
      `E2E Test Actor Two ${suffix}`,
    ]);
  });

  testWithUser.afterEach(async () => {
    // Cleanup test data - only the specific talents we created
    for (const t of testTalents) {
      await cleanupTalentById(t.id);
    }
    testTalents = [];
  });

  testWithUser(
    'can create sequence with suggested talent',
    async ({ page }) => {
      // Navigate to the new film composer (P2: /sequences/new is a 307 alias)
      await page.goto('/films/new');

      // Wait for React hydration + data loading by checking the style grid is populated
      // The style grid requires useStyles() query data, which only loads after hydration
      await expect(page.getByRole('grid', { name: '风格选择' })).toBeVisible({
        timeout: 15000,
      });

      await expect(page).toHaveURL('/films/new');

      // Enter a simple test script
      const testScript = `
INT. COFFEE SHOP - DAY

JOHN, a 30-something developer, sits at a table with his laptop.

JOHN
I need to fix this bug before the demo.

SARAH, his colleague, approaches with two coffees.

SARAH
Here's your caffeine fix. How's it going?
    `.trim();

      // Click a style to force React interaction and confirm hydration
      // The style grid may be SSR-rendered before React hydrates. Target style
      // tiles by aria-label so the trailing "View all" tile is never picked.
      const firstStyle = page
        .getByRole('grid', { name: '风格选择' })
        .getByRole('button', { name: /^查看 .+ 详情$/ })
        .first();
      await firstStyle.click();
      await page.getByRole('button', { name: /^使用 .+ 风格$/ }).click();

      // Now fill the editor - React is hydrated since style click worked
      await fillScriptEditor(page, testScript);

      // Wait for "生成" button to become enabled - this proves:
      // 1. React hydration is complete (event handlers attached)
      // 2. Textarea fill was picked up by React state (script is set)
      // 3. Style was selected (from our click above)
      await expect(
        page.getByRole('button', { name: '生成', exact: true })
      ).toBeEnabled({ timeout: 10000 });

      await openComposerReference(page, '演员');

      // Wait for talent dialog to open - the dialog is rendered via a portal
      // Use a longer timeout as it may need to fetch talent data
      const talentDialog = page.getByRole('dialog');
      await expect(talentDialog).toBeVisible({ timeout: 10000 });
      await expect(talentDialog.getByText('选择演员')).toBeVisible();

      // Verify our test talents appear in the dialog (use variable names)
      const firstTalent = testTalents[0];
      const secondTalent = testTalents[1];
      if (!firstTalent || !secondTalent) {
        throw new Error('test setup: expected two test talents');
      }
      await expect(page.getByText(firstTalent.name)).toBeVisible();
      await expect(page.getByText(secondTalent.name)).toBeVisible();

      // Select first talent by clicking on it
      await page.getByText(firstTalent.name).click();

      // Submit dialog (button text reflects selection count)
      await talentDialog
        .getByRole('button', { name: /^为 \d+ 个角色选角$/ })
        .click();
      await expect(talentDialog).not.toBeVisible();

      // Verify the composer's primary submit is ready. `exact` matters: the
      // settings trigger ("生成设置"), style matcher ("匹配剧本：根据剧本生成风格")
      // and the motion toggle all contain 生成 too.
      const submitButton = page.getByRole('button', {
        name: '生成',
        exact: true,
      });
      await expect(submitButton).toBeVisible();
    }
  );
});

// Each test creates its own data with unique names for parallel execution
testWithUser.describe('Variant Selection', () => {
  let testSequence: TestSequence;
  let testShot: TestShot;
  const originalThumbnailUrl = `${TEST_BASE_URL}/api/test/image?w=1024&h=576&label=thumb`;

  testWithUser.beforeEach(async ({ page, testUser }) => {
    await setupMockRoutes(page);

    // Create pre-seeded sequence with shot that has variant image (unique name)
    testSequence = await createTestSequence(
      testUser.teamId,
      testUser.id,
      `E2E Variant Test Sequence ${crypto.randomUUID().slice(0, 8)}`
    );
    testShot = await createTestShot(testSequence.id, 0, {
      // Use real placeholder images
      thumbnailUrl: originalThumbnailUrl,
      variantImageUrl: `${TEST_BASE_URL}/api/test/image?w=3072&h=3072&label=variants`,
      variantImageStatus: 'completed',
    });
  });

  testWithUser.afterEach(async () => {
    await cleanupSequenceById(testSequence.id, testSequence.styleId);
  });

  testWithUser('can select variant from grid', async ({ page }) => {
    // Cold dev-server + 3×3 grid + confirm POST routinely needs more than the
    // global 60s; at 60s the afterEach cleanup can delete the seeded sequence
    // while the confirm mutation is still in flight ("Sequence not found").
    testWithUser.setTimeout(120_000);

    // Verify initial state in database
    const shotBefore = await getTestShot(testShot.id);
    expect(shotBefore?.thumbnailUrl).toBe(originalThumbnailUrl);

    // Navigate directly to the film scenes page (P2: /sequences is a 307 alias)
    await page.goto(`/films/${testSequence.id}/scenes`);

    // Don't use networkidle - the page has a realtime SSE connection that never settles.
    // Gate on React's own fiber before clicking: the canvas is SSR'd but its
    // variant dialog is a client-only state change (#827).
    await waitForHydration(page);
    await expect(
      page.getByRole('heading', { name: testSequence.title })
    ).toBeVisible({ timeout: 15000 });

    // Also wait for the shot thumbnail to be visible
    // Shots load via a separate API call from the sequence data, so needs its own timeout
    const shotThumbnail = page.getByRole('img', { name: 'Scene 1' });
    await expect(shotThumbnail).toBeVisible({
      timeout: 15000,
    });

    // Variants moved from a tab to a dialog opened from the canvas image (#986):
    // select the shot, then open the variants dialog from the starting frame.
    // The list item is a real <a href> (#1339), so the click lands whether or
    // not React has hydrated; selection is URL state, so gate on `?shot=<id>`
    // rather than on the SSR-visible thumbnail.
    await page.getByRole('link', { name: 'Scene 1' }).click();
    await expect(page).toHaveURL(new RegExp(`shot=${testShot.id}`), {
      timeout: 15_000,
    });
    // Video leads the shot tabs, so the canvas opens on the clip; the still
    // (and its variants button) is on the Start Frame tab.
    await page.getByRole('tab', { name: '起始帧' }).click();
    // `exact` so this never also matches the dialog's own "Regenerate frame
    // variants" button.
    const variantsButton = page.getByRole('button', {
      name: '起始帧变体',
      exact: true,
    });
    await expect(variantsButton).toBeVisible({ timeout: 10000 });
    await expect(variantsButton).toBeEnabled({ timeout: 10_000 });
    // Scope by dialog title: the page can host other portaled dialogs, and a
    // bare getByRole('dialog') either goes strict-mode or watches the wrong one.
    const variantsDialog = page.getByRole('dialog', { name: '起始帧变体' });
    await variantsButton.click();
    await expect(variantsDialog).toBeVisible({ timeout: 15_000 });

    const variantGrid = page.getByRole('grid', { name: '变体选择' });

    // Wait for variant grid to be visible
    await expect(variantGrid).toBeVisible({ timeout: 10000 });

    // Click on variant 5 (center tile)
    const variant5 = page.getByRole('button', { name: 'Select variant 5' });
    await expect(variant5).toBeVisible();
    await variant5.click();

    // Confirmation dialog should appear
    await expect(page.getByText('选择此变体？')).toBeVisible();

    // Selecting a tile no longer writes the thumbnail synchronously (#989).
    // `selectShotVariantFn` runs the full synchronous path — reads the latest
    // framing grid sheet from frame_variants, crops the chosen tile, checks
    // credits, and triggers the upscale workflow — then returns. The actual
    // still REPOINT happens asynchronously inside that workflow (covered by
    // upscale-shot-variant-workflow.test.ts's persistUpscaleSelection), and
    // normal e2e no-ops workflow triggers (workflow/client.ts), so there is no
    // synchronous DB thumbnail change to observe here. Assert the interaction
    // round-trips cleanly instead: the select POST returns 200 and the flow
    // completes without an error toast.
    const selectResponse = page.waitForResponse(
      (resp) =>
        resp.request().method() === 'POST' &&
        (resp.request().postData() ?? '').includes('variantIndex') &&
        resp.status() === 200,
      { timeout: 15_000 }
    );

    // Confirm selection
    await page.getByRole('button', { name: '确认' }).click();
    await selectResponse;

    // Dialog should close and no failure toast should surface.
    await expect(page.getByText('选择此变体？')).not.toBeVisible();
    await expect(page.getByText('选择变体失败')).not.toBeVisible();
  });
});

// Each test creates its own data with unique names for parallel execution
testWithUser.describe('Character Recast', () => {
  let testTalents: TestTalent[] = [];
  let testSequence: TestSequence;
  let testCharacter: TestCharacter;

  testWithUser.beforeEach(async ({ page, testUser }) => {
    await setupMockRoutes(page);

    // Create test talent with unique names
    const suffix = crypto.randomUUID().slice(0, 8);
    testTalents = await createTestTalentSet(testUser.teamId, [
      `E2E Current Actor ${suffix}`,
      `E2E New Actor ${suffix}`,
    ]);

    const firstTalent = testTalents[0];
    if (!firstTalent) {
      throw new Error('test setup: expected at least one test talent');
    }

    // Create pre-seeded sequence with character (unique name)
    testSequence = await createTestSequence(
      testUser.teamId,
      testUser.id,
      `E2E Recast Test Sequence ${suffix}`
    );

    // Create a character linked to the first talent
    testCharacter = await createTestCharacter(
      testSequence.id,
      'John',
      'John',
      firstTalent.id,
      {
        // Use real placeholder image
        sheetImageUrl: `${TEST_BASE_URL}/api/test/image?w=1920&h=1080&label=character`,
        sheetStatus: 'completed',
      }
    );
  });

  testWithUser.afterEach(async () => {
    // Cleanup specific entities we created
    for (const t of testTalents) {
      await cleanupTalentById(t.id);
    }
    await cleanupSequenceById(testSequence.id, testSequence.styleId);
    testTalents = [];
  });

  testWithUser(
    'can recast character with different talent',
    async ({ page }) => {
      const firstTalent = testTalents[0];
      const secondTalent = testTalents[1];
      if (!firstTalent || !secondTalent) {
        throw new Error('test setup: expected two test talents');
      }

      // Verify initial state - character is linked to first talent
      const characterBefore = await getTestCharacter(testCharacter.id);
      expect(characterBefore?.talentId).toBe(firstTalent.id);

      // Navigate to the character detail page
      await page.goto(`/films/${testSequence.id}/cast/${testCharacter.id}`);
      await waitForHydration(page);

      // Wait for character detail to load
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('h1').filter({ hasText: 'John' })).toBeVisible({
        timeout: 15000,
      });

      // Click Recast button. `exact` so the rename-sequence control
      // (aria-label includes the sequence title, which contains "替换演员")
      // is not a strict-mode match.
      const recastButton = page.getByRole('button', {
        name: '替换演员',
        exact: true,
      });
      await expect(recastButton).toBeVisible();
      await recastButton.click();

      // Talent picker dialog should open
      const talentDialog = page.getByRole('dialog');
      await expect(talentDialog).toBeVisible();
      await expect(talentDialog.getByText('选择演员')).toBeVisible();

      // Select the second talent (use variable name)
      await page.getByText(secondTalent.name).click();

      // Recast confirmation dialog should appear (use regex with variable)
      await expect(
        page.getByText(
          new RegExp(`替换演员：由 ${secondTalent.name} 饰演 John`)
        )
      ).toBeVisible();

      // Confirm the recast
      await page.getByRole('button', { name: '替换演员', exact: true }).click();

      // The confirmation dialog should close (loading state may briefly appear)
      // With mocks, the mutation should complete quickly
      await expect(
        page.getByText(
          new RegExp(`替换演员：由 ${secondTalent.name} 饰演 John`)
        )
      ).not.toBeVisible({ timeout: 10000 });

      // Verify the database was updated - character now linked to second talent
      await expect
        .poll(
          async () => {
            const characterAfter = await getTestCharacter(testCharacter.id);
            return characterAfter?.talentId;
          },
          { timeout: 20_000 }
        )
        .toBe(secondTalent.id);
    }
  );
});

// Skip empty state test in parallel mode - it interferes with other tests
// by cleaning up all talent for the shared team. This test works in serial mode.
// TODO: Consider running this test with a dedicated user/team for isolation
testWithUser.describe.skip('Empty States', () => {
  testWithUser(
    'shows empty state when no talent in library',
    async ({ page }) => {
      await setupMockRoutes(page);

      await page.goto('/films/new');

      // Wait for React hydration + data loading
      await expect(page.getByRole('grid', { name: '风格选择' })).toBeVisible({
        timeout: 15000,
      });

      await openComposerReference(page, '演员');

      // Wait for dialog to open
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // Verify empty state
      await expect(page.getByText('演员库中暂无演员')).toBeVisible();
    }
  );
});
