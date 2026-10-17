import type { APIRoute } from 'astro';
import { LAUNCH, absoluteUrl, serviceHref, services } from '../lib/site';
import { articles } from '../lib/articles';

const staticPaths = ['', 'services/', 'roadside-assistance/', 'fleet-services/', 'about/', 'gallery/', 'service-area/', 'faq/', 'resources/', 'contact/', 'request-service/', 'privacy/', 'terms/'];

// Populated only in a launch build; the concept build is noindex, so it publishes an empty sitemap.
export const GET: APIRoute = () => {
  const paths = LAUNCH
    ? [
        ...staticPaths,
        ...services.filter((s) => !s.href).map((s) => `services/${s.slug}/`),
        ...articles.map((a) => `resources/${a.slug}/`),
      ]
    : [];
  const urls = paths.map((p) => `  <url><loc>${absoluteUrl(p) ?? p}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
