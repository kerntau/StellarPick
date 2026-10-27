// 星澜优选 · 首屏性能与包体预算检查
// 运行：node tools/e2e/perf.mjs
// 退出码：0 = 全部预算通过；1 = 初始 JS 传输或 LCP 超预算
import { chromium } from 'playwright-core';
import { CHROME } from './browser.mjs';

const BASE = process.env.PERF_BASE || 'http://127.0.0.1:8081';

// 预算（1KB = 1024B）
const INITIAL_JS_BUDGET = 300 * 1024; // 初始 JS transferSize 合计 ≤ 300KB
const INITIAL_JS_GOAL = 200 * 1024;   // 项目目标 ≤ 200KB（未达标只提示，不判失败）
const LCP_BUDGET = 800;               // 每条路由 LCP ≤ 800ms

const ROUTES = [
  '/',
  '/#/search?q=' + encodeURIComponent('星澜'),
  '/#/product/1003',
  '/#/cart',
  '/#/checkout',
  '/#/merchant',
  '/#/merchant/products',
  '/#/admin/users',
  '/#/account/orders'
];

const kib = (n) => Math.round(n / 1024 * 10) / 10;

const login = await fetch(BASE + '/rest/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'alice@stellarpick.example', password: 'Alice@2026' })
});
if (!login.ok) throw new Error('login failed: ' + login.status);
const userToken = (await login.json()).authentication.token;
const merchantLogin = await fetch(BASE + '/rest/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'merchant@stellarpick.example', password: 'Merchant@2026' })
});
if (!merchantLogin.ok) throw new Error('merchant login failed: ' + merchantLogin.status);
const merchantToken = (await merchantLogin.json()).authentication.token;

// index.html 里 modulepreload + script 引用的 JS 即 Angular 认定的初始包
const indexHtml = await (await fetch(BASE + '/')).text();
const initialJs = [...new Set([...indexHtml.matchAll(/(?:modulepreload" href|src)="([^"]+\.js)"/g)].map((m) => m[1]))];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
// Warm up Chrome and the server before measuring; the first navigation would
// otherwise pay for the browser cold start and the app's first lazy chunk.
const warmContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const warmPage = await warmContext.newPage();
await warmPage.goto(BASE + '/', { waitUntil: 'networkidle' });
await warmContext.close();

const pages = [];
const violations = [];

for (const route of ROUTES) {
  // 每条路由使用全新 context，避免缓存让 transferSize 变成 0
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const routeToken = route.startsWith('/merchant') ? merchantToken : userToken;
  await context.addInitScript((t) => {
    localStorage.setItem('token', t);
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  }, routeToken);

  const page = await context.newPage();
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate((initialNames) => {
    const resources = performance.getEntriesByType('resource');
    const isJs = (name) => /\.js(\?|$)/.test(name);
    let initialTransfer = 0;
    let initialEncoded = 0;
    let initialDecoded = 0;
    let routeJs = 0;
    for (const resource of resources) {
      const file = resource.name.split('/').pop();
      if (initialNames.includes(file)) {
        initialTransfer += resource.transferSize || 0;
        initialEncoded += resource.encodedBodySize || 0;
        initialDecoded += resource.decodedBodySize || 0;
      } else if (isJs(resource.name)) {
        routeJs += resource.transferSize || 0;
      }
    }
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      lcp: Math.round(window.__lcp || 0),
      dcl: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      resources: resources.length,
      initialTransfer,
      initialEncoded,
      initialDecoded,
      routeJs
    };
  }, initialJs);

  const row = { route, ...metrics, initialTransferKb: kib(metrics.initialTransfer), initialEncodedKb: kib(metrics.initialEncoded), routeJsKb: kib(metrics.routeJs) };
  pages.push(row);

  if (metrics.lcp > LCP_BUDGET) violations.push(`LCP ${route} = ${metrics.lcp}ms > ${LCP_BUDGET}ms`);
  if (metrics.initialTransfer > INITIAL_JS_BUDGET) violations.push(`initial JS transfer ${route} = ${kib(metrics.initialTransfer)}KB > ${kib(INITIAL_JS_BUDGET)}KB`);

  await context.close();
}

await browser.close();

// 接口延迟（各 5 次，取平均 / P95）
const api = [];
for (const path of ['/api/Products/1003', '/rest/products/search?q=' + encodeURIComponent('星澜'), '/api/orders/1002']) {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + userToken } });
    times.push(Date.now() - start);
  }
  times.sort((a, b) => a - b);
  api.push({
    path,
    avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    p95: times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)]
  });
}

const initialJsTransfer = Math.max(...pages.map((p) => p.initialTransfer));
const initialJsEncoded = Math.max(...pages.map((p) => p.initialEncoded));
const maxLcp = Math.max(...pages.map((p) => p.lcp));

console.log('route'.padEnd(28), 'DCL'.padStart(6), 'load'.padStart(6), 'LCP'.padStart(6), 'res'.padStart(5), 'initialJS'.padStart(11), 'routeJS'.padStart(9));
for (const p of pages) {
  console.log(
    p.route.padEnd(28),
    String(p.dcl).padStart(6),
    String(p.load).padStart(6),
    String(p.lcp).padStart(6),
    String(p.resources).padStart(5),
    (p.initialTransferKb + 'KB').padStart(11),
    (p.routeJsKb + 'KB').padStart(9)
  );
}

console.log('');
console.log('initial JS files :', initialJs.length, initialJs.join(', '));
console.log(`initial JS raw   : ${kib(pages[0].initialDecoded)}KB`);
console.log(`initial JS encoded: ${kib(initialJsEncoded)}KB (brotli/gzip body)`);
console.log(`initial JS transfer: ${kib(initialJsTransfer)}KB / ${(initialJsTransfer / 1000).toFixed(1)}kB (${initialJsTransfer}B, 含响应头, budget ${kib(INITIAL_JS_BUDGET)}KB)`);
console.log(`max LCP          : ${maxLcp}ms (budget ${LCP_BUDGET}ms)`);
console.log(`goal 200KB       : ${initialJsTransfer <= INITIAL_JS_GOAL ? 'PASS' : 'MISS (见 tools/e2e/perf.mjs 的 INITIAL_JS_* 常量)'} (1KB=1024B; 十进制 ${(initialJsTransfer / 1000).toFixed(1)}kB)`);

console.log('');
console.log('API latency:');
for (const a of api) console.log('  ' + a.path.padEnd(44), 'avg ' + a.avg + 'ms', 'p95 ' + a.p95 + 'ms');

console.log('');
console.log(JSON.stringify({ initialJs, initialJsRawKb: kib(pages[0].initialDecoded), initialJsEncodedKb: kib(initialJsEncoded), initialJsTransferKb: kib(initialJsTransfer), initialJsTransferBytes: initialJsTransfer, initialJsEncodedBytes: initialJsEncoded, initialJsRawBytes: pages[0].initialDecoded, initialJsBudgetKb: kib(INITIAL_JS_BUDGET), lcpBudgetMs: LCP_BUDGET, maxLcpMs: maxLcp, pages, api, violations }, null, 2));

if (violations.length > 0) {
  console.error('');
  console.error('PERF BUDGET FAILED:');
  for (const v of violations) console.error('  - ' + v);
  process.exitCode = 1;
} else {
  console.log('');
  console.log('PERF BUDGET OK');
}
