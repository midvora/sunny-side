import { defineConfig } from '@playwright/test';

const PORT = 4322;
// Same base the build used (SITE_BASE=/sunny-side for the GitHub Pages variant). Must end with a slash.
const BASE = (process.env.SITE_BASE || '').replace(/\/$/, '');
const ROOT = `http://127.0.0.1:${PORT}${BASE}/`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: ROOT,
    trace: 'off',
  },
  // Serves the already-built concept (`npm run build` first). Never a launch build.
  webServer: {
    command: `npx astro preview --ignore-lock --port ${PORT} --host 127.0.0.1`,
    url: ROOT,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
