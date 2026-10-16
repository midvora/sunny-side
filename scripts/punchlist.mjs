#!/usr/bin/env node
// Generates the confirmation checklist for the client from src/data/site.json, so the list
// cannot drift from what the site actually displays.
// Usage: node scripts/punchlist.mjs [outfile]   (default: ../TEDDY_CONFIRMATIONS.md, i.e. outside the repo)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(here, '../src/data/site.json'), 'utf8'));
const out = resolve(process.argv[2] ?? resolve(here, '../../TEDDY_CONFIRMATIONS.md'));

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const todo = Object.entries(data.facts).filter(([, f]) => f.status === 'unconfirmed');
const svc = data.services.filter((s) => s.status === 'unconfirmed');

const lines = [];
lines.push('# Sunny Side: what Teddy needs to confirm');
lines.push('');
lines.push(`Generated from \`website/src/data/site.json\` by \`npm run punchlist\`. ${todo.length} facts and ${svc.length} services are unconfirmed.`);
lines.push('The concept site shows each of these as a highlighted placeholder. The launch build refuses to run until all are confirmed or removed.');
lines.push('');
lines.push('## Facts');
lines.push('');
lines.push('| # | Item | Shown on the site now | What to confirm | Where it came from |');
lines.push('|---|---|---|---|---|');
todo.forEach(([id, f], i) => {
  lines.push(`| ${i + 1} | ${cell(f.label)} (\`${id}\`) | ${f.value ? cell(f.value) : '_blank placeholder_'} | ${cell(f.ask)} | ${cell(f.source)} |`);
});
lines.push('');
lines.push('## Services: does the shop actually do this?');
lines.push('');
lines.push('| # | Service | Wording on the site now | Yes / No / Reword |');
lines.push('|---|---|---|---|');
svc.forEach((s, i) => lines.push(`| ${i + 1} | ${cell(s.name)} | ${cell(s.summary)} | |`));
lines.push('');
lines.push('## Assets and permissions to request');
lines.push('');
lines.push('- [ ] Logo files (or permission for Midvora to design one) and any brand colors already in use');
lines.push('- [ ] Original photos of the shop, yard, trucks and work, with permission to publish (no stock photos of other shops)');
lines.push('- [ ] Photo of the shop sign or a business card, to match the exact spelling of the name');
lines.push('- [ ] Written OK for any review, certification or warranty wording before it is shown');
lines.push('- [ ] Where repair requests should go, who answers them, and how customer details are handled');
lines.push('- [ ] Domain name, who controls DNS, and who signs off on going live');
lines.push('');
lines.push('## Independent checks that need a person (not automated)');
lines.push('');
lines.push('See `HUMAN_CHECKS.md`.');
lines.push('');

writeFileSync(out, lines.join('\n'));
console.log(`wrote ${out} (${todo.length} facts, ${svc.length} services)`);
