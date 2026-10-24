#!/usr/bin/env node
/*
 * StellarPick 独立 E2E 验证（Playwright / Chromium）
 *
 * 覆盖：
 *  - 游客：首页、搜索「保温杯」、商品 1003、about/help/privacy/terms、404
 *  - V03：搜索头 [innerHTML] 保留 img/onerror 并执行
 *  - alice（UI 表单登录）：加购 → 购物车 → 结算（地址/配送/提交）→ 成功页 → 订单列表
 *  - V05：alice 直接读取订单 1002，页面显示 bob（周远 / bob@stellarpick.example）
 *  - V04：商品 1003 评价 tab，评价正文按原始 HTML 渲染（innerHTML）
 *  - 个人中心、地址、工单详情与回复
 *  - admin：/admin/users、/admin/merchants
 *  - merchant：/merchant、/merchant/products、/merchant/orders（只读）
 *  - 注册新唯一邮箱并验证自动登录
 *
 * 每个检查都记录 console error、pageerror、横向溢出（scrollWidth > clientWidth）。
 * 输出 tools/e2e/flow-report.json；有 FAIL 时 exit 1，并在控制台打印失败截图路径。
 *
 * 说明：本脚本只新增数据（订单、工单回复、标记评价、注册账号），不删除任何数据。
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8081').replace(/\/+$/, '');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SHOT_DIR = process.env.SHOT_DIR || 'shots/flow';
const REPORT_FILE = process.env.REPORT_FILE || 'flow-report.json';
const HEADLESS = process.env.HEADLESS !== '0';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
];

const ACCOUNTS = {
  alice: { username: 'alice@stellarpick.example', password: 'Alice@2026', name: 'alice' },
  admin: { username: 'admin@stellarpick.example', password: 'admin123', name: 'admin' },
  merchant: { username: 'merchant@stellarpick.example', password: 'Merchant@2026', name: 'merchant' },
};

const V03_PAYLOAD = '<img src=x onerror="window.__v03=1">';
const V04_MARKER =
  '<img src="/assets/sp/img/avatar-default.svg" onerror="window.__v04=1" data-e2e="v04" alt=""> E2E 评价渲染校验';

const startedAt = new Date().toISOString();
mkdirSync(SHOT_DIR, { recursive: true });

const report = {
  generatedAt: startedAt,
  baseUrl: BASE,
  chrome: CHROME,
  viewports: VIEWPORTS.map((vp) => vp.name),
  summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
  checks: [],
  findings: [],
  notes: [],
  dataMutations: { orders: [], users: [], ticketReplies: [], reviews: [] },
};

const pageState = new WeakMap();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const firstLine = (value) => String(value == null ? '' : value).split('\n')[0];
const sanitize = (value) => String(value).replace(/[^a-zA-Z0-9._-]+/g, '-');

function track(page) {
  const state = { consoleErrors: [], pageErrors: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') state.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => state.pageErrors.push(String(err && err.message ? err.message : err)));
  pageState.set(page, state);
  return state;
}

async function capture(page, name) {
  const file = join(SHOT_DIR, sanitize(name) + '.png');
  await page.screenshot({ path: file, fullPage: true, timeout: 20000 });
  return file.replace(/\\/g, '/');
}

async function waitForServer(seconds = 60) {
  for (let i = 0; i < seconds; i++) {
    try {
      const res = await fetch(BASE + '/rest/products/search?q=');
      if (res.ok) {
        console.log('server ready: ' + BASE);
        return;
      }
    } catch {
      /* 8081 可能正被后端重启，继续等待 */
    }
    await sleep(1000);
  }
  throw new Error('8081 在 60s 内不可达：' + BASE);
}

/** hash 路由：连接失败重试 2 次（共 3 次）。 */
async function gotoHash(page, path) {
  const url = BASE + '/#' + path;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(350);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        console.warn('      retry ' + attempt + '/2  goto ' + path + ' :: ' + firstLine(err));
        await sleep(3000);
      }
    }
  }
  throw new Error('无法打开 ' + path + ' :: ' + firstLine(lastError));
}

function pushSkip(viewport, id, reason) {
  report.checks.push({
    id,
    viewport,
    status: 'SKIP',
    url: null,
    assertions: [],
    error: null,
    skipReason: reason,
    screenshot: null,
    consoleErrors: [],
    pageErrors: [],
    horizontalOverflow: null,
    durationMs: 0,
  });
}

function printResult(rec) {
  const suffix = rec.error ? ' :: ' + rec.error : '';
  console.log(
    rec.status.padEnd(4) + ' [' + rec.viewport + '] ' + rec.id + ' — ' + rec.assertions.length + ' assertions, ' + rec.durationMs + 'ms' + suffix,
  );
  if (rec.screenshot) {
    console.log('     shot: ' + rec.screenshot);
  }
}

const TRANSIENT_RE = /ERR_CONNECTION|ERR_NETWORK|ERR_TIMED_OUT|Failed to fetch|net::ERR|ECONNREFUSED|ECONNRESET|status of 50[234]/i;

