/**
 * Shared Add Talent dialog helpers for talent-page and sequence-page e2e.
 */

import { expect, type Locator, type Page } from 'playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  fillScriptEditor,
  openComposerReference,
  waitForHydration,
  waitForLibraryPageLoad,
  waitForUploadComplete,
} from './test-utils';

// Named uploads send the REAL bytes of that fixture file (`test-image.jpg` is a
// photo, `character-sheet.jpg` a stylised robot sheet, `creature.jpg` a forest
// spirit), so the recorded vision answers are what the model actually said
// about each image — not one photo relabelled three ways.
function fixtureImage(filename: string): Buffer {
  return readFileSync(path.join(import.meta.dirname, filename));
}

export function uniqueTalentName(label: string): string {
  return `E2E ${label} ${crypto.randomUUID().slice(0, 8)}`;
}

export function addTalentDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: '添加演员' });
}

export async function openAddTalentFromLibrary(page: Page): Promise<Locator> {
  await page.goto('/talent');
  await waitForLibraryPageLoad(page, '添加演员');
  await page.getByRole('button', { name: '添加演员' }).first().click();
  const dialog = addTalentDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function openAddTalentFromSequence(page: Page): Promise<{
  picker: Locator;
  dialog: Locator;
}> {
  await page.goto('/films/new');
  // TipTap only mounts after hydration. Filling a short script is the same
  // live-state gate sequence-flow.spec uses — Generate-enabled is the wrong
  // proxy here. Sample seeding on signed-in `/films/new` is racy (styles
  // are not SSR-prefetched), and a tile click does not write a script unless
  // the sample is already attached, so Generate can stay disabled forever.
  await fillScriptEditor(
    page,
    'INT. STUDIO - DAY\n\nA person looks at the camera.'
  );
  await openComposerReference(page, '演员');
  // DialogTitle is not always the accessible name; match on the heading copy.
  const picker = page.getByRole('dialog').filter({ hasText: '选择演员' });
  await expect(picker).toBeVisible({ timeout: 10_000 });
  await picker.getByRole('button', { name: '添加演员' }).last().click();
  const dialog = addTalentDialog(page);
  await expect(dialog).toBeVisible();
  return { picker, dialog };
}

export async function uploadNamedTalentImage(
  page: Page,
  filename: string
): Promise<void> {
  const dialog = addTalentDialog(page);
  await waitForHydration(page);
  const fileChooserPromise = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: '浏览文件' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: filename,
    mimeType: 'image/jpeg',
    buffer: fixtureImage(filename),
  });
  await waitForUploadComplete(page);
}

// Drag-and-drop path (vs. the file chooser above): the dialog is a portal, so
// the drop also bubbles to the composer's whole-page element dropzone (#1269).
export async function dropNamedTalentImage(
  page: Page,
  filename: string
): Promise<void> {
  const dataTransfer = await page.evaluateHandle(
    ({ b64, name }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: 'image/jpeg' }));
      return dt;
    },
    { b64: fixtureImage(filename).toString('base64'), name: filename }
  );
  await addTalentDialog(page)
    .getByText('拖放或粘贴')
    .dispatchEvent('drop', { dataTransfer });
  await waitForUploadComplete(page);
}

// The classifier's verdict, shown read-only (#1581): the server derives
// isHuman from the likeness ledger, so there is nothing to toggle.
export async function waitForSubjectKind(
  page: Page,
  kind: '真人' | '动画角色' | '其他'
): Promise<Locator> {
  const badge = addTalentDialog(page).getByTestId('subject-kind');
  await expect(badge).toHaveText(kind, { timeout: 15_000 });
  return badge;
}

export async function attestPortraitRights(page: Page): Promise<void> {
  const dialog = addTalentDialog(page);
  await dialog.getByRole('checkbox', { name: /使用此人肖像的授权/ }).check();
  await dialog
    .getByLabel('授权依据')
    .fill('E2E fixture image — synthetic, depicts no real person');
}

export async function submitAddTalent(page: Page): Promise<void> {
  const dialog = addTalentDialog(page);
  await dialog.getByRole('button', { name: '添加演员' }).click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });
}
