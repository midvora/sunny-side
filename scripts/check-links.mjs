#!/usr/bin/env node
// Checks that every internal link, image, stylesheet, script and #anchor in the built site resolves.
// Honors SITE_BASE (the GitHub Pages build lives under /sunny-side/). External links are listed, not fetched.
// Usage: node scripts/check-links.mjs [distDir]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dist = resolve(process.argv[2] ?? 'dist');
const base = (process.env.SITE_BASE || '').replace(/\/$/, '');

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const pages = walk(dist).filter((f) => f.endsWith('.html'));

const idCache = new Map();
const idsOf = (file) => {
  if (!idCache.has(file)) idCache.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return idCache.get(file);
};

function resolveFile(urlPath) {
  const p = decodeURIComponent(urlPath);
  const candidates = [join(dist, p)];
  if (p.endsWith('/')) candidates.push(join(dist, p, 'index.html'));
  else candidates.push(join(dist, p, 'index.html'), join(dist, `${p}.html`));
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
}

const problems = [];
const external = new Set();
let checked = 0;

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const rel = file.slice(dist.length);
  const urls = [];
  for (const m of html.matchAll(/\s(?:href|src|poster|data-full|data-src)="([^"]*)"/g)) urls.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) for (const part of m[1].split(',')) urls.push(part.trim().split(/\s+/)[0]);

  for (const raw of new Set(urls)) {
    if (!raw || /^(mailto:|tel:|sms:|data:|javascript:)/.test(raw)) continue;
    if (/^https?:\/\//.test(raw)) {
      external.add(new URL(raw).host);
      continue;
    }
    checked++;
    const [pathPart, fragment] = raw.split('#');
    let target;
    if (pathPart === '') target = file; // same-page anchor
    else if (pathPart.startsWith('/')) {
      if (base && !(pathPart === `${base}` || pathPart.startsWith(`${base}/`))) {
        problems.push(`${rel}: "${raw}" is missing the base path ${base}`);
        continue;
      }
      target = resolveFile(base ? pathPart.slice(base.length) || '/' : pathPart);
    } else {
      problems.push(`${rel}: "${raw}" is a relative URL; the build should emit root-absolute URLs`);
      continue;
    }
    if (!target) problems.push(`${rel}: "${raw}" does not exist in the build`);
    else if (fragment && target.endsWith('.html') && !idsOf(target).has(fragment)) problems.push(`${rel}: "${raw}" points at a missing anchor`);
  }
}

console.log(`link check: ${pages.length} pages, ${checked} internal references, external hosts: ${[...external].sort().join(', ') || 'none'}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 80)) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('link check: PASS');
