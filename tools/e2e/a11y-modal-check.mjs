import { chromium } from 'playwright-core';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8098';
const login = async (email, password) => {
  const r = await fetch(BASE + '/rest/user/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!r.ok) throw new Error('login failed ' + email);
  return (await r.json()).authentication.token;
};
const tokens = {
  alice: await login('alice@stellarpick.example', 'Alice@2026'),
  merchant: await login('merchant@stellarpick.example', 'Merchant@2026')
};
const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const results = [];
const check = (ok, label, detail = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ' :: ' + detail : '')); };

async function pageFor (user, path, width = 1440) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('token', t) } catch {} }, tokens[user]);
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  return { ctx, p };
}

// filter drawer (catalog)
{
  const { ctx, p } = await pageFor('alice', '/#/category/all', 390);
  try {
    await p.getByRole('button', { name: '筛选' }).click();
    await p.waitForSelector('[role="dialog"]');
    await p.waitForTimeout(300);
    const inside = await p.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.contains(document.activeElement); });
    check(inside, 'filter drawer moves focus inside');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const closed = await p.evaluate(() => !document.querySelector('[role="dialog"]'));
    check(closed, 'filter drawer closes on Escape');
  } catch (e) { check(false, 'filter drawer', String(e).slice(0, 200)); }
  await ctx.close();
}

// merchant product modal
{
  const { ctx, p } = await pageFor('merchant', '/#/merchant/products');
  try {
    const trigger = p.getByRole('button', { name: '新增商品' });
    await trigger.click();
    await p.waitForSelector('[role="dialog"]');
    await p.waitForTimeout(300);
    await p.fill('#p-price', '199');
    let escaped = false;
    for (let i = 0; i < 20; i++) {
      await p.keyboard.press('Tab');
      const ok = await p.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.contains(document.activeElement); });
      if (!ok) { escaped = true; break; }
    }
    check(!escaped, 'merchant product modal traps Tab');
    const value = await p.inputValue('#p-price');
    check(value === '199', 'typing inside modal keeps working', value);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const state = await p.evaluate(() => ({ open: !!document.querySelector('[role="dialog"]'), text: (document.activeElement?.textContent || '').trim().slice(0, 20), tag: document.activeElement?.tagName }));
    check(!state.open, 'merchant modal closes on Escape');
    check(state.tag === 'BUTTON' && state.text.includes('新增商品'), 'focus returns to 新增商品', JSON.stringify(state));
  } catch (e) { check(false, 'merchant product modal', String(e).slice(0, 200)); }
  await ctx.close();
}

await b.close();
console.log('failed=' + results.filter((x) => !x).length);
process.exitCode = results.filter((x) => !x).length ? 1 : 0;