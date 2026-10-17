import { test, expect } from '@playwright/test';
import { ADDRESS, PHONE_TEL, scrollThrough } from './helpers';

const SERVICES = 9;

test.describe('header and navigation', () => {
  test('the services mega menu opens, lists every service, closes on Escape and returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./');
    const toggle = page.getByRole('button', { name: 'Show all services' });
    const panel = page.locator('#mega-services');
    await expect(panel).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.mega__group a')).toHaveCount(SERVICES);
    await expect(panel.getByRole('link', { name: 'See all services' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('clicking outside closes the menu, and the About dropdown has its pages', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./');
    await page.getByRole('button', { name: 'Show all services' }).click();
    await page.mouse.click(640, 785); // below the open panel
    await expect(page.locator('#mega-services')).toBeHidden();
    await page.getByRole('button', { name: 'Show About submenu' }).click();
    await expect(page.locator('#menu-about a')).toHaveText([/About Sunny Side/, /Gallery/, /Service area/, /FAQ/]);
  });

  test('the mobile drawer opens as a modal, lists every page and closes with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    const open = page.getByRole('button', { name: 'Open menu' });
    await open.click();
    const drawer = page.locator('#drawer');
    await expect(drawer).toBeVisible();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await drawer.locator('summary').click();
    await expect(drawer.locator('details a')).toHaveCount(SERVICES + 1); // services + "All services"
    for (const name of ['Roadside Assistance', 'Fleet Services', 'About', 'Gallery', 'Resources', 'Service area', 'FAQ', 'Contact']) {
      await expect(drawer.locator('.drawer__list > li > a', { hasText: name })).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(open).toBeFocused();
  });

  test('a drawer link navigates and closes the drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.locator('#drawer').getByRole('link', { name: 'Contact' }).click();
    await expect(page).toHaveURL(/contact\/$/);
    await expect(page.locator('#drawer')).toBeHidden();
  });

  test('skip link is first, and keyboard focus is always visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip')).toBeFocused();
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        // stretched card links draw their focus ring around the whole card, so the ring may sit on an ancestor
        const hasRing = (n: Element) => {
          const cs = getComputedStyle(n);
          return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
        };
        const host = el.closest('.scard, .rcard');
        return { label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), ring: hasRing(el) || (host ? hasRing(host) : false), visible: r.width > 0 && r.height > 0 };
      });
      if (!info) continue;
      expect(info.visible, `focused element is visible: ${info.label}`).toBe(true);
      expect(info.ring, `focus ring on "${info.label}"`).toBe(true);
    }
  });

  test('the current page is marked in the navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./roadside-assistance/');
    await expect(page.locator('.nav__link[aria-current="page"]')).toHaveText(/Roadside Assistance/);
    await page.goto('./services/brakes-air-systems/');
    await expect(page.locator('.nav__link[data-active]').first()).toHaveText('Services');
  });
});

test.describe('open and closed status (shop time zone)', () => {
  test('shows "open now" on a weekday morning and highlights today', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-19T15:00:00Z')); // Monday 10:00 in Garland
    await page.goto('./contact/');
    await expect(page.locator('[data-open-status]').first()).toHaveText('Open now · closes 6 PM');
    await expect(page.locator('[data-open-dot]').first()).toHaveClass(/is-open/);
    await expect(page.locator('[data-hours-table] tr.is-today')).toHaveAttribute('data-day', 'mon');
  });

  test('shows "closed, opens tomorrow" on Sunday', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-25T17:00:00Z'));
    await page.goto('./');
    await expect(page.locator('[data-open-status]').first()).toHaveText('Closed · opens 7 AM tomorrow');
  });
});

