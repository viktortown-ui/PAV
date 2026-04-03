import { expect, test } from '@playwright/test';

test('simulation and schematic snapshots', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(page).toHaveScreenshot('simulation-mode.png', { fullPage: true, maxDiffPixelRatio: 0.02 });

  await page.click('.react-flow__pane', { button: 'right' });
  await page.waitForTimeout(350);
  await expect(page).toHaveScreenshot('simulation-context-menu.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /Схема/i }).click();
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot('schematic-mode.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('schematic-dense-labels.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
});
