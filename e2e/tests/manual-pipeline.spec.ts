/**
 * Manual Pipeline Driveability E2E (#1108 Phase 6 — plan §10).
 *
 * Proves the manual path that NEVER runs storyboard: starting from an empty
 * sequence, a filmmaker builds structure (scene + shot), writes a prompt,
 * injects their own still and clip, manages cast, soft-deletes with toast
 * Undo, and reorders scenes — with zero generation calls the whole way.
 *
 * Browser-visible generation traffic (fal.run / queue.fal.run / aimock :4010)
 * is counted and asserted zero. Server-side LLM calls wouldn't cross the
 * browser, but nothing in this path triggers a workflow either — the DB
 * assertions would catch a storyboard wipe (it hard-deletes shots).
 */

import path from 'node:path';
import { expect, type Page } from 'playwright/test';
import { test as testWithUser } from '../fixtures/auth.fixture';
import { waitForHydration } from '../fixtures/test-utils';
import { setupMockRoutes } from '../mocks/handlers';
import {
  cleanupSequenceById,
  createTestSequence,
  getTestSequenceShots,
  type TestSequence,
} from '../fixtures/sequence.fixture';

/** Sign the rights dialog the likeness check opens for a real-person upload. */
async function confirmPortraitRights(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: '检测到真人' });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await dialog
    .getByRole('checkbox', { name: /authorization to use this person/i })
    .check();
  await dialog
    .getByLabel('授权依据')
    .fill('E2E fixture image — synthetic, depicts no real person');
  await dialog.getByRole('button', { name: '确认使用权' }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

const IMAGE_FIXTURE = path.join(
  import.meta.dirname,
  '../fixtures/test-image.jpg'
);
const VIDEO_FIXTURE = path.join(
  import.meta.dirname,
  '../fixtures/test-video.mp4'
);

testWithUser.describe('Manual pipeline (no storyboard)', () => {
  let testSequence: TestSequence;
  const generationRequests: string[] = [];

  testWithUser.beforeEach(async ({ page, testUser }) => {
    await setupMockRoutes(page);
    // Reset per test: the collector is describe-scoped, so a second test added
    // here would otherwise inherit this one's traffic and assert against it.
    generationRequests.length = 0;
    // Any fal/aimock traffic from the browser means the manual path leaked
    // into generation — collect and assert empty at the end.
    page.on('request', (request) => {
      const url = request.url();
      if (
        url.includes('fal.run') ||
        url.includes('localhost:4010') ||
        url.includes('127.0.0.1:4010')
      ) {
        generationRequests.push(url);
      }
    });
    testSequence = await createTestSequence(
      testUser.teamId,
      testUser.id,
      `E2E Manual Pipeline ${crypto.randomUUID().slice(0, 8)}`
    );
  });

  testWithUser.afterEach(async () => {
    await cleanupSequenceById(testSequence.id, testSequence.styleId);
  });

  testWithUser(
    'full manual CRUD path: structure, prompt, media inject, cast, undo, reorder',
    async ({ page }) => {
      testWithUser.setTimeout(180_000);

      // ---- Open the empty sequence -------------------------------------
      await page.goto(`/sequences/${testSequence.id}/scenes`);
      await waitForHydration(page);
      await expect(
        page.getByRole('heading', { name: testSequence.title })
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('暂无场景。')).toBeVisible({
        timeout: 15_000,
      });

      // ---- 1. Add a scene (creates its first shot) ---------------------
      const sceneGroups = page.locator('[data-testid="scene-group"]');
      // The button is in the SSR markup but disabled until React hydrates
      // (`useHydrated`); a click before that is lost and the DB poll below
      // times out with zero shots. Wait for it to be enabled, as the library
      // specs do, instead of clicking on first paint.
      const addSceneButton = page.getByRole('button', { name: '添加场景' });
      await expect(addSceneButton).toBeEnabled({ timeout: 30_000 });
      await addSceneButton.click();
      // DB first — the rail used to stay on "No scenes yet" until list
      // queries settled, which flakes under parallel D1 load (#1108/#1384).
      await expect
        .poll(
          async () => (await getTestSequenceShots(testSequence.id)).length,
          { timeout: 20_000 }
        )
        .toBeGreaterThan(0);
      await expect(sceneGroups).toHaveCount(1, { timeout: 15_000 });
      const shotCards = page.locator('[data-testid="scene-list-item"]');
      await expect(shotCards).toHaveCount(1, { timeout: 15_000 });

      // ---- 2. Rename the scene -----------------------------------------
      await sceneGroups
        .first()
        .getByRole('button', { name: /^Scene actions for/ })
        .click();
      await page.getByRole('menuitem', { name: '重命名场景' }).click();
      const titleInput = page.getByLabel('场景标题');
      await titleInput.fill('Opening');
      await titleInput.press('Enter');
      // Header button reads "Opening 1 shot" (the shot card also echoes the
      // scene title, so target the header role, not text).
      await expect(
        sceneGroups.first().getByRole('button', { name: /^Opening/ })
      ).toBeVisible({ timeout: 10_000 });

      // ---- 3. Select the shot and edit its visual prompt ---------------
      await shotCards.first().click();
      await page.getByRole('tab', { name: '起始帧' }).click();
      const promptEditor = page
        .getByRole('tabpanel')
        .locator('[data-slot="markdown-editor"] .ProseMirror');
      await expect(promptEditor).toBeVisible({ timeout: 10_000 });
      await promptEditor.click();
      await promptEditor.fill(
        'A rain-soaked neon alley, lone figure under an umbrella'
      );
      await page.getByRole('button', { name: '保存', exact: true }).click();
      await expect(page.getByText('提示词已保存')).toBeVisible({
        timeout: 10_000,
      });

      // ---- 4. Upload a still via Replace Image -------------------------
      // The mobile drawer mounts a second (hidden) copy of the tab — scope to
      // the visible desktop tabpanel.
      await page
        .getByRole('tabpanel', { name: '起始帧' })
        .locator('input[type="file"]')
        .setInputFiles(IMAGE_FIXTURE);
      // The fixture photo shows a person, so the likeness check (#1581) asks
      // for the portrait sign-off before the still is stored.
      await confirmPortraitRights(page);
      await expect(page.getByText('图片已替换')).toBeVisible({
        timeout: 20_000,
      });
      // The uploaded still is now the selected version in local R2.
      await expect
        .poll(
          async () => {
            const shots = await getTestSequenceShots(testSequence.id);
            return shots[0]?.thumbnailUrl ?? null;
          },
          { timeout: 20_000 }
        )
        .toContain('/r2/');
      // No render exists yet, so nothing may claim to be generating.
      await expect(page.getByText('生成中…')).not.toBeVisible();

      // ---- 5. Upload a clip via Replace Video --------------------------
      await page.getByRole('tab', { name: '视频' }).click();
      await page
        .getByRole('tabpanel', { name: '视频' })
        .locator('input[type="file"]')
        .setInputFiles(VIDEO_FIXTURE);
      await expect(page.getByText('视频已替换')).toBeVisible({
        timeout: 20_000,
      });
      await expect
        .poll(
          async () => {
            const shots = await getTestSequenceShots(testSequence.id);
            return shots[0]?.videoUrl ?? null;
          },
          { timeout: 20_000 }
        )
        .toContain('/r2/');

      // ---- 6. Cast: add, edit bible, soft-delete + Undo ----------------
      // Manually added characters belong to no shot facet yet — the cast tab
      // scopes by selection, so operate at whole-sequence scope.
      await page.getByRole('button', { name: /Whole sequence/ }).click();
      await page.getByRole('tab', { name: '演员' }).click();
      await page.getByRole('button', { name: '添加演员' }).click();
      await page.getByLabel('名称', { exact: true }).fill('Maya');
      await page
        .getByRole('dialog')
        .getByRole('button', { name: '添加演员' })
        .click();
      await expect(page.getByText('已添加 Maya')).toBeVisible({
        timeout: 10_000,
      });
      const mayaCard = page.getByRole('link', { name: /Maya/ });
      await expect(mayaCard).toBeVisible({ timeout: 10_000 });

      // Bible edit on the character detail page.
      await mayaCard.click();
      await expect(page.locator('h1').filter({ hasText: 'Maya' })).toBeVisible({
        timeout: 15_000,
      });
      // exact: "年龄" is a substring of the sheet "图像模型" trigger
      // ("图像模型: …").
      await page.getByLabel('年龄', { exact: true }).fill('34');
      await page.getByRole('button', { name: '保存', exact: true }).click();
      await expect(page.getByText('角色已保存')).toBeVisible({
        timeout: 10_000,
      });

      // Back to the editor; soft-delete from the cast facet, then Undo.
      await page.goto(`/sequences/${testSequence.id}/scenes`);
      await waitForHydration(page);
      await expect(
        page.getByRole('heading', { name: testSequence.title })
      ).toBeVisible({ timeout: 15_000 });
      await page.getByRole('tab', { name: '演员' }).click();
      await page.getByRole('button', { name: '从序列中移除 Maya' }).click();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: '移除', exact: true })
        .click();
      await expect(page.getByRole('link', { name: /Maya/ })).not.toBeVisible({
        timeout: 10_000,
      });
      await page
        .locator('[data-sonner-toast]')
        .filter({ hasText: '移除d Maya' })
        .getByRole('button', { name: '撤销' })
        .click();
      await expect(page.getByRole('link', { name: /Maya/ })).toBeVisible({
        timeout: 15_000,
      });

      // ---- 7. Soft-delete the shot, then Undo (media intact) -----------
      const shotsBefore = await getTestSequenceShots(testSequence.id);
      const uploadedStillUrl = shotsBefore[0]?.thumbnailUrl;
      // Guard the round-trip assertion below against passing vacuously: two
      // nulls would compare equal and prove nothing about losslessness.
      expect(uploadedStillUrl).toContain('/r2/');
      await shotCards.first().hover();
      await shotCards.first().getByRole('button', { name: '镜头操作' }).click();
      await page.getByRole('menuitem', { name: '移除 shot' }).click();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: '移除', exact: true })
        .click();
      await expect(shotCards).toHaveCount(0, { timeout: 10_000 });
      await page
        .locator('[data-sonner-toast]')
        .filter({ hasText: '已从 Opening 移除镜头' })
        .getByRole('button', { name: '撤销' })
        .click();
      await expect(shotCards).toHaveCount(1, { timeout: 15_000 });
      // Restore is lossless: the uploaded still is still the selected image.
      const shotsAfterRestore = await getTestSequenceShots(testSequence.id);
      expect(shotsAfterRestore[0]?.thumbnailUrl).toBe(uploadedStillUrl);

      // ---- 8. Reorder scenes and verify it sticks after reload ---------
      await page.getByRole('button', { name: '添加场景' }).click();
      await expect(sceneGroups).toHaveCount(2, { timeout: 15_000 });
      await sceneGroups
        .first()
        .getByRole('button', { name: 'Opening的场景操作' })
        .click();
      await page.getByRole('menuitem', { name: '下移' }).click();
      // Optimistic reorder: the untitled scene takes slot 1 ("Scene 1").
      await expect(
        sceneGroups.first().getByRole('button', { name: /^Scene 1/ })
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        sceneGroups.nth(1).getByRole('button', { name: /^Opening/ })
      ).toBeVisible();
      // DB first — reload SSRs the scene list with staleTime 30s, so a
      // reload before the reorder POST commits freezes Opening in slot 1
      // for the rest of the assertion (#1384).
      await expect
        .poll(
          async () => {
            const shots = await getTestSequenceShots(testSequence.id);
            return shots[1]?.thumbnailUrl ?? null;
          },
          { timeout: 20_000 }
        )
        .toBe(uploadedStillUrl);

      await page.reload();
      await expect(sceneGroups).toHaveCount(2, { timeout: 15_000 });
      await expect(
        sceneGroups.first().getByRole('button', { name: /^Scene 1/ })
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        sceneGroups.nth(1).getByRole('button', { name: /^Opening/ })
      ).toBeVisible();

      // ---- No generation traffic left the browser ----------------------
      expect(generationRequests).toEqual([]);
    }
  );
});
