import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBlockers, frontmatterStatus } from './launch-gate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const gate = join(here, 'launch-gate.mjs');

/** A throwaway project tree with the given data files and articles. */
function project({ data = {}, articles = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  mkdirSync(join(dir, 'src/data'), { recursive: true });
  mkdirSync(join(dir, 'src/content/resources'), { recursive: true });
  for (const [f, v] of Object.entries(data)) writeFileSync(join(dir, 'src/data', f), JSON.stringify(v));
  for (const [f, v] of Object.entries(articles)) writeFileSync(join(dir, 'src/content/resources', f), v);
  return dir;
}
const run = (dir) => spawnSync(process.execPath, [gate, dir], { encoding: 'utf8' });

const clean = () => ({
  data: {
    'business.json': { facts: { name: { label: 'Name', value: 'Test Shop', status: 'confirmed' }, fax: { label: 'Fax', value: null, status: 'not-offered' } } },
    'images.json': { images: { hero: { file: 'h.jpg', status: 'licensed' } } },
  },
  articles: { 'a.md': '---\ntitle: A\nstatus: confirmed\n---\nbody' },
});

test('passes when everything is confirmed, licensed or not-offered', () => {
  const dir = project(clean());
  assert.deepEqual(findBlockers(dir), []);
  assert.equal(run(dir).status, 0);
});

test('blocks a sample fact and names it', () => {
  const c = clean();
  c.data['business.json'].facts.name.status = 'sample';
  const r = run(project(c));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /business\.facts\.name/);
});

test('blocks a stock photo until it is replaced or marked licensed', () => {
  const c = clean();
  c.data['images.json'].images.hero.status = 'stock';
  assert.equal(run(project(c)).status, 1);
});

test('finds sample items nested deep in content, including list items', () => {
  const c = clean();
  c.data['content.json'] = { _readme: 'sample is mentioned here but this key is ignored', home: { why: { items: [{ title: 'x' }], status: 'confirmed' }, list: [{ q: 'Q?', status: 'sample' }] } };
  const b = findBlockers(project(c));
  assert.equal(b.length, 1);
  assert.match(b[0], /content\.home\.list\[0\]/);
});

test('blocks a sample article', () => {
  const c = clean();
  c.articles['a.md'] = '---\ntitle: A\nstatus: sample\n---\nbody';
  assert.equal(run(project(c)).status, 1);
});

test('blocks an article with no status at all, so it cannot be forgotten', () => {
  const c = clean();
  c.articles['a.md'] = '---\ntitle: A\n---\nbody';
  assert.equal(run(project(c)).status, 1);
});

test('blocks "confirmed" with no value, so an empty field cannot be passed off as confirmed', () => {
  const c = clean();
  c.data['business.json'].facts.name.value = '  ';
  assert.equal(run(project(c)).status, 1);
  c.data['business.json'].facts.name.value = null;
  assert.equal(run(project(c)).status, 1);
});

test('blocks a mistyped status instead of treating it as confirmed', () => {
  const c = clean();
  c.data['business.json'].facts.name.status = 'Confirmed';
  assert.equal(run(project(c)).status, 1);
});

test('reads status from article front matter only', () => {
  assert.equal(frontmatterStatus('---\ntitle: x\nstatus: sample\n---\nstatus: confirmed'), 'sample');
  assert.equal(frontmatterStatus('no front matter'), null);
});

test('real project: the gate verdict matches the data (currently expected to block)', () => {
  const blockers = findBlockers(root);
  assert.equal(run(root).status, blockers.length === 0 ? 0 : 1);
});

test('real project: a launch build fails while anything is sample or stock', { skip: findBlockers(root).length === 0 }, () => {
  // Output must stay on the project's filesystem: Astro moves assets with rename(), which fails across devices.
  const out = join(root, 'node_modules/.cache/launch-block-test');
  mkdirSync(out, { recursive: true });
  const r = spawnSync(join(root, 'node_modules/.bin/astro'), ['build', '--outDir', out], {
    cwd: root,
    env: { ...process.env, PUBLIC_LAUNCH: 'true' },
    encoding: 'utf8',
  });
  rmSync(out, { recursive: true, force: true });
  assert.notEqual(r.status, 0, 'launch build must fail');
  assert.match(r.stdout + r.stderr, /Launch build blocked/);
});
