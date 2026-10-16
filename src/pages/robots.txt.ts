import type { APIRoute } from 'astro';
import { LAUNCH } from '../lib/site';

// The concept build blocks all crawlers. Only `npm run build:launch` (gated on confirmed facts) allows indexing.
export const GET: APIRoute = () => {
  const body = LAUNCH ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
