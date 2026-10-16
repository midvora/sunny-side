import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WIDTHS = [320, 360, 390, 768, 1280];
const SHOTS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../reports/screenshots'); // outside the repo, in sunn-side/reports

test.describe('concept guardrails', () => {
  test('is noindex and robots.txt blocks all crawlers', async ({ page, request }) => {
    await page.goto('./');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const robots = await request.get('robots.txt');
    expect(await robots.text()).toContain('Disallow: /');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });

  test('makes zero third-party requests and loads no external fonts', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const external: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== origin) external.push(u);
    });
    await page.goto('./');
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
  });

  test('has no invented phone number: no tel: link, no phone-like or price-like text', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.sr-only, script, style').forEach((n) => n.remove());
      return clone.innerText;
    });
    expect(text).not.toMatch(/\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/); // phone-like
    expect(text).not.toMatch(/\$\s?\d/); // prices
  });

  test('makes none of the claims the brief forbids, outside marked placeholders', async ({ page }) => {
    await page.goto('./');
    const text = (
      await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.sr-only, script, style, mark.tbc').forEach((n) => n.remove());
        return clone.innerText;
      })
    ).toLowerCase();
    const forbidden = [
      '24/7', '24-hour', '24 hour', 'open 24', 'free estimate', 'free quote', 'guarantee', 'lifetime',
      'years of experience', 'family-owned', 'family owned', 'since 19', 'since 20', 'locally owned',
      'best ', '#1', 'fully licensed', 'fully insured', 'licensed and insured', 'certified technicians',
      'ase certified', 'trusted by', 'satisfied customers', 'before and after',
    ];
    const hits = forbidden.filter((w) => text.includes(w));
    // "before-and-after shots only appear with permission" is the one permitted mention (a promise about photo policy, not a result).
    expect(hits.filter((h) => h !== 'before and after')).toEqual([]);
  });

  test('every unconfirmed placeholder is announced to screen readers', async ({ page }) => {
    await page.goto('./');
    const marks = page.locator('mark.tbc');
    const n = await marks.count();
    expect(n).toBeGreaterThan(10);
    for (let i = 0; i < n; i++) {
      await expect(marks.nth(i).locator('.sr-only')).toHaveText(/unconfirmed placeholder/);
    }
  });

  test('call buttons are honest while the number is unconfirmed', async ({ page }) => {
    await page.goto('./');
    const calls = page.locator('a.btn--call');
    expect(await calls.count()).toBeGreaterThanOrEqual(3);
    for (const a of await calls.all()) {
      await expect(a).toHaveAttribute('href', '#contact');
      await expect(a).toContainText('number pending');
      await expect(a).not.toHaveAttribute('aria-label', /.+/); // visible text is the accessible name (WCAG 2.5.3)
    }
  });
});

test.describe('client logo and address', () => {
  const ADDRESS = '2605 Oakland Ave., Garland, TX 75041';

  test('header logo is the client logo: loads, has alt text and reserved size', async ({ page }) => {
    await page.goto('./');
    const logo = page.locator('header .brand__logo');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('alt', /Sunny Side.*Truck and trailer repair.*Roadside assistance/);
    expect(await logo.getAttribute('width')).toBeTruthy(); // width/height attributes prevent layout shift
    expect(await logo.getAttribute('height')).toBeTruthy();
    expect(await page.locator('img').count()).toBeGreaterThanOrEqual(2); // header + footer
    await page.locator('.site-footer').scrollIntoViewIfNeeded(); // the footer logo is lazy-loaded
    await expect
      .poll(() => page.$$eval('img', (imgs) => imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).length))
      .toBe(0);
  });

  test('address appears as confirmed text (not a placeholder) in the contact card and footer', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#contact address')).toHaveText(ADDRESS);
    await expect(page.locator('.site-footer address')).toHaveText(ADDRESS);
    await expect(page.locator('#contact address mark, .site-footer address mark')).toHaveCount(0);
    await expect(page).toHaveTitle(/Garland, Texas/);
  });

  test('directions link points at the exact address and is explained to screen readers', async ({ page }) => {
    await page.goto('./');
    const link = page.getByRole('link', { name: /get directions/i });
    await expect(link).toHaveAttribute('href', `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}`);
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toContainText('opens Google Maps in a new tab');
  });

  test('does not say Dallas anywhere: the supplied address is in Garland', async ({ page }) => {
    await page.goto('./');
    const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();
    expect(text).not.toContain('dallas');
  });
});

