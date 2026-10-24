import { chromium } from 'playwright-core';
const login = await fetch('http://127.0.0.1:8081/rest/user/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'alice@stellarpick.example',password:'Alice@2026'}) });
const token = (await login.json()).authentication.token;
const routes = ['/', '/#/search?q=' + encodeURIComponent('星澜'), '/#/product/1003', '/#/cart', '/#/checkout', '/#/account/orders', '/#/account/orders/1002', '/#/admin/users', '/#/admin/merchants', '/#/account/profile', '/#/product/1003/reviews', '/#/merchant', '/#/merchant/products', '/#/merchant/orders', '/#/support/tickets', '/#/account/addresses', '/#/about', '/#/nope'];
let failed = 0;
const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
for (const width of [360, 768]) {
  const ctx = await b.newContext({ viewport: { width, height: 800 } });
  await ctx.addInitScript((t) => localStorage.setItem('token', t), token);
  for (const route of routes) {
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto('http://127.0.0.1:8081' + route, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, body: document.body.innerText.length }));
    console.log(width, route, 'overflow', m.sw > m.iw + 1 ? 'YES ' + m.sw + '/' + m.iw : 'no', 'errors', errors.length);
    if (m.sw > m.iw + 1 || errors.length > 0) failed++;
    if (m.sw > m.iw + 1) await p.screenshot({ path: 'T:\\StellarPick\\tools\\e2e\\shots\\overflow-' + width + '-' + route.replace(/[^a-z0-9]/gi,'_') + '.png', fullPage: false });
    await p.close();
  }
  await ctx.close();
}
await b.close();
if (failed > 0) {
  console.error('MOBILE_QA_FAILED', failed);
  process.exitCode = 1;
}