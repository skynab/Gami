import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

/** The step card's heading, such as "2. Fold in half" (found by its place, as its label is translated too). */
const stepHeading = (page: Page) => page.getByRole('main').getByRole('region').getByRole('heading', { level: 2 });

const card = (page: Page, title: string) => page.locator('.design-card').filter({ has: page.getByRole('link', { name: title, exact: true }) });

test.describe('studio library', () => {
  test('keeps designs in the browser, folds one, and round-trips one through a .fold file', async ({ page }) => {
    page.on('dialog', (d) => void (d.type() === 'prompt' ? d.accept('Second design') : d.accept()));

    // No account: the Studio opens straight to the library.
    await page.goto('/studio');
    await expect(page.getByRole('heading', { name: 'My designs' })).toBeVisible();
    await expect(page.getByText('No designs yet.')).toBeVisible();

    // A new design opens in the editor; back in the library it's there, and a second one, renamed.
    await page.getByRole('button', { name: 'New design' }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await page.getByRole('link', { name: 'My designs' }).click();
    await page.getByRole('button', { name: 'New design' }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await page.getByRole('link', { name: 'My designs' }).click();
    await card(page, 'Untitled model').first().getByRole('button', { name: 'Rename' }).click();
    await expect(card(page, 'Second design')).toBeVisible();

    // A model with steps, imported from a file.
    await page.locator('input[type=file]').setInputFiles('public/models/paper-plane.fold');
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await page.getByRole('link', { name: 'My designs' }).click();

    await page.reload();
    await expect(card(page, 'Untitled model')).toBeVisible();
    await expect(card(page, 'Second design')).toBeVisible();
    const plane = card(page, 'Paper plane');
    await expect(plane).toContainText(/\d+ steps/);

    // Folded in the viewer, as a gallery model is.
    await plane.getByRole('link', { name: 'Fold it' }).click();
    await expect(page).toHaveURL(/\/mine\//);
    await expect(stepHeading(page)).toHaveText(/^1\. /);
    await page.goBack();

    // Exported, deleted, imported again: the same file.
    const [download] = await Promise.all([page.waitForEvent('download'), plane.getByRole('button', { name: 'Export .fold' }).click()]);
    const exported = await download.path();
    const first = JSON.parse(await readFile(exported, 'utf8'));
    await plane.getByRole('button', { name: 'Delete' }).click();
    await expect(plane).toHaveCount(0);
    await page.locator('input[type=file]').setInputFiles({ name: 'paper-plane.fold', mimeType: 'application/json', buffer: await readFile(exported) });
    await page.getByRole('link', { name: 'My designs' }).click();
    const [again] = await Promise.all([page.waitForEvent('download'), card(page, 'Paper plane').getByRole('button', { name: 'Export .fold' }).click()]);
    expect(JSON.parse(await readFile(await again.path(), 'utf8'))).toEqual(first);
  });

  test('moves the old single draft into the library', async ({ page }) => {
    const fold = JSON.parse(await readFile('public/models/cup.fold', 'utf8'));
    await page.addInitScript((f) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('gami.studio.draft', JSON.stringify({ fold: f, cloud: null, dirty: true }));
        sessionStorage.setItem('seeded', '1');
      }
    }, fold);
    await page.goto('/studio');
    await expect(card(page, fold.file_title)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('gami.studio.draft'))).toBeNull();
    await page.reload();
    await expect(card(page, fold.file_title)).toHaveCount(1);
  });
});
