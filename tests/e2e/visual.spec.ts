import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrollThrough } from './helpers';

// Screenshots for human review, written outside the repo: sunn-side/reports/screenshots.
const SHOTS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../reports/screenshots');
const KEY = ['./', './services/', './services/brakes-air-systems/', './roadside-assistance/', './request-service/', './contact/', './about/', './gallery/'];

test.describe('screenshots for review', () => {
  for (const path of KEY) {
    for (const width of [390, 1280]) {
      test(`${path} at ${width}px`, async ({ page }) => {
        mkdirSync(SHOTS, { recursive: true });
        await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
        await page.goto(path);
        await scrollThrough(page);
        await page.waitForLoadState('networkidle');
        const name = (path.replace(/[./]/g, '-').replace(/^-+|-+$/g, '') || 'home') + `-${width}`;
        await page.screenshot({ path: `${SHOTS}/${name}-fold.png` });
        await page.screenshot({ path: `${SHOTS}/${name}-full.png`, fullPage: true });
      });
    }
  }
});
