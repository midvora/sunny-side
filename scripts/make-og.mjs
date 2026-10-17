#!/usr/bin/env node
// Renders public/og.jpg (1200x630), the image shown when a link to the site is shared in chat or social apps.
// Uses the site's own fonts, the hero photo and the client logo. Run: node scripts/make-og.mjs
import { chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = (p) => pathToFileURL(resolve(root, p)).href;
const business = JSON.parse((await import('node:fs')).readFileSync(resolve(root, 'src/data/business.json'), 'utf8')).facts;

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:BC;font-weight:700;src:url(${url('node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2')})}
@font-face{font-family:B;font-weight:600;src:url(${url('node_modules/@fontsource/barlow/files/barlow-latin-600-normal.woff2')})}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;position:relative;overflow:hidden;background:#0f1318;font-family:B}
.photo{position:absolute;inset:0;background:url(${url('src/assets/photos/hero-golden-hour.jpg')}) 20% 55%/cover}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,19,24,.97) 0%,rgba(15,19,24,.9) 42%,rgba(15,19,24,.15) 78%)}
.logo{position:absolute;left:64px;top:56px;background:#fff;border-radius:18px;padding:14px 22px}
.logo img{height:84px;display:block}
.copy{position:absolute;left:64px;bottom:70px;right:420px;color:#fff}
.kicker{font:700 30px BC;letter-spacing:.16em;text-transform:uppercase;color:#ffc21a;margin-bottom:12px}
h1{font:700 104px/0.94 BC;text-transform:uppercase}
h1 em{font-style:normal;color:#ffc21a}
.meta{margin-top:26px;font:600 30px B;color:#e6e0cf}
.bar{position:absolute;left:0;right:0;bottom:0;height:16px;background:repeating-linear-gradient(-45deg,#ffc21a 0 20px,#0f1318 20px 40px)}
</style>
<div class="photo"></div><div class="shade"></div>
<div class="logo"><img src="${url('src/assets/logo.png')}"></div>
<div class="copy">
  <p class="kicker">Roadside assistance</p>
  <h1>Truck &amp; trailer <em>repair</em></h1>
  <p class="meta">${business.location.value} · ${business.phone.value}</p>
</div>
<div class="bar"></div>`;

const dir = mkdtempSync(join(tmpdir(), 'og-'));
const file = join(dir, 'og.html');
writeFileSync(file, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(file).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(root, 'public/og.jpg'), type: 'jpeg', quality: 86 });
await browser.close();
console.log('wrote public/og.jpg');