function isTransient(rec) {
  const blob = [rec.error || '', ...(rec.consoleErrors || []), ...(rec.pageErrors || [])].join(' | ');
  return TRANSIENT_RE.test(blob);
}

async function attemptCheck(page, viewport, id, fn, opts, finalAttempt) {
  const state = pageState.get(page);
  state.consoleErrors.length = 0;
  state.pageErrors.length = 0;

  const rec = {
    id,
    viewport,
    status: 'PASS',
    url: null,
    assertions: [],
    error: null,
    screenshot: null,
    consoleErrors: [],
    pageErrors: [],
    horizontalOverflow: null,
    durationMs: 0,
  };
  const started = Date.now();

  const assert = (ok, label, detail) => {
    rec.assertions.push({ label, ok: Boolean(ok), detail: detail === undefined || detail === null ? null : String(detail) });
    if (!ok) {
      throw new Error(label + (detail === undefined || detail === null ? '' : ': ' + detail));
    }
  };

  try {
    await fn({ page, assert, rec });
  } catch (err) {
    rec.status = 'FAIL';
    rec.error = String(err && err.message ? err.message : err);
    if (finalAttempt) {
      try {
        rec.screenshot = await capture(page, id + '-' + viewport);
      } catch (shotError) {
        rec.screenshotError = String(shotError && shotError.message ? shotError.message : shotError);
      }
    }
  }

  await sleep(150);
  rec.consoleErrors = state.consoleErrors.splice(0);
  rec.pageErrors = state.pageErrors.splice(0);
  try {
    rec.url = page.url();
  } catch {
    rec.url = null;
  }

  const allowConsole = opts.allowConsoleErrors || (() => false);
  const unexpectedConsole = rec.consoleErrors.filter((msg) => !allowConsole(msg));

  if (rec.status === 'PASS' && rec.pageErrors.length > 0) {
    rec.status = 'FAIL';
    rec.error = 'pageerror: ' + rec.pageErrors.join(' | ');
  }
  if (rec.status === 'PASS' && unexpectedConsole.length > 0) {
    rec.status = 'FAIL';
    rec.error = 'console error: ' + unexpectedConsole.join(' | ');
  }

  try {
    const dims = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    rec.dimensions = dims;
    rec.horizontalOverflow = dims.scrollWidth > dims.clientWidth;
  } catch {
    rec.horizontalOverflow = null;
  }
  if (rec.status === 'PASS' && rec.horizontalOverflow) {
    rec.status = 'FAIL';
    rec.error = 'horizontal overflow: scrollWidth ' + rec.dimensions.scrollWidth + ' > clientWidth ' + rec.dimensions.clientWidth;
  }

  if (rec.status === 'FAIL' && finalAttempt && !rec.screenshot) {
    try {
      rec.screenshot = await capture(page, id + '-' + viewport);
    } catch (shotError) {
      rec.screenshotError = String(shotError && shotError.message ? shotError.message : shotError);
    }
  }

  rec.durationMs = Date.now() - started;
  return rec;
}

async function runCheck(page, viewport, id, fn, opts = {}) {
  const attempts = 1 + (opts.retries ?? 2);
  let rec;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const finalAttempt = attempt === attempts;
    rec = await attemptCheck(page, viewport, id, fn, opts, finalAttempt);
    if (rec.status !== 'FAIL' || finalAttempt || !isTransient(rec)) {
      break;
    }
    console.warn('      transient failure, retry ' + attempt + '/' + (attempts - 1) + ' :: ' + firstLine(rec.error));
    try {
      await waitForServer(60);
    } catch {
      /* 继续重试 */
    }
    await sleep(1500);
  }
  report.checks.push(rec);
  printResult(rec);
  return rec;
}

async function loginViaUi(page, account) {
  await gotoHash(page, '/login');
  await page.locator('#login-username').waitFor({ state: 'visible', timeout: 15000 });
  await page.fill('#login-username', account.username);
  await page.fill('#login-password', account.password);
  await page.click('#login-submit');

  try {
    await page.waitForFunction(() => Boolean(localStorage.getItem('token')), undefined, { timeout: 20000 });
  } catch {
    const alert = await page.locator('.auth-alert').innerText().catch(() => '');
    throw new Error('登录失败 ' + account.username + (alert ? ': ' + alert.trim() : '（token 未写入）'));
  }
  await page.waitForFunction(() => !location.hash.startsWith('#/login'), undefined, { timeout: 20000 });
  await page.waitForTimeout(700);
  return (await page.locator('.account-btn .name').innerText()).trim();
}

async function bodyText(page) {
  return page.locator('body').innerText();
}

