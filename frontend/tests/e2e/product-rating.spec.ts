import { expect, test } from '@playwright/test';

test.describe('Product ratings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('h1:has-text("Products")')).toBeVisible();
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.locator('h3:has-text("SmartFeeder One")')).toBeVisible();
  });

  test('submit and remove a product rating', async ({ page }) => {
    await page.locator('img[alt="SmartFeeder One"]').click();
    await expect(page.getByRole('heading', { name: 'Rate this product' })).toBeVisible();

    await page.getByRole('radio', { name: 'Choose a product score: 5 out of 5' }).click();
    await page.getByRole('button', { name: 'Submit rating' }).click();

    await expect(page.getByRole('heading', { name: 'Your rating' })).toBeVisible();
    await expect(page.getByText('Your rating was submitted.')).toBeVisible();
    await expect(page.locator('h3:has-text("SmartFeeder One")').locator('..')).toContainText('5.0');
    await expect(page.getByRole('button', { name: 'Update rating' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove rating' })).toBeVisible();

    await page.getByRole('button', { name: 'Update rating' }).click();
    await page.getByRole('radio', { name: 'Choose a product score: 4 out of 5' }).click();
    await page.getByRole('button', { name: 'Save rating' }).click();
    await expect(page.getByText('Your rating was updated.')).toBeVisible();
    await expect(page.locator('h3:has-text("SmartFeeder One")').locator('..')).toContainText('4.0');

    await page.getByRole('button', { name: 'Remove rating' }).click();
    await expect(page.getByText('No ratings yet').first()).toBeVisible();
  });

  test('rating controls remain accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.locator('img[alt="SmartFeeder One"]').click();

    const ratingForm = page.locator('[aria-labelledby="rating-form-title-1"]');
    await expect(ratingForm).toBeVisible();
    await expect(ratingForm.getByRole('radiogroup')).toBeVisible();
    await expect(ratingForm.getByRole('radio', { name: 'Choose a product score: 5 out of 5' })).toBeVisible();

    const formBox = await ratingForm.boundingBox();
    expect(formBox).not.toBeNull();
    expect(formBox?.x).toBeGreaterThanOrEqual(0);
    expect((formBox?.x ?? 0) + (formBox?.width ?? 0)).toBeLessThanOrEqual(375);
  });
});
