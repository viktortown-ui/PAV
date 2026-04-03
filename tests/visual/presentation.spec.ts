import { expect, test } from '@playwright/test';

test('simulation and schematic snapshots', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(page.getByText('Режим схемы', { exact: false })).toHaveCount(0);
  await expect(page).toHaveScreenshot('simulation-mode.png', { fullPage: true, maxDiffPixelRatio: 0.02 });

  await page.click('.react-flow__pane', { button: 'right' });
  await page.waitForTimeout(350);
  const menuBox = await page.locator('.context-menu').boundingBox();
  expect(menuBox).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (menuBox && viewport) {
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
  }
  await expect(page).toHaveScreenshot('simulation-context-menu.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /Схема/i }).click();
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot('schematic-mode.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('schematic-dense-labels.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test('ui smoke: mode switch, inspector and canvas stay stable', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1200);
  const canvas = page.locator('.react-flow__renderer');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: /Симуляция/i })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: /Схема/i }).click();
  await expect(page.getByRole('button', { name: /Схема/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.shell-right-drawer')).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(page.locator('.react-flow__pane')).toBeVisible();
});