/** 桌面用商品信息区的加购按钮，窄屏用底部购买条上的同名按钮。 */
async function addToCartButton(page) {
  const desktop = page.locator('.action-add');
  if (await desktop.isVisible().catch(() => false)) {
    return desktop;
  }
  const mobile = page.locator('.buybar button', { hasText: '加入购物车' }).first();
  if (await mobile.isVisible().catch(() => false)) {
    return mobile;
  }
  // 底部购买条在页脚进入视口时会隐藏，回到顶部后再判定一次。
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  if (await desktop.isVisible().catch(() => false)) {
    return desktop;
  }
  if (await mobile.isVisible().catch(() => false)) {
    return mobile;
  }
  return desktop;
}

/** 通过商品详情页加购 1003，返回后端购物车载荷。 */
async function addProductToCart(page) {
  await gotoHash(page, '/product/1003');
  const button = await addToCartButton(page);
  await button.waitFor({ state: 'visible', timeout: 15000 });
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/cart/items') && res.request().method() === 'POST',
    { timeout: 20000 },
  );
  await button.click();
  const response = await responsePromise;
  if (!response.ok()) {
    throw new Error('加入购物车接口失败: HTTP ' + response.status());
  }
  const payload = await response.json().catch(() => null);
  await page.waitForTimeout(700);
  return payload || { count: 0, items: [] };
}

/* ------------------------------------------------------------------ */
/* 游客                                                                */
/* ------------------------------------------------------------------ */
async function guestSuite(page, viewport) {
  await runCheck(page, viewport, 'guest/home', async ({ page, assert }) => {
    await gotoHash(page, '/');
    const h1 = (await page.locator('h1').first().innerText()).trim();
    assert(h1.includes('星澜优选'), '首页 h1 含品牌名', h1);
    const body = await bodyText(page);
    assert(body.includes('星澜优选'), '首页渲染品牌内容');
    assert(body.includes('热门'), '首页展示热门搜索');
  });

  await runCheck(page, viewport, 'guest/search-保温杯', async ({ page, assert }) => {
    await gotoHash(page, '/');
    await page.click('button[aria-label="搜索商品"]');
    await page.locator('#global-search').waitFor({ state: 'visible', timeout: 10000 });
    await page.fill('#global-search', '保温杯');
    await page.press('#global-search', 'Enter');
    await page.waitForFunction(
      () => location.hash.includes('/search') && (document.querySelector('.headline')?.textContent || '').includes('保温杯'),
      undefined,
      { timeout: 15000 },
    );
    await page.waitForTimeout(700);

    const headline = (await page.locator('.headline').innerText()).trim();
    assert(headline.includes('保温杯'), '搜索头显示关键词', headline);
    const body = await bodyText(page);
    assert(body.includes('星澜 316 不锈钢保温杯 500ml'), '搜索结果包含商品 1003');
    assert((await page.locator('a[href*="product/1003"]').count()) > 0, '搜索结果可跳转商品 1003');
  });

  await runCheck(page, viewport, 'guest/product-1003', async ({ page, assert }) => {
    await gotoHash(page, '/product/1003');
    const addButton = await addToCartButton(page);
    await addButton.waitFor({ state: 'visible', timeout: 15000 });
    const h1 = (await page.locator('h1').first().innerText()).trim();
    assert(h1 === '星澜 316 不锈钢保温杯 500ml', '商品 1003 标题正确', h1);
    const body = await bodyText(page);
    assert(body.includes('¥129.00'), '商品 1003 展示售价 ¥129.00');
    assert(body.includes('316 内胆'), '商品 1003 展示卖点');
    assert(await addButton.isVisible(), '游客可见加入购物车按钮');
  });

  await runCheck(page, viewport, 'guest/about', async ({ page, assert }) => {
    await gotoHash(page, '/about');
    const h1 = (await page.locator('h1').first().innerText()).trim();
    assert(h1.includes('把日常，选得更好'), '关于页 h1 正确', h1);
  });

  await runCheck(page, viewport, 'guest/help', async ({ page, assert }) => {
    await gotoHash(page, '/help');
    const h1 = (await page.locator('h1').first().innerText()).trim();
    assert(h1.includes('有什么可以帮你'), '帮助页 h1 正确', h1);
    assert((await bodyText(page)).includes('常见问题'), '帮助页渲染 FAQ 内容');
  });

  await runCheck(page, viewport, 'guest/privacy', async ({ page, assert }) => {
    await gotoHash(page, '/privacy');
    const h1 = (await page.locator('h1').first().innerText()).trim();
    assert(h1 === '隐私政策', '隐私政策页 h1 正确', h1);
    assert((await bodyText(page)).includes('生效日期'), '隐私政策渲染正文');
  });

  await runCheck(page, viewport, 'guest/terms', async ({ page, assert }) => {
    await gotoHash(page, '/terms');
    const h1 = (await page.locator('h1').first().innerText()).trim();
    assert(h1 === '服务条款', '服务条款页 h1 正确', h1);
    assert((await bodyText(page)).includes('生效日期'), '服务条款渲染正文');
  });

  await runCheck(page, viewport, 'guest/404', async ({ page, assert }) => {
    await gotoHash(page, '/definitely-not-a-page');
    const h1 = (await page.locator('h1').first().innerText()).trim();
    assert(h1.includes('页面走丢了'), '未知路由落到 404 页', h1);
    assert((await bodyText(page)).includes('404'), '404 页展示状态码');
  });

  await runCheck(
    page,
    viewport,
    'guest/search-v03',
    async ({ page, assert, rec }) => {
      rec.payload = V03_PAYLOAD;
      await gotoHash(page, '/search?q=' + encodeURIComponent(V03_PAYLOAD));
      await page.waitForFunction(() => Boolean(document.querySelector('.headline img[onerror]')), undefined, { timeout: 15000 });
      await page.waitForFunction(() => window.__v03 === 1, undefined, { timeout: 10000 }).catch(() => undefined);

      const marker = await page.evaluate(() => {
        const img = document.querySelector('.headline img[onerror]');
        const headline = document.querySelector('.headline');
        return {
          found: Boolean(img),
          onerror: img ? img.getAttribute('onerror') : null,
          executed: window.__v03 === 1,
          html: headline ? headline.innerHTML : '',
        };
      });
      assert(marker.found, 'V03: 搜索头保留 img 节点');
      assert(marker.onerror === 'window.__v03=1', 'V03: onerror 属性未被转义/剥离', marker.onerror);
      assert(marker.executed, 'V03: onerror 已执行（window.__v03 === 1）');
      assert(marker.html.includes('<img'), 'V03: headline innerHTML 含原始标签');
    },
    { allowConsoleErrors: (msg) => /Failed to load resource|net::ERR|ERR_NAME_NOT_RESOLVED/.test(msg) },
  );
}

