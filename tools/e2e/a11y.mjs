/**
 * StellarPick accessibility gate.
 *
 * Scans every StellarPick route with axe-core at 390px and 1440px and exits
 * non-zero as soon as a serious or moderate violation is found.
 *
 *   node a11y.mjs                       # 390 + 1440 against http://127.0.0.1:8081
 *   A11Y_WIDTHS=1440 node a11y.mjs      # single width
 *   A11Y_ROUTES=home,product node a11y.mjs
 */
import { chromium } from 'playwright-core';
import { CHROME } from './browser.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8081';
const WIDTHS = (process.env.A11Y_WIDTHS || '390,1440')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);

/** Account fixtures used by the seeded demo data. */
const ACCOUNTS = {
  alice: { email: 'alice@stellarpick.example', password: 'Alice@2026' },
  merchant: { email: 'merchant@stellarpick.example', password: 'Merchant@2026' },
  admin: { email: 'admin@stellarpick.example', password: 'admin123' }
};

/** Real routes only: /#/product/16 no longer exists (product ids start at 1001). */
const ROUTES = [
  { name: 'home', path: '/#/', user: 'alice' },
  { name: 'search', path: '/#/search?q=' + encodeURIComponent('星澜'), user: 'alice' },
  { name: 'category', path: '/#/category/all', user: 'alice' },
  { name: 'product', path: '/#/product/1003', user: 'alice' },
  { name: 'product-reviews', path: '/#/product/1003/reviews', user: 'alice' },
  { name: 'cart', path: '/#/cart', user: 'alice' },
  { name: 'checkout', path: '/#/checkout', user: 'alice' },
  { name: 'login', path: '/#/login', user: 'alice' },
  { name: 'register', path: '/#/register', user: 'alice' },
  { name: 'orders', path: '/#/account/orders', user: 'alice' },
  { name: 'order-detail', path: '/#/account/orders/1002', user: 'alice' },
  { name: 'addresses', path: '/#/account/addresses', user: 'alice' },
  { name: 'profile', path: '/#/account/profile', user: 'alice' },
  { name: 'reviews', path: '/#/account/reviews', user: 'alice' },
  { name: 'tickets', path: '/#/support/tickets', user: 'alice' },
  { name: 'ticket-detail', path: '/#/support/tickets/1', user: 'alice' },
  { name: 'merchant', path: '/#/merchant', user: 'merchant' },
  { name: 'merchant-products', path: '/#/merchant/products', user: 'merchant' },
  { name: 'merchant-orders', path: '/#/merchant/orders', user: 'merchant' },
  { name: 'admin', path: '/#/admin', user: 'admin' },
  { name: 'admin-users', path: '/#/admin/users', user: 'admin' },
  { name: 'admin-merchants', path: '/#/admin/merchants', user: 'admin' },
  { name: 'about', path: '/#/about', user: 'alice' },
  { name: 'help', path: '/#/help', user: 'alice' },
  { name: 'privacy', path: '/#/privacy', user: 'alice' },
  { name: 'terms', path: '/#/terms', user: 'alice' },
  { name: 'not-found', path: '/#/404', user: 'alice' }
];

const only = (process.env.A11Y_ROUTES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const routes = only.length > 0 ? ROUTES.filter((route) => only.includes(route.name)) : ROUTES;

async function login (account) {
  const response = await fetch(BASE + '/rest/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account)
  });
  if (!response.ok) {
    throw new Error('login failed for ' + account.email + ' (' + response.status + ')');
  }
  return (await response.json()).authentication.token;
}

const tokens = {};
for (const [key, account] of Object.entries(ACCOUNTS)) {
  tokens[key] = await login(account);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const failures = [];
let scanned = 0;

/* One context per (width, account) instead of one per route: a fresh context
   per scan exhausts the renderer and kills the browser halfway through. */
const contexts = new Map();
async function contextFor (user, width) {
  const key = width + ':' + user;
  if (!contexts.has(key)) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
    await context.addInitScript((token) => {
      try {
        localStorage.setItem('token', token);
      } catch {
        /* storage unavailable: the page simply renders signed out */
      }
    }, tokens[user]);
    contexts.set(key, context);
  }
  return contexts.get(key);
}

for (const width of WIDTHS) {
  for (const route of routes) {
    const context = await contextFor(route.user, width);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push('PAGEERROR ' + error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text().slice(0, 160));
      }
    });

    try {
      await page.goto(BASE + route.path, { waitUntil: 'networkidle', timeout: 45000 });
      // Wait for the rendered view instead of a fixed delay, otherwise axe can
      // scan a skeleton (which has no h1) and report a false page-has-heading-one.
      await page.waitForFunction(() => !!document.querySelector('h1'), null, { timeout: 15000 });
      await page.waitForTimeout(500);

      const rendered = await page.evaluate(() => document.body.innerText.trim().length);
      if (rendered < 40) {
        throw new Error('page rendered almost no text (' + rendered + ' chars)');
      }

      await page.addScriptTag({ path: axePath });
      const result = await page.evaluate(async () => await window.axe.run(document, { resultTypes: ['violations'] }));
      const violations = result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' '))
      }));
      const blocking = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical' || violation.impact === 'moderate');

      if (blocking.length > 0 || errors.length > 0) {
        failures.push({ width, route: route.name, blocking, errors });
        console.log('FAIL ' + width + ' ' + route.name + ' ' + route.path);
        for (const violation of blocking) {
          console.log('     ' + violation.id + ' [' + violation.impact + '] x' + violation.nodes + ' :: ' + violation.targets.join(' | '));
        }
        for (const error of errors.slice(0, 3)) {
          console.log('     console: ' + error);
        }
      } else {
        console.log('PASS ' + width + ' ' + route.name + ' (' + violations.length + ' non-blocking)');
      }
      scanned += 1;
    } catch (error) {
      failures.push({ width, route: route.name, blocking: [], errors: [String(error).slice(0, 300)] });
      console.log('FAIL ' + width + ' ' + route.name + ' :: ' + String(error).slice(0, 300));
    } finally {
      await page.close();
    }
  }
}

for (const context of contexts.values()) {
  await context.close();
}
await browser.close();

console.log('---');
console.log('scanned=' + scanned + ' failures=' + failures.length + ' widths=' + WIDTHS.join('/') + ' routes=' + routes.length);
if (failures.length > 0) {
  process.exit(1);
}
console.log('axe: no serious/moderate violations');