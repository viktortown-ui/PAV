import { expect, test } from '@playwright/test';

test('simulation and schematic snapshots', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(page).toHaveScreenshot('simulation-mode.png', { fullPage: true, maxDiffPixelRatio: 0.02 });

  await page.getByRole('button', { name: /Схема/i }).click();
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot('schematic-mode.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
});