test.describe('request service form', () => {
  const need = (page: import('@playwright/test').Page, name: string) => page.locator('label.choice', { hasText: name });

  test('walks three steps with validation, then shows a demo confirmation that sends nothing', async ({ page }) => {
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET') sent.push(`${r.method()} ${r.url()}`);
    });
    await page.goto('./request-service/');
    const form = page.locator('#request-form');
    const next = form.locator('[data-next]');
    const back = form.locator('[data-back]');
    const submit = form.locator('[data-submit]');

    // step 1
    await expect(form.locator('[data-step="1"]')).toBeVisible();
    await expect(form.locator('[data-step="2"]')).toBeHidden();
    await expect(back).toBeHidden();
    await expect(submit).toBeHidden();
    await next.click();
    await expect(form.locator('#rf-need-err')).toBeVisible();
    await need(page, 'Roadside help').click();
    await next.click();

    // step 2
    await expect(form.locator('[data-step="2"]')).toBeVisible();
    await expect(back).toBeVisible();
    await next.click();
    await expect(form.locator('#rf-equipment-err')).toBeVisible();
    await expect(page.locator('#rf-equipment')).toBeFocused();
    await expect(form.locator('#rf-details-err')).toBeVisible();
    await page.selectOption('#rf-equipment', 'Tractor (semi)');
    await form.locator('label.pill', { hasText: 'Flat or blown tire' }).click();
    await next.click();

    // step 3
    await expect(form.locator('[data-step="3"]')).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(next).toBeHidden();
    await submit.click();
    await expect(form.locator('#rf-location-err')).toBeVisible();
    await expect(form.locator('#rf-name-err')).toBeVisible();
    await expect(form.locator('#rf-phone-err')).toBeVisible();
    await expect(form.locator('#rf-consent-err')).toBeVisible();
    await expect(page.locator('#rf-location')).toBeFocused();
    await expect(page.locator('#rf-name')).toHaveAttribute('aria-invalid', 'true');

    await page.fill('#rf-location', 'I-635 eastbound near exit 11');
    await page.fill('#rf-name', 'Test Driver');
    await page.fill('#rf-phone', '12345');
    await page.fill('#rf-email', 'not-an-email');
    await form.locator('.check').click();
    await submit.click();
    await expect(form.locator('#rf-phone-err')).toContainText('area code');
    await expect(form.locator('#rf-email-err')).toBeVisible();
    await page.fill('#rf-phone', '(214) 555-0100');
    await page.fill('#rf-email', '');
    await submit.click();

    // success, in demo mode
    const success = form.locator('[data-success]');
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
    await expect(success).toContainText('Request received, Test');
    await expect(success.locator('[data-demo-note]')).toBeVisible();
    await expect(success.locator('[data-demo-note]')).toContainText('no request was actually sent');
    expect(sent, 'the demo form must not send anything').toEqual([]);
  });

  test('Back keeps what you typed, and the progress bar tracks the step', async ({ page }) => {
    await page.goto('./request-service/');
    const form = page.locator('#request-form');
    await need(page, 'DOT inspection').click();
    await form.locator('[data-next]').click();
    await page.fill('#rf-model', '2019 Freightliner Cascadia');
    await expect(form.locator('[data-progress-step="2"]')).toHaveAttribute('aria-current', 'step');
    await form.locator('[data-back]').click();
    await expect(form.locator('[data-progress-step="1"]')).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('input[name="need"][value="inspection"]')).toBeChecked();
    await form.locator('[data-next]').click();
    await expect(page.locator('#rf-model')).toHaveValue('2019 Freightliner Cascadia');
  });

  test('?need=roadside pre-selects roadside help', async ({ page }) => {
    await page.goto('./request-service/?need=roadside');
    await expect(page.locator('input[name="need"][value="roadside"]')).toBeChecked();
  });

  test.describe('"Use my location"', () => {
    test.use({ geolocation: { latitude: 32.8761, longitude: -96.67, accuracy: 20 }, permissions: ['geolocation'] });
    test('fills the location from the device', async ({ page }) => {
      await page.goto('./request-service/');
      const form = page.locator('#request-form');
      await need(page, 'Roadside help').click();
      await form.locator('[data-next]').click();
      await page.selectOption('#rf-equipment', 'Tractor (semi)');
      await form.locator('label.pill', { hasText: 'Overheating' }).click();
      await form.locator('[data-next]').click();
      await page.getByRole('button', { name: 'Use my location' }).click();
      await expect(page.locator('#rf-location')).toHaveValue(/32\.8761.*-96\.67/);
      await expect(page.locator('input[name="lat"]')).toHaveValue('32.8761');
      await expect(page.locator('input[name="mapsLink"]')).toHaveValue(/google\.com\/maps\?q=32\.876100,-96\.670000/);
    });
  });

  test('a blocked location is explained and the field stays usable', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_ok, fail) => fail?.({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3, POSITION_UNAVAILABLE: 2, message: 'denied' } as GeolocationPositionError);
    });
    await page.goto('./request-service/');
    const form = page.locator('#request-form');
    await need(page, 'Roadside help').click();
    await form.locator('[data-next]').click();
    await page.selectOption('#rf-equipment', 'Tractor (semi)');
    await form.locator('label.pill', { hasText: 'Overheating' }).click();
    await form.locator('[data-next]').click();
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.locator('[data-location-note]')).toContainText('blocked in your browser');
    await expect(page.locator('#rf-location')).toBeEditable();
  });
});

