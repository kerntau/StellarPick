/**
 * StellarPick responsive + keyboard gate.
 *
 * 1. No horizontal scrolling at 360 / 390 / 768 / 1024 / 1440 on every route.
 * 2. Tab focus is always visible (outline or ring).
 * 3. Modal traps focus, closes on Escape and returns focus to its trigger.
 *
 *   node a11y-responsive.mjs
 *   BASE_URL=http://127.0.0.1:8081 node a11y-responsive.mjs
 */
import { chromium } from 'playwright-core';
import { CHROME } from './browser.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8081';
const WIDTHS = (process.env.A11Y_WIDTHS || '360,390,768,1024,1440').split(',').map(Number);

const ACCOUNTS = {
  alice: { email: 'alice@stellarpick.example', password: 'Alice@2026' },
  merchant: { email: 'merchant@stellarpick.example', password: 'Merchant@2026' },
  admin: { email: 'admin@stellarpick.example', password: 'admin123' }
};

const ROUTES = [
  { name: 'home', path: '/#/', user: 'alice' },
  { name: 'search', path: '/#/search?q=' + encodeURIComponent('星澜'), user: 'alice' },
  { name: 'category', path: '/#/category/all', user: 'alice' },
  { name: 'product', path: '/#/product/1003', user: 'alice' },
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
  { name: 'merchant', path: '/#/merchant', user: 'merchant' },
  { name: 'merchant-products', path: '/#/merchant/products', user: 'merchant' },
  { name: 'merchant-orders', path: '/#/merchant/orders', user: 'merchant' },
  { name: 'admin-users', path: '/#/admin/users', user: 'admin' },
  { name: 'admin-merchants', path: '/#/admin/merchants', user: 'admin' },
  { name: 'about', path: '/#/about', user: 'alice' },
  { name: 'help', path: '/#/help', user: 'alice' },
  { name: 'not-found', path: '/#/404', user: 'alice' }
];

async function login (account) {
  const response = await fetch(BASE + '/rest/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account)
  });
  if (!response.ok) throw new Error('login failed for ' + account.email);
  return (await response.json()).authentication.token;
}

const tokens = {};
for (const [key, account] of Object.entries(ACCOUNTS)) tokens[key] = await login(account);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const failures = [];
const check = (ok, label, detail = '') => {
  if (!ok) failures.push(label + (detail ? ' :: ' + detail : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ' :: ' + detail : ''));
};

/* One context per (width, account) keeps the run light: spawning a browser
   context per route exhausts the renderer after a couple of dozen routes. */
const contexts = new Map();
async function contextFor (user, width, height = 900) {
  const key = width + ':' + user;
  if (!contexts.has(key)) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    await context.addInitScript((token) => {
      try {
        localStorage.setItem('token', token);
      } catch {}
    }, tokens[user]);
    contexts.set(key, context);
  }
  return contexts.get(key);
}

async function gotoRoute (page, route) {
  await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => !!document.querySelector('h1'), null, { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

/* ---------- 1. horizontal overflow ---------- */
for (const width of WIDTHS) {
  for (const route of ROUTES) {
    const context = await contextFor(route.user, width);
    const page = await context.newPage();
    try {
      await gotoRoute(page, route);
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        let widest = null;
        for (const element of document.querySelectorAll('body *')) {
          const style = getComputedStyle(element);
          if (style.position === 'fixed' || style.display === 'none' || style.visibility === 'hidden') continue;
          const rect = element.getBoundingClientRect();
          if (rect.width === 0) continue;
          if (rect.right > doc.clientWidth + 1 && (!widest || rect.right > widest.right)) {
            widest = { right: Math.round(rect.right), tag: element.tagName, cls: String(element.className).slice(0, 60) };
          }
        }
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, widest };
      });
      check(
        metrics.scrollWidth <= metrics.clientWidth,
        width + 'px no horizontal scroll: ' + route.name,
        metrics.scrollWidth > metrics.clientWidth
          ? 'scrollWidth=' + metrics.scrollWidth + ' clientWidth=' + metrics.clientWidth + ' widest=' + JSON.stringify(metrics.widest)
          : ''
      );
    } catch (error) {
      check(false, width + 'px no horizontal scroll: ' + route.name, String(error).slice(0, 200));
    } finally {
      await page.close();
    }
  }
}

