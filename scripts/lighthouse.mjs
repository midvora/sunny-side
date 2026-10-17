#!/usr/bin/env node
// Runs Lighthouse (default mobile profile: emulated phone, simulated slow-4G throttling) against the built site
// and fails if a category score or a Core Web Vitals lab metric misses its target.
// Needs a build in dist/. Uses the Chromium that Playwright installed.
// Usage: node scripts/lighthouse.mjs [outDir]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(process.argv[2] ?? resolve(root, '../reports/lighthouse'));
mkdirSync(outDir, { recursive: true });

const PORT = 4323;
const BASE = (process.env.SITE_BASE || '').replace(/\/$/, '');
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'services', path: '/services/' },
  { name: 'service-detail', path: '/services/brakes-air-systems/' },
  { name: 'roadside', path: '/roadside-assistance/' },
  { name: 'request-service', path: '/request-service/' },
  { name: 'contact', path: '/contact/' },
  { name: 'gallery', path: '/gallery/' },
  { name: 'article', path: '/resources/broken-down-first-10-minutes/' },
  { name: '404', path: '/404.html' },
];
// LH_PAGES=home,gallery limits the run to those pages (handy while iterating).
const ONLY = process.env.LH_PAGES?.split(',');
// Category targets are our bar, not an official threshold. Lighthouse simulates a slow-4G phone with a 4x CPU slowdown,
// which is harsher than most real visitors, so the lab LCP guard is 3.2 s (Google's "good" field threshold is 2.5 s at the
// 75th percentile of real visits). CLS 0.1 is Google's "good" threshold; total blocking time stands in for INP (200 ms).
const TARGET = { performance: 0.9, accessibility: 0.95, 'best-practices': 0.95, seo: 0.95 };
const LIMITS = { 'largest-contentful-paint': 3200, 'cumulative-layout-shift': 0.1, 'total-blocking-time': 200 };
// The concept is noindex on purpose, so Lighthouse's crawlability audit is expected to fail. We score SEO without it.
const EXPECTED_FAILS = new Set(['is-crawlable']);

// Serve like production static hosting (compression, cache headers), not `astro preview`.
const server = spawn(process.execPath, [resolve(root, 'scripts/serve-dist.mjs'), resolve(root, 'dist'), String(PORT)], {
  cwd: root,
  env: process.env,
  stdio: 'ignore',
});
const stop = () => server.kill();
process.on('exit', stop);

async function waitUp() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}${BASE}/`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}

await waitUp();
const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});

const rows = [];
let failed = false;
try {
  for (const p of PAGES.filter((x) => !ONLY || ONLY.includes(x.name))) {
    const { lhr } = await lighthouse(
      `http://127.0.0.1:${PORT}${BASE}${p.path}`,
      { port: chrome.port, output: 'json', logLevel: 'error' },
      { extends: 'lighthouse:default', settings: { onlyCategories: Object.keys(TARGET) } },
    );
    writeFileSync(resolve(outDir, `${p.name}.json`), JSON.stringify(lhr, null, 2));

    const scores = {};
    for (const [id, cat] of Object.entries(lhr.categories)) {
      let score = cat.score;
      if (id === 'seo') {
        // Re-weight SEO without the intentionally failing crawlability audit.
        const refs = cat.auditRefs.filter((a) => a.weight > 0 && !EXPECTED_FAILS.has(a.id));
        const total = refs.reduce((s, a) => s + a.weight, 0);
        score = refs.reduce((s, a) => s + a.weight * (lhr.audits[a.id].score ?? 0), 0) / total;
      }
      scores[id] = score;
      if (score < TARGET[id]) failed = true;
    }
    const m = {};
    for (const [id, limit] of Object.entries(LIMITS)) {
      m[id] = lhr.audits[id].numericValue;
      if (m[id] > limit) failed = true;
    }
    const failing = Object.values(lhr.audits)
      .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && !EXPECTED_FAILS.has(a.id))
      .filter((a) => lhr.categories.performance.auditRefs.concat(lhr.categories.accessibility.auditRefs, lhr.categories['best-practices'].auditRefs, lhr.categories.seo.auditRefs).some((r) => r.id === a.id && r.weight > 0))
      .map((a) => `${a.id} (${a.score})`);
    rows.push({ page: p.path, scores, metrics: m, failing });
  }
} finally {
  chrome.kill();
  stop();
}

const pct = (n) => Math.round(n * 100);
const lines = [`Lighthouse ${new Date().toISOString()} (mobile, simulated throttling)`, ''];
for (const r of rows) {
  lines.push(`${r.page}`);
  lines.push(`  performance ${pct(r.scores.performance)}  accessibility ${pct(r.scores.accessibility)}  best-practices ${pct(r.scores['best-practices'])}  seo ${pct(r.scores.seo)} (without is-crawlable)`);
  lines.push(`  LCP ${Math.round(r.metrics['largest-contentful-paint'])} ms  CLS ${r.metrics['cumulative-layout-shift'].toFixed(3)}  TBT ${Math.round(r.metrics['total-blocking-time'])} ms`);
  lines.push(`  imperfect audits: ${r.failing.length ? r.failing.join(', ') : 'none'}`);
}
lines.push('', failed ? 'RESULT: below target' : 'RESULT: all targets met');
const text = lines.join('\n');
console.log(text);
writeFileSync(resolve(outDir, 'summary.txt'), text + '\n');
process.exit(failed ? 1 : 0);
