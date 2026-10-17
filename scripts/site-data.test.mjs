// Data integrity for the content layer, and the rule that nothing user-visible ever reads like a placeholder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const business = read('src/data/business.json');
const services = read('src/data/services.json');
const images = read('src/data/images.json').images;
const faq = read('src/data/faq.json');
const content = read('src/data/content.json');
const testimonials = read('src/data/testimonials.json');
const areas = read('src/data/areas.json');
const articlesDir = join(root, 'src/content/resources');
const articles = readdirSync(articlesDir).filter((f) => f.endsWith('.md')).map((f) => ({ f, text: readFileSync(join(articlesDir, f), 'utf8') }));

const TOKENS = new Set(['businessName', 'phone', 'email', 'address', 'city', 'hours', 'estimates', 'payment', 'appointments', 'emergency', 'serviceArea', 'serviceModel', 'insurance', 'warranty']);

/** Every string a visitor can read: everything except internal notes. */
const INTERNAL_KEYS = new Set(['source', 'ask', 'replaceWith', 'status', 'file', 'credit', 'slug', 'href', 'id', 'icon', 'image', 'category', 'tz', 'tel', 'related']);
function visibleStrings(node, out = [], key = '') {
  if (typeof node === 'string') { if (!INTERNAL_KEYS.has(key)) out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach((n) => visibleStrings(n, out, key)); return out; }
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (!k.startsWith('_')) visibleStrings(v, out, k);
  return out;
}

test('services: unique slugs, valid images, valid related links, required copy', () => {
  const slugs = services.services.map((s) => s.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slugs are unique');
  const cats = new Set(services.categories.map((c) => c.id));
  for (const s of services.services) {
    assert.ok(images[s.image], `${s.slug}: image "${s.image}" exists in images.json`);
    assert.ok(cats.has(s.category), `${s.slug}: category exists`);
    for (const r of s.related ?? []) assert.ok(slugs.includes(r), `${s.slug}: related "${r}" exists`);
    assert.ok(s.title.length >= 20 && s.title.length <= 80, `${s.slug}: title length ${s.title.length}`);
    assert.ok(s.description.length >= 80 && s.description.length <= 200, `${s.slug}: description length ${s.description.length}`);
    if (!s.href) {
      for (const k of ['lead', 'intro', 'included', 'signs', 'steps', 'faqs']) assert.ok(s[k]?.length, `${s.slug}: has ${k}`);
    }
  }
});

test('photos: every registry entry has a file, alt text and a full credit', () => {
  for (const [key, p] of Object.entries(images)) {
    assert.ok(existsSync(join(root, 'src/assets/photos', p.file)), `${key}: file ${p.file} exists`);
    assert.ok(p.alt.length >= 25, `${key}: descriptive alt text`);
    assert.match(p.focal, /^\d+% \d+%$/, `${key}: focal point`);
    assert.ok(p.credit.photographer && p.credit.title && p.credit.pexelsId, `${key}: credit is complete`);
  }
});

test('articles: front matter is complete and points at real photos', () => {
  assert.equal(articles.length, 4);
  for (const { f, text } of articles) {
    const fm = text.match(/^---\n([\s\S]*?)\n---/)[1];
    for (const k of ['title', 'description', 'category', 'readTime', 'image', 'updated', 'order', 'status']) assert.match(fm, new RegExp(`^${k}:`, 'm'), `${f}: ${k}`);
    const img = fm.match(/^image:\s*"?([\w-]+)"?/m)[1];
    assert.ok(images[img], `${f}: image ${img} exists`);
  }
});

test('every {{token}} used in the content is a known token', () => {
  const all = JSON.stringify([services, faq, content], (k, v) => (k.startsWith('_') ? undefined : v));
  for (const m of all.matchAll(/\{\{(\w+)\}\}/g)) assert.ok(TOKENS.has(m[1]), `unknown token {{${m[1]}}}`);
});

test('contact facts are internally consistent', () => {
  const f = business.facts;
  assert.equal(f.phone.tel.replace(/\D/g, '').slice(-10), f.phone.value.replace(/\D/g, ''), 'tel: link matches the displayed number');
  assert.match(f.phone.value, /^\d{3}-\d{3}-\d{4}$/, 'phone is written ddd-ddd-dddd');
  if (f.phone.status === 'sample') assert.match(f.phone.value, /^\d{3}-555-01\d\d$/, 'a sample phone must be a fictional 555-01xx number');
  assert.match(f.email.value, /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
  assert.ok(f.address.value.includes(f.address.parts.street) && f.address.value.includes(f.address.parts.postalCode));
  assert.ok(f.address.parts.lat > 32 && f.address.parts.lat < 33.5 && f.address.parts.lon < -96 && f.address.parts.lon > -97.5, 'coordinates are in the Garland area');
  for (const [d, w] of Object.entries(business.hours.days)) {
    if (w) assert.ok(/^\d\d:\d\d$/.test(w[0]) && /^\d\d:\d\d$/.test(w[1]) && w[0] < w[1], `hours for ${d}`);
  }
});

test('the supplied facts stay marked confirmed and the invented ones stay marked sample', () => {
  const f = business.facts;
  for (const k of ['businessName', 'tagline', 'tradeLine', 'location', 'address', 'phone']) assert.equal(f[k].status, 'confirmed', k);
  for (const k of ['email', 'emergency', 'serviceArea', 'estimates', 'payment', 'insurance']) assert.equal(f[k].status, 'sample', k);
  assert.equal(business.hours.status, 'sample');
});

test('the site never says Dallas as the shop city: the supplied address is in Garland', () => {
  assert.equal(business.facts.location.value, 'Garland, Texas');
});

test('no user-visible text reads like a placeholder or an unconfirmed marker', () => {
  const banned = [/to be confirmed/i, /\bplaceholder/i, /business confirms/i, /unconfirmed/i, /lorem ipsum/i, /\btbd\b/i, /coming soon/i, /\bsample (content|text|copy)\b/i, /\[[^\]]*\bconfirm/i];
  const texts = [
    ...visibleStrings([business.facts, services, faq, content, testimonials, areas]),
    ...articles.map((a) => a.text.replace(/^---[\s\S]*?---/, '')),
  ];
  for (const t of texts) for (const re of banned) assert.doesNotMatch(t, re, `visible text matches ${re}: "${t.slice(0, 80)}"`);
});

test('testimonials look like quotes, not placeholders', () => {
  assert.ok(testimonials.testimonials.length >= 3);
  for (const t of testimonials.testimonials) {
    assert.ok(t.quote.length > 40 && t.name.length > 3 && t.role.length > 3);
    assert.doesNotMatch(t.quote, /\d{3}[-. ]\d{3}[-. ]\d{4}|\$\d/, 'no phone numbers or prices in quotes');
  }
});