/* ---------- 2. visible keyboard focus ---------- */
for (const width of [390, 1440]) {
  const context = await contextFor('alice', width);
  const page = await context.newPage();
  try {
    await gotoRoute(page, { path: '/#/' });
    const stops = [];
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return null;
        const style = getComputedStyle(element);
        const outlineVisible = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 1;
        const ring = style.boxShadow && style.boxShadow !== 'none';
        return {
          tag: element.tagName,
          label: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 24),
          focusVisible: element.matches(':focus-visible'),
          outlineVisible: Boolean(outlineVisible),
          ring: Boolean(ring)
        };
      });
      if (info) stops.push(info);
    }
    const bad = stops.filter((stop) => !stop.focusVisible || (!stop.outlineVisible && !stop.ring));
    check(stops.length >= 8, width + 'px tab reaches focusable elements', 'stops=' + stops.length);
    check(bad.length === 0, width + 'px every tab stop shows a focus indicator', JSON.stringify(bad.slice(0, 4)));
  } catch (error) {
    check(false, width + 'px keyboard focus', String(error).slice(0, 200));
  } finally {
    await page.close();
  }
}

/* ---------- 3. first-screen images are not deferred ---------- */
{
  const context = await contextFor('alice', 1440);
  const page = await context.newPage();
  try {
    await gotoRoute(page, { path: '/#/' });
    await page.waitForSelector('app-product-card img', { timeout: 15000 });
    const images = await page.evaluate(() =>
      Array.from(document.querySelectorAll('app-product-card img')).slice(0, 6).map((img) => ({
        loading: img.getAttribute('loading'),
        priority: img.getAttribute('fetchpriority')
      }))
    );
    const eager = images.slice(0, 4);
    const lazy = images.slice(4);
    check(
      eager.length === 4 && eager.every((img) => img.loading === 'eager' && img.priority === 'high'),
      'first 4 product images load eagerly with fetchpriority=high',
      JSON.stringify(images)
    );
    check(lazy.every((img) => img.loading === 'lazy' && !img.priority), 'remaining product images stay lazy', JSON.stringify(lazy));
  } catch (error) {
    check(false, 'first-screen image priority', String(error).slice(0, 200));
  } finally {
    await page.close();
  }
}

/* ---------- 4. modal focus trap / Escape / focus restore ---------- */
{
  const context = await contextFor('alice', 1440);
  const page = await context.newPage();
  try {
    await page.goto(BASE + '/#/account/addresses', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("新增地址")');
    const trigger = page.locator('button:has-text("新增地址")').first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(300);

    const insideAtOpen = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return !!dialog && dialog.contains(document.activeElement);
    });
    check(insideAtOpen, 'modal moves focus inside the dialog');

    let escaped = null;
    for (let i = 0; i < 16; i += 1) {
      await page.keyboard.press('Tab');
      const state = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog ? dialog.contains(document.activeElement) : null;
      });
      if (state === false) escaped = i + 1;
    }
    check(escaped === null, 'modal keeps Tab focus trapped', escaped ? 'escaped after ' + escaped + ' tabs' : '');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const afterEscape = await page.evaluate(() => ({
      open: !!document.querySelector('[role="dialog"]'),
      focusLabel: (document.activeElement?.textContent || '').trim().slice(0, 20),
      focusTag: document.activeElement?.tagName
    }));
    check(!afterEscape.open, 'Escape closes the modal');
    check(afterEscape.focusTag === 'BUTTON' && afterEscape.focusLabel.includes('新增地址'), 'focus returns to the trigger', JSON.stringify(afterEscape));
  } catch (error) {
    check(false, 'modal keyboard behaviour', String(error).slice(0, 300));
  } finally {
    await page.close();
  }
}

for (const context of contexts.values()) {
  await context.close();
}
await browser.close();
console.log('---');
console.log('checks failed=' + failures.length);
if (failures.length > 0) {
  process.exit(1);
}
console.log('responsive + keyboard: all checks passed');