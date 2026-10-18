import { expect, test, type Page } from '@playwright/test';

/** The step card's heading, such as "2. Fold in half" (found by its place, as its label is translated too). */
const stepHeading = (page: Page) => page.getByRole('main').getByRole('region').getByRole('heading', { level: 2 });

test.describe('viewer', () => {
  test('opens a model from the gallery and steps through it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Paper plane/ }).click();
    await expect(page).toHaveURL(/\/learn\/paper-plane/);
    await expect(stepHeading(page)).toHaveText(/^1\. /);

    await page.getByRole('button', { name: 'Next step' }).click();
    await expect(stepHeading(page)).toHaveText(/^2\. /);
    await expect(page).toHaveURL(/step=2/);

    await page.getByRole('button', { name: 'Last step' }).click();
    await expect(page.getByText('Done!')).toBeVisible();
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(stepHeading(page)).toHaveText(/^1\. /);
  });

  test('opens straight to a step from its link, and keeps it on reload', async ({ page }) => {
    await page.goto('/learn/crane?step=15');
    await expect(stepHeading(page)).toHaveText('15. Petal fold');
    await page.reload();
    await expect(stepHeading(page)).toHaveText('15. Petal fold');
  });

  test('moves between steps with the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones have no keyboard shortcuts.');
    await page.goto('/learn/cup');
    await expect(stepHeading(page)).toHaveText(/^1\. /);
    await page.keyboard.press('ArrowRight');
    await expect(stepHeading(page)).toHaveText(/^2\. /);
    await page.keyboard.press('End');
    await expect(page.getByText('Done!')).toBeVisible();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  });

  test('locks the top view, then resets it', async ({ page }) => {
    await page.goto('/learn/basics');
    await page.getByRole('button', { name: 'Top', exact: true }).click();
    await page.getByRole('button', { name: 'Lock view' }).click();
    await expect(page.getByText('View locked · drag to pan')).toBeVisible();
    await page.getByRole('button', { name: 'Lock view' }).click();
    await expect(page.getByText('View locked · drag to pan')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(page.getByRole('button', { name: 'Free', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('marks where each part of a lesson starts, and goes there', async ({ page }) => {
    await page.goto('/learn/folding-geometry');
    await expect(page.getByRole('button', { name: /^Go to: / })).toHaveCount(6);
    await page.getByRole('button', { name: /^Go to: Axiom 4/ }).click();
    await expect(stepHeading(page)).toHaveText('11. A fresh square');
  });

  test('shows the steps in the chosen language', async ({ page }) => {
    await page.goto('/learn/crane?step=15');
    await page.getByRole('combobox').selectOption('ja');
    await expect(stepHeading(page)).toHaveText('15. 花弁折り');
    await page.getByRole('combobox').selectOption('fr');
    await expect(stepHeading(page)).toHaveText('15. Pli pétale');
  });

  test('draws the finished models', async ({ page }) => {
    // The top view, locked, at the last step: the same picture every time.
    for (const [id, steps] of [
      ['paper-plane', 11],
      ['fortune-teller', 19],
    ] as const) {
      await page.goto(`/learn/${id}?step=${steps}`);
      await page.getByRole('button', { name: 'Top', exact: true }).click();
      // Let the camera settle and the paper finish drawing.
      await page.waitForTimeout(1500);
      await expect(page.locator('canvas')).toHaveScreenshot(`${id}-finished.png`);
    }
  });
});