/* ------------------------------------------------------------------ */
/* alice                                                               */
/* ------------------------------------------------------------------ */
async function aliceSuite(page, viewport) {
  const login = await runCheck(page, viewport, 'alice/login', async ({ page, assert }) => {
    const name = await loginViaUi(page, ACCOUNTS.alice);
    assert(name === ACCOUNTS.alice.name, '页头显示登录会员', name);
    const token = await page.evaluate(() => localStorage.getItem('token') || '');
    assert(token.split('.').length === 3, 'V07: 登录 token 写入 localStorage[token]', token.slice(0, 16) + '…');
  });

  if (login.status !== 'PASS') {
    for (const id of [
      'alice/add-cart',
      'alice/cart',
      'alice/checkout',
      'alice/order-success',
      'alice/orders',
      'alice/order-1002-v05',
      'alice/product-reviews-v04',
      'alice/account',
      'alice/addresses',
      'alice/tickets',
      'alice/ticket-detail-reply',
    ]) {
      pushSkip(viewport, id, 'alice/login 失败，依赖登录的步骤跳过');
    }
    return;
  }

  let orderId = '';

  await runCheck(
    page,
    viewport,
    'alice/add-cart',
    async ({ page, assert }) => {
      const cart = await addProductToCart(page);
      assert(Number(cart.count) >= 1, '加入购物车后购物车件数 >= 1', cart.count);
      const badge = await page.locator('.cart .badge').innerText().catch(() => '0');
      assert(Number(badge.replace(/\D/g, '')) >= 1, '页头购物车角标 >= 1', badge);
      assert(await (await addToCartButton(page)).isVisible(), '加购后仍停留在商品详情页');
    },
    { retries: 0 },
  );

  await runCheck(page, viewport, 'alice/cart', async ({ page, assert, rec }) => {
    await gotoHash(page, '/cart');
    await page.waitForTimeout(700);
    let lines = await page.locator('app-cart-line').count();
    if (lines === 0) {
      // 并行验证可能刚清空 alice 的购物车；重新加购后再次读取。
      await addProductToCart(page);
      await gotoHash(page, '/cart');
      await page.waitForTimeout(800);
      lines = await page.locator('app-cart-line').count();
      rec.recoveredEmptyCart = true;
    }
    assert(lines >= 1, '购物车至少 1 行商品', lines);
    const body = await bodyText(page);
    assert(body.includes('星澜 316 不锈钢保温杯 500ml'), '购物车包含商品 1003');
    assert(body.includes('去结算'), '购物车展示去结算按钮');
    const checked = await page.locator('.pick-input:checked').count();
    assert(checked >= 1, '购物车商品默认勾选', checked);
    const checkoutButton = page.locator('button:visible', { hasText: '去结算' }).first();
    assert(await checkoutButton.isEnabled(), '去结算按钮可用');
  });

  await runCheck(
    page,
    viewport,
    'alice/checkout',
    async ({ page, assert, rec }) => {
    await gotoHash(page, '/checkout');
    await page.waitForTimeout(800);
    let addressCount = await page.locator('input[name="checkout-address"]').count();
    if (addressCount === 0) {
      // 并行验证可能清空购物车导致结算页进入空态；重新加购后回到结算。
      await addProductToCart(page);
      await gotoHash(page, '/checkout');
      await page.waitForTimeout(800);
      addressCount = await page.locator('input[name="checkout-address"]').count();
      rec.recoveredEmptyCart = true;
    }
    await page.locator('h1', { hasText: '确认订单' }).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('input[name="checkout-address"]').first().waitFor({ state: 'attached', timeout: 15000 });

    assert(addressCount >= 1, '结算页加载到收货地址', addressCount);
    await page.locator('.addr-card').first().click();
    assert((await page.locator('input[name="checkout-address"]:checked').count()) === 1, '已选择收货地址');

    await page.locator('label.option', { hasText: '次日达' }).first().click();
    assert(await page.locator('input[name="checkout-shipping"][value="next_day"]').isChecked(), '已选择次日达配送');

    const submit = page.locator('button.submit');
    assert(await submit.isEnabled(), '提交订单按钮可用');
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/checkout') && res.request().method() === 'POST',
      { timeout: 20000 },
    );
    await submit.click();
    const response = await responsePromise;
    assert(response.ok(), '提交订单接口成功', response.status());
    await page.locator('#checkout-success-title').waitFor({ state: 'visible', timeout: 20000 });
    },
    { retries: 0 },
  );

  await runCheck(page, viewport, 'alice/order-success', async ({ page, assert, rec }) => {
    const title = (await page.locator('#checkout-success-title').innerText()).trim();
    assert(title.includes('订单提交成功'), '结算后展示成功页', title);
    orderId = (await page.locator('.success-meta dd.sp-num').first().innerText()).trim();
    assert(/^\d+$/.test(orderId), '成功页显示数字订单号', orderId);
    const body = await bodyText(page);
    assert(body.includes('林晓'), '成功页显示收货人 林晓');
    assert(/¥\d/.test(body), '成功页显示应付金额');
    rec.createdOrderId = orderId;
    report.dataMutations.orders.push({ viewport, orderId });
  });

  await runCheck(page, viewport, 'alice/orders', async ({ page, assert }) => {
    await gotoHash(page, '/account/orders');
    await page.locator('.order').first().waitFor({ state: 'visible', timeout: 15000 });
    const rows = await page.locator('.order').count();
    assert(rows >= 1, '订单列表至少 1 笔', rows);
    let body = await bodyText(page);
    assert(body.includes('我的订单'), '订单列表标题正确');
    if (!body.includes('1001') && !body.includes('1005')) {
      // 新订单会把种子订单挤到下一页：先放大每页条数，再退到最后一页查找。
      const sizeSelect = page.locator('app-pagination select.sp-select');
      if (await sizeSelect.count()) {
        await sizeSelect.first().selectOption('50');
        await page.waitForTimeout(900);
        body = await bodyText(page);
      }
      if (!body.includes('1001') && !body.includes('1005')) {
        const pageButtons = page.locator('app-pagination button.pg:not([aria-label])');
        const buttonCount = await pageButtons.count();
        if (buttonCount > 0) {
          await pageButtons.nth(buttonCount - 1).click();
          await page.waitForTimeout(900);
          body = await bodyText(page);
        }
      }
    }
    assert(body.includes('1001') || body.includes('1005'), '订单列表包含种子订单');
    if (orderId && !body.includes(orderId)) {
      // 订单刚创建时列表可能读到旧快照，刷新一次再判定。
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      body = await bodyText(page);
    }
    if (orderId) {
      assert(body.includes(orderId), '订单列表包含本次新订单', orderId);
    }
  });

  await runCheck(page, viewport, 'alice/order-1002-v05', async ({ page, assert }) => {
    await gotoHash(page, '/account/orders/1002');
    await page.locator('h1', { hasText: '订单详情' }).first().waitFor({ state: 'visible', timeout: 15000 });
    const body = await bodyText(page);
    assert(body.includes('1002'), 'V05: 页面显示订单号 1002');
    assert(body.includes('周远'), 'V05: alice 读取到 bob 的收货人 周远');
    assert(body.includes('bob@stellarpick.example'), 'V05: 页面泄露 bob 的登录邮箱');
    assert(body.includes('13800000003'), 'V05: 页面泄露 bob 的手机号');
    assert(body.includes('下单账号'), 'V05: 页面展示下单账号区块');
  });

  await runCheck(
    page,
    viewport,
    'alice/product-reviews-v04',
    async ({ page, assert, rec }) => {
    await gotoHash(page, '/product/1003');
    await page.locator('#tab-reviews').waitFor({ state: 'visible', timeout: 15000 });
    await page.click('#tab-reviews');
    await page.locator('#reviews').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(900);

    let markerCount = await page.locator('#reviews .review-text img[data-e2e="v04"]').count();
    if (markerCount === 0) {
      await page.locator('#review-form').waitFor({ state: 'visible', timeout: 10000 });
      await page.fill('#review-body', V04_MARKER);
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes('/rest/products/1003/reviews') && res.request().method() === 'PUT',
        { timeout: 20000 },
      );
      await page.click('#review-form button[type="submit"]');
      const response = await responsePromise;
      assert(response.ok(), 'V04: 评价提交接口成功', response.status());
      await page.waitForTimeout(1500);
      markerCount = await page.locator('#reviews .review-text img[data-e2e="v04"]').count();
      if (markerCount === 0) {
        const pager = page.locator('app-pagination select.sp-select');
        if (await pager.count()) {
          await pager.first().selectOption('50');
          await page.waitForTimeout(1200);
          markerCount = await page.locator('#reviews .review-text img[data-e2e="v04"]').count();
        }
      }
      report.dataMutations.reviews.push({ viewport, productId: 1003, marker: 'data-e2e="v04"' });
    }

    assert(markerCount >= 1, 'V04: 评价正文渲染出标记 img 节点', markerCount);
    const marker = await page.evaluate(() => {
      const img = document.querySelector('#reviews .review-text img[data-e2e="v04"]');
      const holder = img ? img.closest('.review-text') : null;
      return {
        onerror: img ? img.getAttribute('onerror') : null,
        html: holder ? holder.innerHTML : '',
        text: holder ? holder.textContent || '' : '',
      };
    });
    assert(marker.onerror === 'window.__v04=1', 'V04: innerHTML 保留 onerror 属性', marker.onerror);
    assert(marker.html.includes('<img'), 'V04: 评价 DOM 中存在原始 img 标签');
    assert(!marker.text.includes('<img'), 'V04: 标签未被当作纯文本转义');
    rec.v04Marker = 'window.__v04=1';
    },
    { retries: 0 },
  );

  await runCheck(page, viewport, 'alice/account', async ({ page, assert }) => {
    await gotoHash(page, '/account');
    await page.locator('h1', { hasText: '个人中心' }).first().waitFor({ state: 'visible', timeout: 15000 });
    const body = await bodyText(page);
    assert(body.includes('alice@stellarpick.example'), '个人中心显示会员邮箱');
    assert(body.includes('账户资料'), '个人中心显示账户资料区块');
  });

  await runCheck(page, viewport, 'alice/addresses', async ({ page, assert }) => {
    await gotoHash(page, '/account/addresses');
    await page.locator('h1', { hasText: '收货地址' }).first().waitFor({ state: 'visible', timeout: 15000 });
    const body = await bodyText(page);
    assert(body.includes('林晓'), '地址簿显示收货人 林晓');
    assert(body.includes('示例路 88 号'), '地址簿显示详细地址');
    assert(body.includes('默认地址'), '地址簿标记默认地址');
  });

  await runCheck(page, viewport, 'alice/tickets', async ({ page, assert }) => {
    await gotoHash(page, '/support/tickets');
    await page.locator('h1', { hasText: '客服工单' }).first().waitFor({ state: 'visible', timeout: 15000 });
    const body = await bodyText(page);
    assert(body.includes('发票抬头需要修改'), '工单列表包含种子工单');
    assert((await page.locator('a[href*="support/tickets/"]').count()) >= 1, '工单列表存在可点击详情');
  });

  await runCheck(
    page,
    viewport,
    'alice/ticket-detail-reply',
    async ({ page, assert, rec }) => {
    await gotoHash(page, '/support/tickets/1');
    await page.locator('h1', { hasText: '发票抬头需要修改' }).first().waitFor({ state: 'visible', timeout: 15000 });
    const before = await page.locator('.msg').count();
    assert(before >= 1, '工单详情展示对话记录', before);

    const replyText = 'E2E 自动回复 ' + Date.now() + '：已收到，请按公司抬头重开。';
    await page.fill('#reply-body', replyText);
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/support/tickets/1/messages') && res.request().method() === 'POST',
      { timeout: 20000 },
    );
    await page.locator('.reply button[type="submit"]').click();
    const response = await responsePromise;
    assert(response.ok(), '工单回复接口成功', response.status());
    await page.waitForFunction((text) => (document.body.innerText || '').includes(text), replyText, { timeout: 15000 });
    const after = await page.locator('.msg').count();
    assert(after >= before + 1, '回复后消息数增加', before + ' -> ' + after);
    report.dataMutations.ticketReplies.push({ viewport, ticketId: 1, text: replyText });
    rec.replyText = replyText;
    },
    { retries: 0 },
  );
}

