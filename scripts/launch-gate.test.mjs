import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBlockers } from './launch-gate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const gate = join(here, 'launch-gate.mjs');
const real = JSON.parse(readFileSync(resolve(here, '../src/data/site.json'), 'utf8'));

const confirmedFixture = () => ({
  facts: {
    name: { label: 'Name', value: 'Test Shop', status: 'confirmed', source: 'x', ask: 'x' },
    fax: { label: 'Fax', value: null, status: 'not-offered', source: 'x', ask: 'x' },
  },
  services: [{ id: 's', name: 'S', summary: 's', status: 'confirmed', source: 'x' }],
});

function runGate(data) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  const file = join(dir, 'site.json');
  writeFileSync(file, JSON.stringify(data));
  return spawnSync(process.execPath, [gate, file], { encoding: 'utf8' });
}

test('passes when everything is confirmed or not-offered', () => {
  assert.deepEqual(findBlockers(confirmedFixture()), []);
  assert.equal(runGate(confirmedFixture()).status, 0);
});

test('blocks an unconfirmed fact and names it', () => {
  const d = confirmedFixture();
  d.facts.name.status = 'unconfirmed';
  const r = runGate(d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /fact "name"/);
});

test('blocks an unconfirmed service', () => {
  const d = confirmedFixture();
  d.services[0].status = 'unconfirmed';
  assert.equal(runGate(d).status, 1);
});

test('blocks "confirmed" with no value, so an empty field cannot be passed off as confirmed', () => {
  const d = confirmedFixture();
  d.facts.name.value = '  ';
  assert.equal(runGate(d).status, 1);
  d.facts.name.value = null;
  assert.equal(runGate(d).status, 1);
});

test('blocks a mistyped status instead of treating it as confirmed', () => {
  const d = confirmedFixture();
  d.facts.name.status = 'Confirmed';
  assert.equal(runGate(d).status, 1);
});

test('real site data: the gate verdict matches the data (currently expected to block)', () => {
  const blockers = findBlockers(real);
  assert.equal(runGate(real).status, blockers.length === 0 ? 0 : 1);
});

test('real site data: a launch build fails while anything is unconfirmed', { skip: findBlockers(real).length === 0 }, () => {
  const root = resolve(here, '..');
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