test.describe('roadside page', () => {
  test.use({ geolocation: { latitude: 32.8761, longitude: -96.67, accuracy: 15 }, permissions: ['geolocation'] });

  test('shows the roadside number and a tappable call button', async ({ page }) => {
    await page.goto('./roadside-assistance/');
    await expect(page.locator('.callcard__number')).toHaveText('972-555-0142');
    await expect(page.locator('.callcard__number')).toHaveAttribute('href', PHONE_TEL);
    await expect(page.locator('#breakdown-checklist li')).toHaveCount(6);
  });

  test('finds the visitor, then offers text, maps and copy', async ({ page }) => {
    await page.goto('./roadside-assistance/');
    const tool = page.locator('[data-location-tool]');
    await expect(tool.locator('[data-locate-result]')).toBeHidden();
    await tool.getByRole('button', { name: 'Find my location' }).click();
    await expect(tool.locator('[data-locate-coords]')).toContainText('32.87610, -96.67000');
    await expect(tool.locator('[data-locate-sms]')).toHaveAttribute('href', /^sms:\+19725550142\?&body=/);
    await expect(tool.locator('[data-locate-sms]')).toHaveAttribute('href', /google\.com%2Fmaps%3Fq%3D32\.876100%2C-96\.670000/);
    await expect(tool.locator('[data-locate-open]')).toHaveAttribute('href', /google\.com\/maps\?q=32\.876100,-96\.670000/);
    await expect(tool.locator('[data-locate-status]')).toContainText('Got it');
  });

  test('the print button prints the checklist', async ({ page }) => {
    await page.goto('./roadside-assistance/');
    await page.evaluate(() => {
      (window as unknown as { __printed: boolean }).__printed = false;
      window.print = () => { (window as unknown as { __printed: boolean }).__printed = true; };
    });
    await page.getByRole('button', { name: 'Print this checklist' }).click();
    expect(await page.evaluate(() => (window as unknown as { __printed: boolean }).__printed)).toBe(true);
  });
});