/* ------------------------------------------------------------------ */
/* admin                                                               */
/* ------------------------------------------------------------------ */
async function adminSuite(page, viewport) {
  const login = await runCheck(page, viewport, 'admin/login', async ({ page, assert }) => {
    const name = await loginViaUi(page, ACCOUNTS.admin);
    assert(name === ACCOUNTS.admin.name, '管理员登录成功', name);
    const token = await page.evaluate(() => localStorage.getItem('token') || '');
    assert(token.split('.').length === 3, '管理员 token 已写入');
  });

  if (login.status !== 'PASS') {
    pushSkip(viewport, 'admin/users', 'admin/login 失败');
    pushSkip(viewport, 'admin/merchants', 'admin/login 失败');
    return;
  }

  await runCheck(page, viewport, 'admin/users', async ({ page, assert }) => {
    await gotoHash(page, '/admin/users');
    await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 15000 });
    const rows = await page.locator('table tbody tr').count();
    assert(rows >= 8, '用户管理表格至少 8 行', rows);
    const body = await bodyText(page);
    assert(body.includes('用户管理'), '后台用户管理标题正确');
    assert(body.includes('alice@stellarpick.example'), '用户列表包含 alice');
    assert(body.includes('bob@stellarpick.example'), '用户列表包含 bob');
    assert(body.includes('admin@stellarpick.example'), '用户列表包含 admin');
  });

  await runCheck(page, viewport, 'admin/merchants', async ({ page, assert }) => {
    await gotoHash(page, '/admin/merchants');
    await page.locator('.merchant-card').first().waitFor({ state: 'visible', timeout: 15000 });
    const allTab = page.locator('[role="tab"]', { hasText: '全部' }).first();
    if (await allTab.count()) {
      await allTab.click();
      await page.waitForTimeout(700);
    }
    const cards = await page.locator('.merchant-card').count();
    assert(cards >= 4, '商家审核卡片至少 4 张', cards);
    const body = await bodyText(page);
    assert(body.includes('商家审核'), '商家审核标题正确');
    assert(body.includes('星澜自营旗舰店'), '商家列表包含星澜自营旗舰店');
    assert(body.includes('待审核'), '商家列表展示待审核状态');
  });
}