test.describe('request form is a non-submitting preview', () => {
  test('invalid submit shows nothing; valid submit shows the preview notice and sends nothing', async ({ page }) => {
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' || r.url().includes('?')) sent.push(`${r.method()} ${r.url()}`);
    });
    await page.goto('./');
    const url = page.url();
    const status = page.locator('#request-status');

    await page.getByRole('button', { name: /send request/i }).click();
    await expect(status).toBeHidden();

    await page.getByLabel('Your name').fill('Test Driver');
    await page.getByLabel('Mobile phone').fill('not a real number');
    await page.getByLabel('What needs work?').selectOption({ index: 1 });
    await page.getByLabel('What is it doing?').fill('test');
    await page.getByLabel('Where is the unit now?').fill('test');
    await page.getByLabel('Down now').check();
    await page.getByRole('button', { name: /send request/i }).click();

    await expect(status).toBeVisible();
    await expect(status).toContainText('Nothing was sent');
    await expect(status).toBeFocused();
    expect(page.url()).toBe(url);
    expect(sent).toEqual([]);
  });

  test('every control has an accessible name', async ({ page }) => {
    await page.goto('./');
    for (const label of ['Your name', 'Mobile phone', 'What needs work?', 'What is it doing?', 'Where is the unit now?']) {
      await expect(page.getByLabel(label)).toHaveCount(1);
    }
    await expect(page.getByRole('group', { name: 'How urgent is it?' })).toBeVisible();
  });
});

test.describe('accessibility (axe, WCAG 2.0 to 2.2 A and AA)', () => {
  for (const width of [360, 768, 1280]) {
    for (const path of ['./', './404.html']) {
      test(`no violations at ${width}px on ${path}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
        expect(summary).toEqual([]);
      });
    }
  }

  test('keyboard: skip link is first, focus is always visible, mobile menu opens', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip')).toBeFocused();

    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          label: (el.getAttribute('aria-label') || el.textContent || el.id || '').trim().slice(0, 30),
          outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
          visible: r.width > 0 && r.height > 0,
        };
      });
      if (!info) continue;
      expect(info.visible, `focused element is visible: ${info.label}`).toBe(true);
      expect(info.outline, `focus ring on ${info.tag} "${info.label}"`).toBe(true);
      seen.push(info.tag);
    }
    expect(seen.length).toBeGreaterThan(20);

    await page.locator('.menu summary').click();
    await expect(page.locator('.menu__list')).toBeVisible();
  });
});

test.describe('layout', () => {
  for (const width of WIDTHS) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('./');
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('tap targets are at least 44px on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    const small = await page.evaluate(() => {
      const out: string[] = [];
      const sel = '.btn, summary, input:not([type=radio]), select, textarea, .radio';
      document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.height < 44 || r.width < 44) out.push(`${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
      });
      return out;
    });
    expect(small).toEqual([]);
  });

  test('sticky action bar shows on phones, hides on desktop, and does not cover the footer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    await expect(page.locator('.bar')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const clear = await page.evaluate(() => {
      const f = document.querySelector('.site-footer')!.getBoundingClientRect();
      const b = document.querySelector('.bar')!.getBoundingClientRect();
      return f.bottom <= b.top + 1; // footer ends above the bar: nothing hidden behind it
    });
    expect(clear).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.bar')).toBeHidden();
  });

  test('headings are in a sensible order with a single h1', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('h1')).toHaveCount(1);
    const levels = await page.$$eval('h1,h2,h3', (els) => els.map((e) => Number(e.tagName[1])));
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });
});

test.describe('screenshots for review', () => {
  for (const width of [360, 390, 768, 1280]) {
    test(`capture ${width}px`, async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
      await page.goto('./');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${SHOTS}/home-${width}-fold.png` });
      await page.screenshot({ path: `${SHOTS}/home-${width}-full.png`, fullPage: true });
    });
  }
});
