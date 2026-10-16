// Proves the launch path end to end on a throwaway copy with every fact "confirmed" using obvious test values:
// the gate passes, a PUBLIC_LAUNCH build succeeds, and the output is indexable, banner-free, placeholder-free
// and carries JSON-LD built only from the confirmed values. Nothing here touches the real data file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

test('all-confirmed fixture: gate passes and the launch build is clean', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'launch-fixture-'));
  for (const p of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) {
    cpSync(join(root, p), join(tmp, p), { recursive: true });
  }
  symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'));

  const dataFile = join(tmp, 'src/data/site.json');
  const data = JSON.parse(readFileSync(dataFile, 'utf8'));
  for (const [id, f] of Object.entries(data.facts)) {
    f.status = 'confirmed';
    f.value = id === 'businessName' ? 'Test Shop' : `TEST ${id}`;
  }
  for (const s of data.services) s.status = 'confirmed';
  writeFileSync(dataFile, JSON.stringify(data));

  const gate = spawnSync(process.execPath, [join(root, 'scripts/launch-gate.mjs'), dataFile], { encoding: 'utf8' });
  assert.equal(gate.status, 0, gate.stderr);

  const build = spawnSync(join(tmp, 'node_modules/.bin/astro'), ['build'], {
    cwd: tmp,
    env: { ...process.env, PUBLIC_LAUNCH: 'true' },
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const html = readFileSync(join(tmp, 'dist/index.html'), 'utf8');
  assert.doesNotMatch(html, /noindex/i, 'launch build must be indexable');
  assert.doesNotMatch(html, /class="tbc"/, 'no placeholder marks in a launch build');
  assert.doesNotMatch(html, /Private concept preview/, 'no preview banner in a launch build');
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"AutoRepair"/);
  assert.match(html, /"name":"Test Shop"/);

  const robots = readFileSync(join(tmp, 'dist/robots.txt'), 'utf8');
  assert.match(robots, /Allow: \//);
  assert.doesNotMatch(robots, /Disallow/);
});
