import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ALL_PAGES, BANNED_PHRASES, PHONE_TEL, scrollThrough, visibleText } from './helpers';

test.describe('every page', () => {
  for (const path of ALL_PAGES) {
    test(`${path}: structure, privacy and content rules`, async ({ page, baseURL }) => {
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      const origin = new URL(baseURL!).origin;
      const external: string[] = [];
      page.on('request', (r) => {
        const u = r.url();
        if (!/^(data|blob):/.test(u) && new URL(u).origin !== origin) external.push(u);
      });

      const res = await page.goto(path);
      expect(res!.ok()).toBe(true);
      await scrollThrough(page);
      await page.waitForLoadState('networkidle');

      // structure
      await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);
      expect((await page.title()).length).toBeGreaterThan(10);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0); // structured data only in launch builds

      // privacy and performance promises
      expect(external, 'no third-party requests on load').toEqual([]);
      expect(errors, 'no console errors').toEqual([]);

      // images
      // images inside closed menus load when the menu opens (they are lazy), so only visible-in-flow images are checked
      const imgs = await page.$$eval('img', (list) =>
        list
          .filter((i) => !i.closest('[hidden], dialog:not([open])') || i.loading === 'eager')
          .map((i) => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0, alt: i.getAttribute('alt') })),
      );
      expect(imgs.filter((i) => !i.ok), 'every image loaded').toEqual([]);
      expect(imgs.filter((i) => i.alt === null), 'every image has an alt attribute').toEqual([]);

      // content rules: it reads like a real site
      const text = (await visibleText(page)).toLowerCase();
      for (const phrase of BANNED_PHRASES) expect(text, `page must not say "${phrase}"`).not.toContain(phrase);
      expect(text).toContain('website design preview by midvora');
      expect(text).not.toContain('dallas, texas'); // the supplied address is in Garland

      // contact links stay consistent
      for (const href of await page.$$eval('a[href^="tel:"]', (as) => as.map((a) => a.getAttribute('href')))) expect(href).toBe(PHONE_TEL);
      for (const rel of await page.$$eval('a[target="_blank"]', (as) => as.map((a) => a.getAttribute('rel') ?? ''))) expect(rel).toContain('noopener');

      // layout: no horizontal scroll from phone to desktop
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `no horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('titles and meta descriptions are unique and a sensible length', async ({ request }) => {
    const seenTitles = new Map<string, string>();
    const seenDescriptions = new Map<string, string>();
    for (const path of ALL_PAGES.filter((p) => !p.includes('404'))) {
      const html = await (await request.get(path)).text();
      const title = html.match(/<title>([^<]*)<\/title>/)![1];
      const desc = html.match(/<meta name="description" content="([^"]*)"/)![1];
      expect(title.length, `${path} title length`).toBeGreaterThan(15);
      expect(title.length, `${path} title length`).toBeLessThan(95);
      expect(desc.length, `${path} description length`).toBeGreaterThan(50);
      expect(desc.length, `${path} description length`).toBeLessThan(260);
      expect(seenTitles.get(title), `duplicate title: ${title}`).toBeUndefined();
      expect(seenDescriptions.get(desc), `duplicate description on ${path}`).toBeUndefined();
      seenTitles.set(title, path);
      seenDescriptions.set(desc, path);
    }
  });

  test('robots.txt blocks crawlers and the sitemap is empty in the concept build', async ({ request }) => {
    expect(await (await request.get('robots.txt')).text()).toContain('Disallow: /');
    expect(await (await request.get('sitemap.xml')).text()).not.toContain('<loc>');
  });
});

test.describe('accessibility (axe, WCAG 2.0 to 2.2 A and AA plus best practice)', () => {
  for (const path of ALL_PAGES) {
    for (const width of [390, 1280]) {
      test(`${path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await scrollThrough(page);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(summary).toEqual([]);
      });
    }
  }
});
