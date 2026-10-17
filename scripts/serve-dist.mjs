#!/usr/bin/env node
// A tiny static server that behaves like production static hosting (GitHub Pages): it compresses text
// (brotli or gzip), sends long-lived cache headers for hashed assets and serves 404.html with a 404 status.
// `astro preview` does none of that, which makes lab performance numbers pessimistic.
// Usage: node scripts/serve-dist.mjs [distDir] [port]   (honors SITE_BASE)
import http from 'node:http';
import zlib from 'node:zlib';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const dist = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4323);
const base = (process.env.SITE_BASE || '').replace(/\/$/, '');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.svg']);
const cache = new Map();

function find(urlPath) {
  const p = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [join(dist, p)];
  if (p.endsWith('/') || extname(p) === '') candidates.push(join(dist, p, 'index.html'));
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
}

http
  .createServer((req, res) => {
    let path = new URL(req.url, 'http://x').pathname;
    if (base) {
      if (path === base) path = `${base}/`;
      if (!path.startsWith(`${base}/`)) path = '/__outside_base__';
      else path = path.slice(base.length) || '/';
    }
    let file = find(path);
    let status = 200;
    if (!file) {
      file = join(dist, '404.html');
      status = 404;
    }
    const ext = extname(file);
    const headers = {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': file.includes('/_astro/') ? 'public, max-age=31536000, immutable' : 'public, max-age=600',
    };
    let body = readFileSync(file);
    if (COMPRESSIBLE.has(ext)) {
      const accept = String(req.headers['accept-encoding'] ?? '');
      const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : '';
      if (enc) {
        const key = `${file}:${enc}`;
        if (!cache.has(key)) cache.set(key, enc === 'br' ? zlib.brotliCompressSync(body) : zlib.gzipSync(body, { level: 9 }));
        body = cache.get(key);
        headers['Content-Encoding'] = enc;
        headers.Vary = 'Accept-Encoding';
      }
    }
    headers['Content-Length'] = body.length;
    res.writeHead(status, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  })
  .listen(port, '127.0.0.1', () => console.log(`serving ${dist} at http://127.0.0.1:${port}${base}/`));
