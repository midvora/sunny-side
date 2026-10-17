// Proves the launch path end to end on a throwaway copy where every item is confirmed/licensed:
// the gate passes, a PUBLIC_LAUNCH build succeeds, and the output is indexable, free of the preview credit,
// and carries valid structured data (business, breadcrumbs, FAQ, service, article) plus a populated sitemap.
// Nothing here touches the real data files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBlockers } from './launch-gate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

function confirmAll(node) {
  if (Array.isArray(node)) return node.forEach(confirmAll);
  if (!node || typeof node !== 'object') return;
  if (typeof node.status === 'string') node.status = node.status === 'stock' ? 'licensed' : 'confirmed';
  for (const [k, v] of Object.entries(node)) if (!k.startsWith('_')) confirmAll(v);
}

test('all-confirmed copy: gate passes and the launch build is clean and complete', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'launch-fixture-'));
  for (const p of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) {
    cpSync(join(root, p), join(tmp, p), { recursive: true });
  }
  symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'));

  const dataDir = join(tmp, 'src/data');
  for (const f of readdirSync(dataDir).filter((n) => n.endsWith('.json'))) {
    const file = join(dataDir, f);
    const json = JSON.parse(readFileSync(file, 'utf8'));
    confirmAll(json);
    writeFileSync(file, JSON.stringify(json));
  }
  const artDir = join(tmp, 'src/content/resources');
  for (const f of readdirSync(artDir)) {
    const file = join(artDir, f);
    writeFileSync(file, readFileSync(file, 'utf8').replace(/^status:\s*\w+$/m, 'status: confirmed'));
  }

  assert.deepEqual(findBlockers(tmp), [], 'every blocker should be cleared in the fixture');
  const gate = spawnSync(process.execPath, [join(root, 'scripts/launch-gate.mjs'), tmp], { encoding: 'utf8' });
  assert.equal(gate.status, 0, gate.stderr);

  const build = spawnSync(join(tmp, 'node_modules/.bin/astro'), ['build'], {
    cwd: tmp,
    env: { ...process.env, PUBLIC_LAUNCH: 'true', SITE_URL: 'https://example.test' },
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const page = (p) => readFileSync(join(tmp, 'dist', p, 'index.html'), 'utf8');
  const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

  const home = page('.');
  assert.doesNotMatch(home, /noindex/i, 'launch build must be indexable');
  assert.doesNotMatch(home, /design preview/i, 'no preview credit in a launch build');
  assert.match(home, /Website by Midvora/);
  assert.match(home, /<link rel="canonical" href="https:\/\/example\.test\/"/);
  const biz = jsonLd(home).find((x) => x['@type'] === 'AutoRepair');
  assert.ok(biz, 'LocalBusiness structured data is present');
  assert.equal(biz.address.postalCode, '75041');
  assert.ok(biz.openingHoursSpecification.length >= 5);

  assert.ok(jsonLd(page('faq')).some((x) => x['@type'] === 'FAQPage'), 'FAQ page has FAQPage data');
  assert.ok(jsonLd(page('services/brakes-air-systems')).some((x) => x['@type'] === 'BreadcrumbList'), 'service pages have breadcrumbs');
  assert.ok(jsonLd(page('services/brakes-air-systems')).some((x) => x['@type'] === 'Service'), 'service pages have Service data');
  assert.ok(jsonLd(page('resources/dot-annual-inspection-guide')).some((x) => x['@type'] === 'Article'), 'articles have Article data');

  const robots = readFileSync(join(tmp, 'dist/robots.txt'), 'utf8');
  assert.match(robots, /Allow: \//);
  assert.doesNotMatch(robots, /Disallow/);
  assert.match(robots, /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
  const sitemap = readFileSync(join(tmp, 'dist/sitemap.xml'), 'utf8');
  assert.ok((sitemap.match(/<loc>/g) ?? []).length >= 25, 'sitemap lists every page');
  assert.ok(existsSync(join(tmp, 'dist/og.jpg')));
});
