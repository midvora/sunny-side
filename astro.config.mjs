import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { baseLinks } from './src/lib/base-links.mjs';

// Static output. No integrations: the site makes zero third-party requests on load.
// SITE_BASE is set only for the GitHub Pages build (a project site lives under /sunny-side/).
// SITE_URL (e.g. https://midvora.github.io) gives absolute URLs for link previews and, in a launch build, canonical links.
const base = process.env.SITE_BASE || '/';
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  output: 'static',
  base,
  site,
  trailingSlash: 'always',
  build: { inlineStylesheets: 'auto' },
  markdown: { processor: satteri({ mdastPlugins: [baseLinks(base)] }) },
});