/* ------------------------------------------------------------------ */
/* merchant（只读）                                                     */
/* ------------------------------------------------------------------ */
async function merchantSuite(page, viewport) {
  const login = await runCheck(page, viewport, 'merchant/login', async ({ page, assert }) => {
    const name = await loginViaUi(page, ACCOUNTS.merchant);
    assert(name === ACCOUNTS.merchant.name, '商家登录成功', name);
  });

  if (login.status !== 'PASS') {
    for (const id of ['merchant/dashboard', 'merchant/products', 'merchant/orders']) {
      pushSkip(viewport, id, 'merchant/login 失败');
    }
    return;
  }

  await runCheck(page, viewport, 'merchant/dashboard', async ({ page, assert }) => {
    await gotoHash(page, '/merchant');
    await page.locator('h1', { hasText: '商家中心' }).first().waitFor({ state: 'visible', timeout: 15000 });
    const body = await bodyText(page);
    assert(body.includes('星澜自营旗舰店'), '商家工作台显示店铺名');
    assert(body.includes('工作台'), '商家工作台导航正确');
    assert(body.includes('近 7 日订单') && body.includes('待发货订单'), '商家工作台展示经营指标');
  });

  await runCheck(page, viewport, 'merchant/products', async ({ page, assert }) => {
    await gotoHash(page, '/merchant/products');
    await page.locator('#product-q').waitFor({ state: 'visible', timeout: 15000 });
    await page.fill('#product-q', '1003');
    await page.waitForTimeout(900);
    const rows = await page.locator('table tbody tr').count();
    assert(rows >= 1, '商品管理表格至少 1 行', rows);
    const body = await bodyText(page);
    assert(body.includes('商品管理'), '商品管理标题正确');
    assert(body.includes('星澜 316 不锈钢保温杯 500ml'), '商品管理包含商品 1003');
  });

  await runCheck(page, viewport, 'merchant/orders', async ({ page, assert }) => {
    await gotoHash(page, '/merchant/orders');
    const search = page.locator('input[aria-label="搜索订单号、买家或商品"]');
    await search.waitFor({ state: 'visible', timeout: 15000 });
    await search.fill('1002');
    await page.waitForTimeout(900);
    const rows = await page.locator('table tbody tr').count();
    assert(rows >= 1, '订单管理表格至少 1 行', rows);
    const body = await bodyText(page);
    assert(body.includes('订单管理'), '订单管理标题正确');
    assert(body.includes('1002'), '订单管理可按订单号 1002 检索');
    assert(body.includes('周远'), '订单 1002 的买家为周远');
  });
}

