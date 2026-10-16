#!/usr/bin/env node
// Launch gate: refuses a production build while any business fact is unconfirmed.
// Usage: node scripts/launch-gate.mjs [path/to/site.json]
// Exit 0 = every fact and service is confirmed (or explicitly "not-offered"). Exit 1 = blocked.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const VALID = new Set(['confirmed', 'unconfirmed', 'not-offered']);

export function findBlockers(data) {
  const blockers = [];

  for (const [id, f] of Object.entries(data.facts ?? {})) {
    if (!VALID.has(f.status)) {
      blockers.push(`fact "${id}": invalid status "${f.status}"`);
    } else if (f.status === 'unconfirmed') {
      blockers.push(`fact "${id}" (${f.label}): unconfirmed. Ask: ${f.ask}`);
    } else if (f.status === 'confirmed' && (f.value === null || String(f.value).trim() === '')) {
      blockers.push(`fact "${id}" (${f.label}): marked confirmed but has no value`);
    }
  }

  for (const s of data.services ?? []) {
    if (!VALID.has(s.status)) {
      blockers.push(`service "${s.id}": invalid status "${s.status}"`);
    } else if (s.status === 'unconfirmed') {
      blockers.push(`service "${s.id}" (${s.name}): unconfirmed. Confirm it or delete it.`);
    }
  }

  return blockers;
}

const here = dirname(fileURLToPath(import.meta.url));
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const file = resolve(process.argv[2] ?? resolve(here, '../src/data/site.json'));
  const blockers = findBlockers(JSON.parse(readFileSync(file, 'utf8')));
  if (blockers.length === 0) {
    console.log(`launch gate: PASS (${file})`);
  } else {
    console.error(`launch gate: BLOCKED. ${blockers.length} item(s) not confirmed:\n`);
    for (const b of blockers) console.error(`  - ${b}`);
    console.error('\nUpdate src/data/site.json only with facts the business has confirmed.');
    process.exit(1);
  }
}
