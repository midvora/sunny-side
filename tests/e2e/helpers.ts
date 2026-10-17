import type { Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const services: { slug: string; href?: string }[] = JSON.parse(readFileSync(join(root, 'src/data/services.json'), 'utf8')).services;
const articles = readdirSync(join(root, 'src/content/resources')).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));

/** Every page of the site, as paths relative to the base URL (works at / and under /sunny-side/). */
export const PAGES = [
  './', './services/', './roadside-assistance/', './fleet-services/', './about/', './gallery/', './service-area/',
  './faq/', './resources/', './contact/', './request-service/', './privacy/', './terms/',
  ...services.filter((s) => !s.href).map((s) => `./services/${s.slug}/`),
  ...articles.map((a) => `./resources/${a}/`),
];
export const ALL_PAGES = [...PAGES, './404.html'];

export const PHONE_TEL = 'tel:+12146852412';
export const ADDRESS = '2605 Oakland Ave., Garland, TX 75041';

/** Scroll the whole page so lazy images load and scroll-reveal content shows. */
export async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo({ top: y, behavior: 'instant' }); // the page uses smooth scrolling when motion is allowed
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
}

/** The text a visitor can read (screen-reader-only text excluded). */
export function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.sr-only, script, style, noscript').forEach((n) => n.remove());
    return clone.textContent ?? '';
  });
}

export const BANNED_PHRASES = [
  'to be confirmed', 'placeholder', 'business confirms', 'unconfirmed', 'lorem ipsum', 'coming soon', 'tbd',
  'sample content', 'concept preview',
];