/* ------------------------------------------------------------------ */
/* 注册（新唯一邮箱 + 自动登录）                                        */
/* ------------------------------------------------------------------ */
async function registerSuite(page, viewport) {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = 'e2e.flow.' + suffix + '@example.com';
  const nickname = 'E2E会员' + suffix.slice(-5);

  await runCheck(page, viewport, 'register/new-user-auto-login', async ({ page, assert, rec }) => {
    rec.email = email;
    await gotoHash(page, '/register');
    await page.locator('#reg-name').waitFor({ state: 'visible', timeout: 15000 });
    await page.fill('#reg-name', nickname);
    await page.fill('#reg-email', email);
    await page.fill('#reg-password', 'Flow@2026');
    await page.fill('#reg-confirm', 'Flow@2026');
    await page.check('#reg-agree');

    await page.click('#register-submit');
    try {
      await page.waitForFunction(() => location.hash.startsWith('#/account'), undefined, { timeout: 25000 });
    } catch {
      const alert = await page.locator('.auth-alert').innerText().catch(() => '');
      const fieldError = await page.locator('.sp-error').first().innerText().catch(() => '');
      throw new Error('注册后未跳转个人中心' + (alert ? ': ' + alert.trim() : '') + (fieldError ? ' / ' + fieldError.trim() : ''));
    }
    await page.waitForTimeout(900);

    const token = await page.evaluate(() => localStorage.getItem('token') || '');
    assert(token.split('.').length === 3, '注册后自动登录并写入 token');
    const headerName = (await page.locator('.account-btn .name').innerText()).trim();
    assert(headerName === nickname, '注册后页头显示新昵称', headerName);
    const body = await bodyText(page);
    assert(body.includes(email), '个人中心显示新注册邮箱', email);
    assert(body.includes('个人中心'), '注册后落在个人中心');
    assert((await page.locator('h1').first().innerText()).includes('个人中心'), '注册后 h1 为个人中心');

    report.dataMutations.users.push({ viewport, email, nickname });
    },
    { retries: 0 },
  );
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  await waitForServer();

  const browser = await chromium.launch({ executablePath: CHROME, headless: HEADLESS });
  try {
    for (const vp of VIEWPORTS) {
      const viewport = { width: vp.width, height: vp.height };

      const guestContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      try {
        const guestPage = await guestContext.newPage();
        track(guestPage);
        await guestSuite(guestPage, vp.name);
      } finally {
        await guestContext.close();
      }

      const aliceContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      try {
        const alicePage = await aliceContext.newPage();
        track(alicePage);
        await aliceSuite(alicePage, vp.name);
      } finally {
        await aliceContext.close();
      }

      const adminContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      try {
        const adminPage = await adminContext.newPage();
        track(adminPage);
        await adminSuite(adminPage, vp.name);
      } finally {
        await adminContext.close();
      }

      const merchantContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      try {
        const merchantPage = await merchantContext.newPage();
        track(merchantPage);
        await merchantSuite(merchantPage, vp.name);
      } finally {
        await merchantContext.close();
      }

      const registerContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      try {
        const registerPage = await registerContext.newPage();
        track(registerPage);
        await registerSuite(registerPage, vp.name);
      } finally {
        await registerContext.close();
      }
    }
  } finally {
    await browser.close();
  }
}

