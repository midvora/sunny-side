import type { APIRoute } from 'astro';
import { LAUNCH, absoluteUrl } from '../lib/site';

// The concept build blocks all crawlers. Only `npm run build:launch` (gated on confirmed content) allows indexing.
export const GET: APIRoute = () => {
  const sitemap = LAUNCH && absoluteUrl('sitemap.xml') ? `Sitemap: ${absoluteUrl('sitemap.xml')}\n` : '';
  const body = LAUNCH ? `User-agent: *\nAllow: /\n${sitemap}` : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
