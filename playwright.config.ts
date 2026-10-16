import { defineConfig } from '@playwright/test';

const PORT = 4322;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'off',
  },
  // Serves the already-built concept (`npm run build` first). Never a launch build.
  webServer: {
    command: `npx astro preview --ignore-lock --port ${PORT} --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
