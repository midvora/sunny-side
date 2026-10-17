import business from '../data/business.json';
import servicesData from '../data/services.json';
import faqData from '../data/faq.json';
import testimonialsData from '../data/testimonials.json';
import areasData from '../data/areas.json';
import contentData from '../data/content.json';
import legalData from '../data/legal.json';
import { hoursSummary, type Hours } from './hours';

export type Status = 'confirmed' | 'sample' | 'stock' | 'licensed' | 'not-offered';

export interface FactRecord {
  label: string;
  value: string | null;
  status: Status;
  source: string;
  ask: string;
  tel?: string;
  parts?: { street: string; city: string; region: string; postalCode: string; country: string; lat: number; lon: number };
}

export interface Service {
  slug: string;
  href?: string;
  name: string;
  category: string;
  icon: string;
  image: string;
  short: string;
  title: string;
  description: string;
  lead?: string;
  intro?: string[];
  included?: string[];
  signs?: string[];
  steps?: { t: string; d: string }[];
  faqs?: { q: string; a: string }[];
  related?: string[];
  status: Status;
}

/** true only for `npm run build:launch`. The concept build is noindex and carries a small "design preview" credit. */
export const LAUNCH = import.meta.env.PUBLIC_LAUNCH === 'true';

const BLOCKED = new Set(['sample', 'stock', 'unconfirmed']);

/** Safety net behind the launch gate: a launch build refuses to render anything still flagged as sample or stock. */
export function guard<T extends { status?: string }>(item: T, label: string): T {
  if (LAUNCH && item.status && BLOCKED.has(item.status)) {
    throw new Error(`Launch build blocked: ${label} is still "${item.status}"`);
  }
  return item;
}

export const facts = business.facts as Record<string, FactRecord>;
export const hours = guard(business.hours as unknown as Hours & { status: Status }, 'hours');

export function fact(id: string): FactRecord {
  const f = facts[id];
  if (!f) throw new Error(`Unknown fact "${id}" (not in src/data/business.json)`);
  return guard(f, `fact "${id}"`);
}

export const value = (id: string): string => fact(id).value ?? '';

/** Prefix a site path with the configured base (`/` locally, `/sunny-side/` on GitHub Pages). */
export function withBase(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

export function absoluteUrl(path = ''): string | undefined {
  const site = import.meta.env.SITE;
  return site ? new URL(withBase(path), site).href : undefined;
}

// ---- {{tokens}} so copy always agrees with the facts ----
function tokens(): Record<string, string> {
  return {
    businessName: value('businessName'),
    phone: value('phone'),
    email: value('email'),
    address: value('address'),
    city: value('location'),
    hours: hoursSummary(hours),
    estimates: value('estimates'),
    payment: value('payment'),
    appointments: value('appointments'),
    emergency: value('emergency'),
    serviceArea: value('serviceArea'),
    serviceModel: value('serviceModel'),
    insurance: value('insurance'),
    warranty: value('warranty'),
  };
}

export function fill(text: string): string {
  const map = tokens();
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in map)) throw new Error(`Unknown token {{${key}}}`);
    return map[key];
  });
}

export function fillDeep<T>(x: T): T {
  if (typeof x === 'string') return fill(x) as unknown as T;
  if (Array.isArray(x)) return x.map(fillDeep) as unknown as T;
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k.startsWith('_') ? v : fillDeep(v)])) as T;
  }
  return x;
}

// ---- derived contact data ----
export const tel = (): string => `tel:${facts.phone.tel}`;
// Display form keeps the number on one line: non-breaking hyphens (U+2011) and spaces (U+00A0).
export const phoneText = (): string => value('phone').replaceAll('-', '\u2011').replaceAll(' ', '\u00a0');
export const emailText = (): string => value('email');
export const addressText = (): string => value('address');
export const addressParts = () => facts.address.parts!;
export const directionsUrl = (): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressText())}`;

export function mapEmbedUrl(): string {
  const { lat, lon } = addressParts();
  const d = 0.012;
  const bbox = [lon - d, lat - d * 0.6, lon + d, lat + d * 0.6].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
}

export const mapLinkUrl = (): string => {
  const { lat, lon } = addressParts();
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
};

// ---- content ----
export const services: Service[] = (servicesData.services as Service[]).map((s) => guard(s, `service "${s.slug}"`));
export const serviceCategories = servicesData.categories as { id: string; name: string; blurb: string }[];
export const serviceHref = (s: Service): string => withBase(s.href ?? `services/${s.slug}/`);
export const getService = (slug: string): Service => {
  const s = services.find((x) => x.slug === slug);
  if (!s) throw new Error(`Unknown service "${slug}"`);
  return s;
};

export interface FaqItem { q: string; a: string; status?: string }
export interface FaqGroup { id: string; name: string; items: FaqItem[] }
export const faqGroups: FaqGroup[] = fillDeep(
  (faqData.groups as FaqGroup[]).map((g) => ({
    ...g,
    items: g.items.map((i) => guard(i, `faq "${i.q}"`)),
  })),
);

export interface Testimonial { quote: string; name: string; role: string; status?: string }
export const testimonials: Testimonial[] = (testimonialsData.testimonials as Testimonial[]).map((t) =>
  guard(t, `testimonial by ${t.name}`),
);

export const areas = guard(areasData as { home: string; cities: string[]; status: Status }, 'service area list');

// `content.json` is nested; guard every block that carries a status, then resolve {{tokens}}.
function guardTree(node: unknown, path: string): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.status === 'string') guard(obj as { status: string }, path);
  for (const [k, v] of Object.entries(obj)) if (!k.startsWith('_')) guardTree(v, `${path}.${k}`);
}
guardTree(contentData, 'content');
export const content = fillDeep(contentData);

export const legal = {
  privacy: guard(legalData.privacy as { lastUpdated: string; status: Status }, 'privacy policy'),
  terms: guard(legalData.terms as { lastUpdated: string; status: Status }, 'terms of use'),
};

export const siteName = (): string => value('businessName');
