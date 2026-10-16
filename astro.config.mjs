import { defineConfig } from 'astro/config';

// Static output. No integrations: the concept makes zero third-party requests.
// SITE_BASE is set only for the GitHub Pages build (a project site lives under /sunny-side/).
const base = process.env.SITE_BASE || '/';

export default defineConfig({
  output: 'static',
  base,
  build: { inlineStylesheets: 'auto' },
});
