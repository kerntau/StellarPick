import { chromium } from 'playwright-core';
import { CHROME } from './browser.mjs';

const BASE = 'http://127.0.0.1:8081';
const PRODUCT_ID = 1003;

const login = await fetch(BASE + '/rest/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'alice@stellarpick.example', password: 'Alice@2026' }),
});
const token = (await login.json()).authentication.token;
const merchantLogin = await fetch(BASE + '/rest/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'merchant@stellarpick.example', password: 'Merchant@2026' }),
});
const merchantToken = (await merchantLogin.json()).authentication.token;

const routes = [
  '/',
  '/#/search?q=' + encodeURIComponent('星澜'),
  '/#/product/' + PRODUCT_ID,
  '/#/cart',
  '/#/checkout',
  '/#/login',
  '/#/register',
  '/#/account/profile',
  '/#/account/addresses',
  '/#/account/orders',
  '/#/account/orders/1002',
  '/#/admin/users',
  '/#/merchant',
  '/#/merchant/products',
  '/#/merchant/orders',
  '/#/support/tickets',
  '/#/product/' + PRODUCT_ID + '/reviews',
  '/#/nope',
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((value) => localStorage.setItem('token', value), token);
const merchantContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await merchantContext.addInitScript((value) => localStorage.setItem('token', value), merchantToken);

let bad = 0;
for (const route of routes) {
  const isMerchant = route.startsWith('/merchant');
  const page = await (isMerchant ? merchantContext : context).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push('PAGEERROR ' + error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text().slice(0, 120)); });
  const response = await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const body = await page.locator('body').innerText();
  const notFoundProduct = route.includes('/product/') && body.includes('商品不存在');
  const ok = response?.status() === 200 && body.length > 50 && errors.length === 0 && !notFoundProduct;
  if (!ok) {
    bad++;
    console.log('BAD', route, response?.status(), body.length, notFoundProduct ? 'PRODUCT_404' : '', errors.slice(0, 3));
  }
  await page.close();
}

console.log('SUMMARY routes', routes.length, 'bad', bad);
await browser.close();
process.exitCode = bad ? 1 : 0;
