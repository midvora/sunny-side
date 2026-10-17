#!/usr/bin/env node
// Generates the "what is invented / what Teddy must confirm" checklist from the site's data files in src/data/,
// so the list cannot drift from what the site actually displays. Anything whose status is not "confirmed"
// (sample = written for the design sample, stock = stock photo) is listed.
// Usage: node scripts/punchlist.mjs [outfile]   (default: ../TEDDY_CONFIRMATIONS.md, i.e. outside the repo)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const data = (name) => JSON.parse(readFileSync(resolve(here, '../src/data', name), 'utf8'));
const out = resolve(process.argv[2] ?? resolve(here, '../../TEDDY_CONFIRMATIONS.md'));

const clip = (s, n = 90) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const pending = (o) => o && typeof o === 'object' && o.status && !['confirmed', 'licensed', 'not-offered'].includes(o.status);
const today = new Date().toISOString().slice(0, 10);

const business = data('business.json');
const services = data('services.json');
const content = data('content.json');
const faq = data('faq.json');
const testimonials = data('testimonials.json');
const images = data('images.json');
const legal = data('legal.json');
const areas = data('areas.json');

const lines = [];
const add = (...l) => lines.push(...l);

// ---- facts ----
const facts = Object.entries(business.facts).filter(([, f]) => pending(f));
const hoursPending = pending(business.hours);
const hoursSummary = Object.entries(business.hours.days ?? {})
  .map(([d, h]) => `${d[0].toUpperCase()}${d.slice(1)} ${h ? `${h[0]}-${h[1]}` : 'closed'}`)
  .join(', ');
add(
  '# Sunny Side: what is invented and what Teddy needs to confirm',
  '',
  `Generated from \`website/src/data/*.json\` by \`npm run punchlist\` on ${today}.`,
  'The sample site looks like a finished website, but everything below was written or chosen by Midvora to make it feel real.',
  'The launch build (`npm run build:launch`) refuses to run while any of these is still marked `sample` or `stock`.',
  '',
  '**Real (supplied by Samson):** business name, trade line, logo, and the address 2605 Oakland Ave., Garland, TX 75041.',
  '',
  '## 1. Business facts to confirm',
  '',
  '| # | Item | Shown on the site now | What to confirm |',
  '|---|---|---|---|',
);
facts.forEach(([, f], i) => add(`| ${i + 1} | ${clip(f.label, 40)} | ${clip(f.value)} | ${clip(f.ask, 200)} |`));
if (hoursPending) add(`| ${facts.length + 1} | Opening hours | ${hoursSummary} (drives the "Open now" badge) | ${clip(business.hours.ask, 200)} |`);

// ---- services ----
add('', '## 2. Services: does the shop actually do this?', '', 'Each service has its own page. Mark Yes / No / Reword. Remove any service Teddy does not offer.', '', '| # | Service | Page wording to check | Yes / No / Reword |', '|---|---|---|---|');
services.services.filter(pending).forEach((s, i) => add(`| ${i + 1} | ${clip(s.name ?? s.title, 50)} | ${clip(s.lead ?? s.description, 110)} | |`));

// ---- fake social proof ----
const reviewList = testimonials.testimonials.filter(pending);
add(
  '',
  '## 3. Customer reviews: all invented',
  '',
  `The home page shows ${reviewList.length} reviews. **None is real.** Names, trucks and quotes were written for the sample.`,
  'Replace them with real reviews (with permission) or a link to Teddy\'s Google Business Profile before anything goes live. Never publish invented reviews as real.',
  '',
  '| Name shown | Excerpt |',
  '|---|---|',
);
reviewList.forEach((t) => add(`| ${clip(t.name, 30)} | ${clip(t.quote ?? t.text ?? t.body, 110)} |`));

// ---- page copy ----
const copy = [];
for (const [page, sections] of Object.entries(content)) {
  if (page.startsWith('_')) continue;
  for (const [key, sec] of Object.entries(sections)) if (pending(sec)) copy.push([page, key, sec.title ?? sec.heading ?? sec.eyebrow ?? '']);
}
add('', '## 4. Page copy written by Midvora', '', 'Headlines and section text on the home, roadside, about and fleet pages. Teddy should read these and change anything that is not how he talks or works (for example claims like "we come to you").', '', '| Page | Section | Heading |', '|---|---|---|');
copy.forEach(([p, k, t]) => add(`| ${p} | ${k} | ${clip(t, 70)} |`));
const faqCount = faq.groups.reduce((n, g) => n + g.items.filter(pending).length, 0);
add('', `**FAQ:** ${faqCount} questions and answers were written for the sample (pricing, towing, hours, areas). Each answer must match how Teddy really works.`);
add(`**Service areas:** the ${areas.areas?.length ?? 'listed'} cities on the Service Area page are Midvora's guess at the Dallas area.`);
add(`**Legal pages:** the Privacy Policy and Terms are ${pending(legal.privacy) ? 'generic drafts' : 'drafts'}. Have them reviewed before launch.`);
add('**Articles:** the 4 guides under Resources cite federal rules (49 CFR 392.22, 396.17, 393.51). They are written for general readers and should be reviewed by someone in the trade.');

// ---- photos ----
const photos = Object.entries(images.images).filter(([, p]) => pending(p));
add(
  '',
  '## 5. Photos: all stock',
  '',
  `All ${photos.length} photos are Pexels stock images (free to use, credits recorded in \`src/data/images.json\`). None shows Teddy's shop, trucks or team.`,
  'Replace each with a real photo of the shop. The right-hand column says what to shoot.',
  '',
  '| Photo | What it shows now | Replace with |',
  '|---|---|---|',
);
photos.forEach(([k, p]) => add(`| \`${k}\` | ${clip(p.alt, 70)} | ${clip(p.replaceWith, 110)} |`));

add(
  '',
  '## 6. Not built yet',
  '',
  '- **The request and contact forms send nothing.** They are a working preview. Decide who receives requests (email, text or CRM), how fast they reply, and how customer details are handled.',
  '- **Domain and hosting:** who owns the domain and DNS, and who signs off on going live.',
  '- **Google Business Profile, USDOT number, shop sign photo:** useful for identity checks and for a LocalBusiness listing.',
  '',
  '## Independent checks that need a person',
  '',
  'See `HUMAN_CHECKS.md` (real devices, screen readers, task test with drivers, identity records).',
  '',
);

writeFileSync(out, lines.join('\n'));
console.log(`Wrote ${out}: ${facts.length + (hoursPending ? 1 : 0)} facts, ${services.services.filter(pending).length} services, ${reviewList.length} reviews, ${photos.length} photos, ${faqCount} FAQ items.`);
