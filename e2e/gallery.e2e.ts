import { expect, test } from '@playwright/test';

test.describe('gallery', () => {
  test('lists the models, and filters them', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Learn to fold' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Crane/ })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Search models' }).fill('frog');
    await expect(page.getByRole('link', { name: /Jumping frog/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Crane/ })).toHaveCount(0);

    await page.getByRole('searchbox', { name: 'Search models' }).fill('');
    await page.getByRole('button', { name: 'Lessons' }).click();
    await expect(page.getByRole('link', { name: /^Lesson Basics/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Geometry by folding/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Crane/ })).toHaveCount(0);
  });

  test('picks out the new models, each with a star', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New', exact: true }).click();
    const crown = page.getByRole('link', { name: /Crown/ });
    await expect(crown).toBeVisible();
    await expect(crown.locator('.new-star')).toBeVisible();
    await expect(page.getByRole('link', { name: /Crane/ })).toHaveCount(0);
  });

  test('plays a preview while a card is hovered', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones have no hover.');
    await page.goto('/');
    const card = page.getByRole('link', { name: /Paper plane/ });
    await card.hover();
    await expect(card.locator('img.card-preview.playing')).toBeVisible();
    await page.getByRole('heading', { name: 'Learn to fold' }).hover();
    await expect(card.locator('img.card-preview.playing')).toHaveCount(0);
  });

  test('shows each finished model on its card', async ({ page }) => {
    await page.goto('/');
    for (const name of ['Fortune teller', 'Crane', 'Lily']) {
      const thumb = page.getByRole('link', { name: new RegExp(name) }).locator('.card-thumb');
      await thumb.scrollIntoViewIfNeeded();
      await expect(thumb).toHaveScreenshot(`${name.toLowerCase().replace(' ', '-')}-card.png`);
    }
  });
});
