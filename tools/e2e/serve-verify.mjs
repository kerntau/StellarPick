import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

const ROOT = resolve(process.argv[2] || 'T:/StellarPick/vendor/juice-shop/frontend/dist/verify-a11y/browser');
const PORT = Number(process.argv[3] || 8098);
const UPSTREAM = process.env.UPSTREAM || 'http://127.0.0.1:8081';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.vtt': 'text/vtt',
  '.mp4': 'video/mp4'
};

function fileFor (urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = normalize(clean).replace(/^([/\\])+/, '');
  const full = resolve(join(ROOT, rel));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

function readBody (req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', rejectBody);
  });
}

async function proxy (req, res) {
  const target = UPSTREAM + req.url;
  const headers = { ...req.headers, host: new URL(UPSTREAM).host };
  delete headers.connection;
  delete headers['content-length'];
  const init = { method: req.method, headers, redirect: 'manual' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await readBody(req);
    if (body.length > 0) {
      init.body = body;
      headers['content-length'] = String(body.length);
    }
  }
  try {
    const upstream = await fetch(target, init);
    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (key === 'content-encoding' || key === 'transfer-encoding' || key === 'content-length') return;
      res.setHeader(key, value);
    });
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
    else res.end();
  } catch (err) {
    res.statusCode = 502;
    res.end('proxy error: ' + err.message);
  }
}

const server = createServer(async (req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const file = fileFor(urlPath);
  if (file && existsSync(file) && statSync(file).isFile()) {
    res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    createReadStream(file).pipe(res);
    return;
  }
  await proxy(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('serving ' + ROOT + ' on http://127.0.0.1:' + PORT + ' (proxy -> ' + UPSTREAM + ')');
});
