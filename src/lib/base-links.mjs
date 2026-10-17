// Sätteri (Astro 7's Markdown engine) plugin: prefix root-relative links in Markdown with the site's base path,
// so articles written with links like (/roadside-assistance/) work locally and under /sunny-side/ on GitHub Pages.
import { defineMdastPlugin } from 'satteri';

export function baseLinks(base = '/') {
  const prefix = base.replace(/\/$/, '');
  return defineMdastPlugin({
    name: 'base-links',
    link(node, ctx) {
      const url = node.url;
      if (prefix && url.startsWith('/') && !url.startsWith('//') && !url.startsWith(`${prefix}/`)) {
        ctx.setProperty(node, 'url', prefix + url);
      }
    },
  });
}
