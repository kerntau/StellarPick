const BASE = 'http://127.0.0.1:8081';

async function req(path, options = {}) {
  const response = await fetch(BASE + path, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { s: response.status, j: json, t: text };
}

const login = async (email, password) => await req('/rest/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

const aliceLogin = await login('alice@stellarpick.example', 'Alice@2026');
const alice = aliceLogin.j?.authentication?.token;
const adminLogin = await login('admin@stellarpick.example', 'admin123');
const admin = adminLogin.j?.authentication?.token;

const bearer = (token) => ({ Authorization: 'Bearer ' + token });
const results = [];
const rec = (id, pass, detail) => {
  results.push({ id, pass, detail });
  console.log((pass ? 'PASS ' : 'FAIL ') + id + ' ' + JSON.stringify(detail));
};

if (!alice || !admin) {
  console.error('FATAL: seed accounts are not usable', { alice: aliceLogin.s, admin: adminLogin.s });
  process.exit(1);
}

// N01 - a normal Chinese keyword is not a SQL injection.
const n01 = await req('/rest/products/search?q=' + encodeURIComponent('手机'));
rec('N01', n01.s === 200 && Array.isArray(n01.j?.data) && n01.j.data.length > 0, {
  status: n01.s,
  count: n01.j?.data?.length,
});

// N02 - plain text keyword does not trigger the reflected XSS path.
const n02 = await req('/rest/products/search?q=hello');
rec('N02', n02.s === 200 && Array.isArray(n02.j?.data), {
  status: n02.s,
  count: n02.j?.data?.length,
});

// N03 - valid credentials log in normally.
rec('N03', aliceLogin.s === 200 && !!alice, { status: aliceLogin.s });

// N04 - Alice can read her own order 1001 (control for V05).
const n04 = await req('/api/orders/1001', { headers: bearer(alice) });
rec('N04', n04.s === 200 && n04.j?.ownerId === 2 && n04.j?.ownerEmail === 'alice@stellarpick.example', {
  status: n04.s,
  ownerId: n04.j?.ownerId,
  ownerEmail: n04.j?.ownerEmail,
});

// N05 - the lab user directory still requires a login.
const n05 = await req('/api/admin/users');
rec('N05', n05.s === 401, { status: n05.s });

// N06 - a member cannot read the admin-only settings endpoint.
const n06 = await req('/api/admin/settings', { headers: bearer(alice) });
rec('N06', n06.s === 403, { status: n06.s });

// N06-admin - the real admin can (positive control for N06).
const n06Admin = await req('/api/admin/settings', { headers: bearer(admin) });
rec('N06-admin', n06Admin.s === 200 && n06Admin.j?.siteName === '星澜优选', {
  status: n06Admin.s,
  siteName: n06Admin.j?.siteName,
});

const failed = results.filter((result) => !result.pass);
console.log('SUMMARY', results.length, 'checks', failed.length, 'failed');
process.exitCode = failed.length ? 1 : 0;
