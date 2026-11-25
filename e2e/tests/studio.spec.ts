import type { Page } from 'playwright/test';
import { expect, test } from '../fixtures/auth.fixture';

const HYDRATION_TIMEOUT = 30_000;

/** The composer is server-rendered; wait for TipTap to mount before clicking. */
async function waitForComposer(page: Page): Promise<void> {
  await expect(
    page.locator('[data-slot="markdown-editor"] .ProseMirror')
  ).toBeVisible({ timeout: HYDRATION_TIMEOUT });
}

test.describe('Images and Videos studio', () => {
  test('signed-in user can open Images from the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: '图片', exact: true }).click();
    await expect(page).toHaveURL(/\/images/);
    await expect(
      page.locator('[data-slot="markdown-editor"] .ProseMirror')
    ).toBeVisible({ timeout: HYDRATION_TIMEOUT });
    await expect(page.getByRole('button', { name: '生成图片' })).toBeVisible();
  });

  test('signed-in user can open Videos from the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: '视频', exact: true }).click();
    await expect(page).toHaveURL(/\/videos/);
    await expect(page.getByRole('button', { name: '生成视频' })).toBeVisible();
    await waitForComposer(page);
    await expect(
      page.getByRole('combobox', { name: '视频模式' })
    ).toBeVisible();
    await page.getByRole('button', { name: '生成设置' }).click();
    await expect(page.getByLabel('图像模型')).toHaveCount(0);
    await expect(page.getByLabel(/动效模型/)).toBeVisible();
  });

  test('video modes follow the model', async ({ page }) => {
    await page.goto('/videos');
    await waitForComposer(page);
    const mode = page.getByRole('combobox', { name: '视频模式' });
    await mode.click();
    await page.getByRole('option', { name: '参考图生视频' }).click();
    await expect(
      page.getByRole('button', { name: '参考素材', exact: true })
    ).toBeVisible();
    await mode.click();
    await page.getByRole('option', { name: '图生视频', exact: true }).click();
    await expect(page.getByRole('button', { name: '起始帧' })).toBeVisible();
    await expect(page.getByRole('button', { name: '结束帧' })).toBeVisible();
  });

  test('signed-in user can open Models from the sidebar', async ({ page }) => {
    await page.goto('/');
    const models = page.getByRole('link', { name: '模型', exact: true });
    // Production e2e builds leave MODELS_ENABLED off; the catalog is then
    // 404 and off the nav. Skip rather than wait 60s for a missing link.
    test.skip(
      (await models.count()) === 0,
      'Models catalog is flag-gated off in this build'
    );
    await models.click();
    await expect(page).toHaveURL(/\/models/);
    await expect(page.getByRole('heading', { name: '模型' })).toBeVisible();
  });

  test('/studio redirects to /images', async ({ page }) => {
    await page.goto('/studio');
    await expect(page).toHaveURL(/\/images/);
  });

  test('remembered support mode does not break a non-admin list', async ({
    page,
  }) => {
    await page.goto('/images');
    await page.evaluate(() => {
      localStorage.setItem(
        'openstory:studio-list:v1',
        JSON.stringify({
          search: '',
          supportMode: true,
          hideInternal: false,
        })
      );
    });
    await page.goto('/images');

    await expect(page.getByRole('button', { name: '生成图片' })).toBeVisible({
      timeout: HYDRATION_TIMEOUT,
    });
    await expect(page.getByText('加载失败')).toHaveCount(0);
  });

  test('empty-prompt Generate offers a random prompt (#1393)', async ({
    page,
  }) => {
    await page.goto('/images');
    await waitForComposer(page);
    const generate = page.getByRole('button', { name: '生成图片' });
    await expect(generate).toBeEnabled();
    await generate.click();
    const dialog = page.getByRole('alertdialog', {
      name: '想创作什么？',
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: '随机试试' })
    ).toBeVisible();
    await dialog.getByRole('button', { name: '我自己写' }).click();
    await expect(dialog).toBeHidden();
  });

  test('Shuffle fills an empty image prompt', async ({ page }) => {
    await page.goto('/images');
    const editor = page.locator('[data-slot="markdown-editor"]');
    await expect(editor.locator('.ProseMirror')).toBeVisible({
      timeout: HYDRATION_TIMEOUT,
    });
    await expect(editor).toHaveAttribute('data-markdown', '');
    await page.getByRole('button', { name: '随机' }).click();
    await expect(editor).not.toHaveAttribute('data-markdown', '');
  });

  test('a long image prompt does not cover the gallery (#1474)', async ({
    page,
  }) => {
    await page.goto('/images');
    await waitForComposer(page);
    const editor = page.locator('[data-testid="studio-prompt"] .ProseMirror');
    const longPrompt = Array.from(
      { length: 40 },
      (_, i) =>
        `Line ${i + 1}: a detailed still that would otherwise cover the results.`
    ).join('\n');
    await editor.fill(longPrompt);

    const pane = page.getByTestId('studio-composer-pane');
    const viewport = page.viewportSize();
    const box = await pane.boundingBox();
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(
      (viewport?.height ?? 0) * 0.75
    );
    await expect(page.getByRole('link', { name: '收藏' })).toBeInViewport();
    await expect(
      page.getByRole('button', { name: '生成图片' })
    ).toBeInViewport();
  });
});