function finalize() {
  const checks = report.checks;
  const failed = checks.filter((c) => c.status === 'FAIL');
  const skipped = checks.filter((c) => c.status === 'SKIP');
  report.summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === 'PASS').length,
    failed: failed.length,
    skipped: skipped.length,
    durationMs: Date.now() - new Date(startedAt).getTime(),
  };

  for (const check of failed) {
    report.findings.push({
      severity: 'high',
      id: check.id,
      viewport: check.viewport,
      title: check.error,
      url: check.url,
      consoleErrors: check.consoleErrors,
      pageErrors: check.pageErrors,
      horizontalOverflow: check.horizontalOverflow,
      screenshot: check.screenshot,
      repro: '打开 ' + BASE + '/#' + (check.url ? check.url.split('#')[1] || '' : '') + ' 并按检查步骤操作；断言：' + check.assertions.map((a) => a.label).join(' / '),
    });
  }

  report.notes.push(
    'V04 种子数据（文档/数据不一致，非功能失败）：GET /rest/products/1003/reviews 当前只返回 jim 的纯文本评价，未包含 docs/漏洞入口矩阵.md 与 docs/实现契约.md 所述的 onerror payload。复现：GET http://127.0.0.1:8081/rest/products/1003/reviews，观察 data 仅有 jim 文本；对比 docs/漏洞入口矩阵.md 第 23 行。本 E2E 通过提交带 data-e2e="v04" 的良性标记评价验证 innerHTML（不写入可执行 XSS payload），首次运行会自动补一条标记评价。',
    '本脚本只新增数据：每个视口 1 笔结算订单、1 条工单回复、1 个注册账号；V04 标记评价仅在缺失时新增；不删除任何数据。',
  );

  report.command = 'cd T:/StellarPick/tools/e2e && node flow.mjs';
  report.exitCode = failed.length > 0 ? 1 : 0;
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  console.log('');
  console.log(
    'summary: ' + report.summary.passed + ' passed / ' + report.summary.failed + ' failed / ' + report.summary.skipped + ' skipped (' + report.summary.total + ' checks)',
  );
  console.log('report: ' + REPORT_FILE);
  if (failed.length > 0) {
    console.log('failed checks:');
    for (const check of failed) {
      console.log('  - [' + check.viewport + '] ' + check.id + ' :: ' + check.error);
      if (check.screenshot) {
        console.log('    shot: ' + check.screenshot);
      }
    }
  }
  process.exitCode = failed.length > 0 ? 1 : 0;
}

try {
  await main();
} catch (err) {
  console.error('FATAL: ' + String(err && err.stack ? err.stack : err));
  report.fatalError = String(err && err.message ? err.message : err);
} finally {
  finalize();
}
