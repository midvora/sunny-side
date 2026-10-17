#!/usr/bin/env node
// Post-deploy smoke test against a live URL: the page loads, the key content is there, the sample guardrails
// held, and every same-origin asset the page references really returns 200. Retries while Pages propagates.
// Usage: node scripts/smoke.mjs https://midvora.github.io/sunny-side/
const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/smoke.mjs <url>');
  process.exit(2);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let html = null;
for (let i = 1; i <= 20 && html === null; i++) {
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (r.ok) html = await r.text();
    else console.log(`attempt ${i}: HTTP ${r.status}`);
  } catch (e) {
    console.log(`attempt ${i}: ${e.message}`);
  }
  if (html === null) await sleep(6000);
}
if (html === null) {
  console.error('FAIL: page never loaded');
  process.exit(1);
}

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures.push(name);
};

const lower = html.toLowerCase();
check('title names the business', /<title>[^<]*sunny side/i.test(html));
check('address is on the page', html.includes('2605 Oakland Ave., Garland, TX 75041'));
check('page is noindex (sample build)', /<meta name="robots" content="noindex/i.test(html));
check('design-preview footer is shown', html.includes('Website design preview by Midvora'));
check('no JSON-LD in a sample build', !lower.includes('application/ld+json'));
check('tel: links point at the business number', /href="tel:\+12146852412"/.test(html));
check('page does not say Dallas, Texas (the address is in Garland)', !lower.includes('dallas, texas'));

// Every same-origin URL the page references must resolve.
const origin = new URL(url).origin;
const found = new Set();
for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) found.add(m[1]);
for (const m of html.matchAll(/\bsrcset="([^"]+)"/g)) for (const part of m[1].split(',')) found.add(part.trim().split(/\s+/)[0]);
const assets = [...found]
  .filter((u) => u && !u.startsWith('#') && !u.startsWith('mailto:') && !u.startsWith('tel:') && !u.startsWith('data:'))
  .map((u) => new URL(u, url))
  .filter((u) => u.origin === origin);
const unique = [...new Map(assets.map((u) => [u.href, u])).values()];

for (const path of ['services/', 'services/brakes-air-systems/', 'roadside-assistance/', 'request-service/', 'contact/', 'gallery/', 'resources/', 'sitemap.xml', 'robots.txt']) {
  try {
    const r = await fetch(new URL(path, url), { redirect: 'follow' });
    check(`page ${path}`, r.ok, `HTTP ${r.status}`);
  } catch (e) {
    check(`page ${path}`, false, e.message);
  }
}

let imageCount = 0;
let fontCount = 0;
for (const u of unique) {
  try {
    const r = await fetch(u, { redirect: 'follow' });
    const type = r.headers.get('content-type') ?? '';
    if (/\.(webp|png)$/.test(u.pathname)) imageCount += r.ok && type.startsWith('image/') ? 1 : 0;
    if (/\.woff2$/.test(u.pathname)) fontCount += r.ok ? 1 : 0;
    check(`asset ${u.pathname}`, r.ok, `HTTP ${r.status}`);
  } catch (e) {
    check(`asset ${u.pathname}`, false, e.message);
  }
}
check('at least one logo/image served as an image', imageCount >= 1, `${imageCount} found`);
check('web fonts served', fontCount >= 1, `${fontCount} found`);

const notFound = await fetch(new URL('definitely-not-a-page', url));
check('unknown path returns the 404 page', notFound.status === 404 && (await notFound.text()).includes('Page not found'), `HTTP ${notFound.status}`);

if (failures.length) {
  console.error(`\nSMOKE TEST FAILED: ${failures.length} check(s): ${failures.join('; ')}`);
  process.exit(1);
}
console.log(`\nSMOKE TEST PASSED (${unique.length} same-origin assets checked)`);
