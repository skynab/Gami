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

    // Half a step at a time: halfway through step 3, then to its end.
    const progress = page.getByRole('slider', { name: 'Progress through the steps' });
    await expect(progress).toHaveValue('2');
    await page.getByRole('button', { name: 'Play half a step' }).click();
    await expect(progress).toHaveValue('2.5');
    await expect(stepHeading(page)).toHaveText(/^3\. /);
    await page.getByRole('button', { name: 'Play half a step' }).click();
    await expect(progress).toHaveValue('3');

    await page.keyboard.press('End');
    await expect(page.getByText('Done!')).toBeVisible();
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(stepHeading(page)).toHaveText(/^1\. /);
  });

  test('plays on through the steps while next is held, and pauses on a click', async ({ page }) => {
    await page.goto('/learn/cup');
    await expect(stepHeading(page)).toHaveText(/^1\. /);
    const next = page.getByRole('button', { name: 'Next step' });
    await next.hover();
    await page.mouse.down();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.mouse.up();
    // Held, not clicked: it plays from step 2 on, without skipping a step.
    await expect(stepHeading(page)).toHaveText(/^2\. /);
    await expect(stepHeading(page)).toHaveText(/^3\. /);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Next step' })).toBeVisible();
    await page.getByRole('button', { name: 'Replay this step' }).click();
    await expect(page.getByRole('button', { name: 'Next step' })).toBeVisible();
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

  test('locks the top view, then resets it', async ({ page, isMobile }) => {
    await page.goto('/learn/basics');
    // On a phone the view controls are tucked away behind a button.
    if (isMobile) await page.getByRole('button', { name: 'View controls' }).click();
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
    await expect(page.getByRole('button', { name: /^Go to: / })).toHaveCount(8);
    await page.getByRole('button', { name: /^Go to: Axiom 4/ }).click();
    await expect(stepHeading(page)).toHaveText('13. Axiom 4: Square to a line: A fresh square');
  });

  test('shows the steps in the chosen language', async ({ page }) => {
    await page.goto('/learn/crane?step=15');
    await page.getByRole('combobox').selectOption('ja');
    await expect(stepHeading(page)).toHaveText('15. 花弁折り');
    await page.getByRole('combobox').selectOption('fr');
    await expect(stepHeading(page)).toHaveText('15. Pli pétale');
  });

  test('draws the finished models', async ({ page, isMobile }) => {
    // The top view, locked, at the last step: the same picture every time.
    for (const [id, steps] of [
      ['paper-plane', 13],
      ['fortune-teller', 19],
    ] as const) {
      await page.goto(`/learn/${id}?step=${steps}`);
      if (isMobile) await page.getByRole('button', { name: 'View controls' }).click();
      await page.getByRole('button', { name: 'Top', exact: true }).click();
      // Tucked away again, so the controls don't cover the paper.
      if (isMobile) await page.getByRole('button', { name: 'View controls' }).click();
      // Let the camera settle and the paper finish drawing.
      await page.waitForTimeout(1500);
      await expect(page.locator('canvas')).toHaveScreenshot(`${id}-finished.png`);
    }
  });
});
