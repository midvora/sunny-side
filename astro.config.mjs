import { defineConfig } from 'astro/config';

// Static output. No integrations: the concept makes zero third-party requests.
export default defineConfig({
  output: 'static',
  build: { inlineStylesheets: 'auto' },
});