test.describe('contact page', () => {
  test('lists phone, email, address and directions, and loads the map only on request', async ({ page }) => {
    await page.route('https://www.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>map</body></html>' }));
    await page.goto('./contact/');
    await expect(page.locator('.info address')).toHaveText(ADDRESS);
    await expect(page.getByRole('link', { name: /^Get directions/ }).first()).toHaveAttribute('href', `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}`);
    await expect(page.locator('a[href^="mailto:"]').first()).toHaveAttribute('href', 'mailto:service@sunnysidetruckandtrailer.com');
    await expect(page.locator('.map iframe')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show map' }).click();
    const frame = page.locator('.map iframe');
    await expect(frame).toHaveAttribute('src', /^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=.*marker=32\.87607%2C-96\.66998$/);
    await expect(frame).toHaveAttribute('title', new RegExp(`Map showing Sunny Side at ${ADDRESS.replace('.', '\\.')}`));
  });

  test('the message form validates, then confirms in demo mode', async ({ page }) => {
    const sent: string[] = [];
    page.on('request', (r) => r.method() !== 'GET' && sent.push(r.url()));
    await page.goto('./contact/');
    const form = page.locator('#contact-form');
    await form.locator('[data-submit]').click();
    await expect(form.locator('#cf-name-err')).toBeVisible();
    await expect(form.locator('#cf-email-err')).toBeVisible();
    await expect(form.locator('#cf-message-err')).toBeVisible();
    await expect(page.locator('#cf-name')).toBeFocused();
    await page.fill('#cf-name', 'Pat Driver');
    await page.fill('#cf-email', 'pat@example.com');
    await page.fill('#cf-message', 'Can you quote a DOT inspection for two trailers?');
    await form.locator('[data-submit]').click();
    await expect(form.locator('[data-success]')).toBeVisible();
    await expect(form.locator('[data-demo-note]')).toContainText('no message was actually sent');
    expect(sent).toEqual([]);
  });
});

test.describe('search and filters', () => {
  test('FAQ search narrows the list, reports the count and has an empty state', async ({ page }) => {
    await page.goto('./faq/');
    const items = page.locator('[data-faq-item]');
    const total = await items.count();
    expect(total).toBeGreaterThanOrEqual(15);
    await page.fill('#faq-search', 'estimate');
    const visible = await page.locator('[data-faq-item]:not([hidden])').count();
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(total);
    await expect(page.locator('[data-faq-count]')).toContainText(/matches?$/);
    await page.fill('#faq-search', 'zzzzqqq');
    await expect(page.locator('[data-faq-empty]')).toBeVisible();
    await page.fill('#faq-search', '');
    await expect(page.locator('[data-faq-item]:not([hidden])')).toHaveCount(total);
    await expect(page.locator('[data-faq-empty]')).toBeHidden();
  });

  test('the problem finder on the services page filters and links to the right service', async ({ page }) => {
    await page.goto('./services/');
    const items = page.locator('[data-problem]');
    const total = await items.count();
    await page.fill('#problem-q', 'air leak');
    await expect(page.locator('[data-problem]:not([hidden])')).toHaveCount(1);
    await expect(page.locator('[data-problem]:not([hidden]) a')).toHaveAttribute('href', /services\/brakes-air-systems\/$/);
    await page.fill('#problem-q', 'nothing like this');
    await expect(page.locator('[data-problems-empty]')).toBeVisible();
    await page.fill('#problem-q', '');
    await expect(page.locator('[data-problem]:not([hidden])')).toHaveCount(total);
  });
});

test.describe('gallery', () => {
  test('filters by category and opens a keyboard-navigable lightbox that returns focus', async ({ page }) => {
    await page.goto('./gallery/');
    await scrollThrough(page);
    const cells = page.locator('[data-gallery-cell]');
    await expect(cells).toHaveCount(16);
    await page.getByRole('button', { name: 'Roadside', exact: true }).click();
    await expect(page.locator('[data-gallery-cell]:not([hidden])')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Roadside', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.locator('[data-gallery-cell]:not([hidden])')).toHaveCount(16);

    const first = page.locator('[data-gallery-item]').first();
    await first.focus();
    await page.keyboard.press('Enter');
    const dialog = page.locator('#lightbox');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-lb-count]')).toHaveText('1 of 16');
    const firstCaption = await dialog.locator('[data-lb-caption]').textContent();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('[data-lb-count]')).toHaveText('2 of 16');
    expect(await dialog.locator('[data-lb-caption]').textContent()).not.toBe(firstCaption);
    await expect.poll(() => dialog.locator('[data-lb-img]').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft'); // wraps to the last photo
    await expect(dialog.locator('[data-lb-count]')).toHaveText('16 of 16');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(first).toBeFocused();
  });
});

