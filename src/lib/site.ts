import data from '../data/site.json';

export type Status = 'confirmed' | 'unconfirmed' | 'not-offered';

export interface FactRecord {
  label: string;
  value: string | null;
  status: Status;
  source: string;
  ask: string;
}

export interface Service {
  id: string;
  name: string;
  summary: string;
  status: Status;
  source: string;
}

export interface FaqItem {
  id: string;
  q: string;
  kind: 'guidance' | 'business';
  a?: string;
  source?: string;
  fact?: string;
}

export const facts = data.facts as Record<string, FactRecord>;
export const services = data.services as Service[];
export const faq = data.faq as FaqItem[];

/** true only for `npm run build:launch`. The concept build is noindex with a preview banner. */
export const LAUNCH = import.meta.env.PUBLIC_LAUNCH === 'true';

export function fact(id: string): FactRecord {
  const f = facts[id];
  if (!f) throw new Error(`Unknown fact "${id}" (not in src/data/site.json)`);
  return f;
}

/** Plain-text value for <title>/<meta>, where markup cannot mark a placeholder. */
export function factText(id: string): string {
  const f = fact(id);
  return f.value ?? `${f.label} (to be confirmed)`;
}

/** Prefix a site path with the configured base (`/` locally, `/sunny-side/` on GitHub Pages). */
export function withBase(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
