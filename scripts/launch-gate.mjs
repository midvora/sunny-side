#!/usr/bin/env node
// Launch gate: refuses a production build while anything in the site's content is still sample or stock.
// It scans every JSON file in src/data (any object with a "status") and every article's front matter.
//   confirmed / licensed / not-offered  -> fine
//   sample / stock / unconfirmed        -> blocks the launch
// Usage: node scripts/launch-gate.mjs [projectRoot]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const OK = new Set(['confirmed', 'licensed', 'not-offered']);
const BLOCKING = new Set(['sample', 'stock', 'unconfirmed']);

function walk(node, path, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`, out));
  if (typeof node.status === 'string') {
    const label = node.label ?? node.name ?? node.slug ?? node.q ?? node.title ?? node.quote?.slice(0, 40) ?? '';
    if (BLOCKING.has(node.status)) {
      out.push(`${path}${label ? ` (${label})` : ''}: ${node.status}${node.ask ? `. Ask: ${node.ask}` : ''}`);
    } else if (!OK.has(node.status)) {
      out.push(`${path}: invalid status "${node.status}"`);
    } else if (node.status === 'confirmed' && 'value' in node && (node.value === null || String(node.value).trim() === '')) {
      out.push(`${path}: marked confirmed but has no value`);
    }
  }
  for (const [k, v] of Object.entries(node)) if (!k.startsWith('_')) walk(v, path ? `${path}.${k}` : k, out);
}

export function frontmatterStatus(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m?.[1].match(/^status:\s*["']?([\w-]+)["']?\s*$/m)?.[1] ?? null;
}

export function findBlockers(root) {
  const out = [];
  const dataDir = join(root, 'src/data');
  if (existsSync(dataDir)) {
    for (const f of readdirSync(dataDir).filter((n) => n.endsWith('.json')).sort()) {
      walk(JSON.parse(readFileSync(join(dataDir, f), 'utf8')), f.replace(/\.json$/, ''), out);
    }
  }
  const artDir = join(root, 'src/content/resources');
  if (existsSync(artDir)) {
    for (const f of readdirSync(artDir).filter((n) => n.endsWith('.md')).sort()) {
      const status = frontmatterStatus(readFileSync(join(artDir, f), 'utf8'));
      const path = `resources/${f}`;
      if (status === null) out.push(`${path}: no status in front matter`);
      else if (BLOCKING.has(status)) out.push(`${path}: ${status}. Needs a technical review by the shop.`);
      else if (!OK.has(status)) out.push(`${path}: invalid status "${status}"`);
    }
  }
  return out;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
  const blockers = findBlockers(root);
  if (blockers.length === 0) {
    console.log(`launch gate: PASS (${root})`);
  } else {
    console.error(`launch gate: BLOCKED. ${blockers.length} item(s) are still sample or stock:\n`);
    for (const b of blockers.slice(0, 60)) console.error(`  - ${b}`);
    if (blockers.length > 60) console.error(`  ...and ${blockers.length - 60} more`);
    console.error('\nConfirm each with the business (see CONFIRM_WITH_TEDDY.md), then set its status to "confirmed" (photos: "licensed").');
    process.exit(1);
  }
}