test.describe('service pages', () => {
  test('a service page has its details, related services and a way to call', async ({ page }) => {
    await page.goto('./services/dot-inspections/');
    await expect(page.locator('h1')).toHaveText('DOT Annual Inspections');
    await expect(page.locator('.ticks--cols li')).toHaveCount(12);
    await expect(page.locator('.signs li').first()).toBeVisible();
    await expect(page.locator('.detail__aside a[href^="tel:"]').first()).toHaveAttribute('href', PHONE_TEL);
    await expect(page.locator('.related a')).toHaveCount(3);
    await expect(page.locator('.crumbs [aria-current="page"]')).toHaveText('DOT Annual Inspections');
    await expect(page.getByText('At least once every 12 months (49 CFR 396.17).')).toBeVisible();
    // tokens in copy are filled from the facts, never shown raw
    expect(await page.locator('main').textContent()).not.toContain('{{');
  });

  test('every service card on the services page leads to a page that exists', async ({ page, request }) => {
    await page.goto('./services/');
    const hrefs = await page.$$eval('.scard__link', (as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(hrefs).toHaveLength(SERVICES);
    for (const href of hrefs) expect((await request.get(href)).ok(), href).toBe(true);
  });
});

test.describe('resources', () => {
  test('an article renders its content, internal links and sidebar', async ({ page }) => {
    await page.goto('./resources/broken-down-first-10-minutes/');
    await expect(page.locator('h1')).toContainText('Broke down on the highway');
    await expect(page.locator('.prose h2')).toHaveCount(10);
    const link = page.locator('.prose a', { hasText: 'Sunny Side roadside assistance' });
    await expect(link).toHaveAttribute('href', /roadside-assistance\/$/);
    await link.click();
    await expect(page).toHaveURL(/roadside-assistance\/$/);
  });
});

test.describe('layout on phones', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the quick-action bar shows on phones and does not cover the footer', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.bar')).toBeVisible();
    await expect(page.locator('.bar a[href^="tel:"]')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const clear = await page.evaluate(() => document.querySelector('.footer__bar')!.getBoundingClientRect().bottom <= document.querySelector('.bar')!.getBoundingClientRect().top + 1);
    expect(clear).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.bar')).toBeHidden();
  });

  test('tap targets are at least 44px', async ({ page }) => {
    for (const path of ['./', './request-service/', './contact/', './gallery/']) {
      await page.goto(path);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        const sel = '.btn, .burger, .header__call, summary, .pill span, .choice__body, .check, .filters button, input[type=text], input[type=tel], input[type=email], input[type=search], select, textarea';
        document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || el.closest('[hidden], .hp')) return;
          if (r.height < 44 || r.width < 44) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`);
        });
        return out;
      });
      expect(small, path).toEqual([]);
    }
  });
});

test.describe('motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('scroll-reveal hides content only until it scrolls into view, and never leaves anything hidden', async ({ page }) => {
    await page.goto('./');
    expect(await page.locator('.reveal').count(), 'some below-the-fold content waits to reveal').toBeGreaterThan(3);
    await scrollThrough(page);
    await page.waitForTimeout(900);
    expect(await page.locator('.reveal:not(.is-visible)').count()).toBe(0);
    const faint = await page.$$eval('[data-reveal]', (els) => els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 1).length);
    expect(faint).toBe(0);
  });

  test('reduced motion turns reveal off entirely', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.goto('./');
    expect(await page.locator('.reveal').count()).toBe(0);
    await ctx.close();
  });
});
