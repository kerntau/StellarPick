/*
 * 星澜优选 lab API routes: orders, admin directory, cart, checkout, account,
 * address book, merchant console and support tickets. Mounted under /api/* by
 * server.ts. GET /api/orders/:id intentionally keeps the V05 IDOR.
 */
import express, { Router } from 'express'
import config from 'config'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import * as security from '../lib/insecurity'
import { ProductModel } from '../models/product'
import { UserModel } from '../models/user'
import { labState, persistRuntime, nextCounter, type Order, type CartLine, type Ticket, type TicketMessage } from '../data/labRuntime'

const router = Router()

// The hidden seed product is soft-deleted on purpose (V01) and must stay out of
// the merchant console even though that console lists soft-deleted products.
const HIDDEN_PRODUCT_IDS = new Set(
  config.get<Array<{ deletedDate?: string | boolean }>>('products')
    .map((product, index) => (product.deletedDate ? 1001 + index : null))
    .filter((id): id is number => id !== null)
)

// Orders list only exposes the caller's own orders. Seed orders still carry the
// historical ownerIds 2/3/6, which today belong to jim/bender/support, so an
// ownerId fallback would leak other accounts' orders. Match by e-mail only; the
// by-id detail route below keeps the intentional V05 IDOR.
router.get('/', labAuth, (req, res) => {
  const email = String((req.user as any)?.data?.email ?? '')
  const items = email === '' ? [] : labState.orders.filter((order) => order.ownerEmail === email)
  res.json({ items, total: items.length, page: 1, size: items.length })
})

router.get('/:id', labAuth, (req, res) => {
  const id = Number(req.params.id)
  // V05: the order is looked up by URL id only, ownership is not checked here.
  const order = labState.orders.find((entry) => entry.id === id)
  if (!order) {
    res.status(404).json({ code: 'ORDER_NOT_FOUND', message: '订单不存在' })
    return
  }
  res.json(order)
})

function findOrder (id: number): Order | undefined {
  return labState.orders.find((entry) => entry.id === id)
}

router.post('/:id/pay', labAuth, (req, res) => {
  const order = findOrder(Number(req.params.id))
  if (!order) { res.status(404).json({ code: 'ORDER_NOT_FOUND', message: '订单不存在' }); return }
  order.status = 'pending_shipment'
  order.statusText = '待发货'
  persistRuntime()
  res.json(order)
})

router.post('/:id/cancel', labAuth, (req, res) => {
  const order = findOrder(Number(req.params.id))
  if (!order) { res.status(404).json({ code: 'ORDER_NOT_FOUND', message: '订单不存在' }); return }
  order.status = 'cancelled'
  order.statusText = '已取消'
  persistRuntime()
  res.json(order)
})

router.post('/:id/confirm', labAuth, (req, res) => {
  const order = findOrder(Number(req.params.id))
  if (!order) { res.status(404).json({ code: 'ORDER_NOT_FOUND', message: '订单不存在' }); return }
  order.status = 'completed'
  order.statusText = '已完成'
  persistRuntime()
  res.json(order)
})

const USERS = [
  { id: 1, username: 'admin', name: '平台管理员', email: 'admin@stellarpick.example', role: 'admin', status: 'active', createdAt: '2026-01-05T09:00:00.000Z' },
  { id: 2, username: 'alice', name: '林晓', email: 'alice@stellarpick.example', role: 'member', status: 'active', createdAt: '2026-02-11T02:30:00.000Z' },
  { id: 3, username: 'bob', name: '周远', email: 'bob@stellarpick.example', role: 'member', status: 'active', createdAt: '2026-03-02T03:12:00.000Z' },
  { id: 4, username: 'merchant', name: '陈屿', email: 'merchant@stellarpick.example', role: 'merchant', status: 'active', createdAt: '2026-01-12T08:00:00.000Z' },
  { id: 5, username: 'support', name: '客服小澜', email: 'support@stellarpick.example', role: 'support', status: 'active', createdAt: '2026-01-12T08:05:00.000Z' },
  { id: 6, username: 'carol', name: '苏晴', email: 'carol@stellarpick.example', role: 'member', status: 'active', createdAt: '2026-04-18T07:45:00.000Z' },
  { id: 7, username: 'dave', name: '何嘉', email: 'dave@stellarpick.example', role: 'member', status: 'disabled', createdAt: '2026-05-06T03:20:00.000Z' },
  { id: 8, username: 'erin', name: '许棠', email: 'erin@stellarpick.example', role: 'member', status: 'active', createdAt: '2026-06-21T09:10:00.000Z' }
]
const SEED_USERS = USERS.map((user) => ({ ...user }))

// V06: only the login is checked. No role guard on the server or the client.
const adminRouter = Router()
adminRouter.use(express.json())
adminRouter.get('/users', labAuth, (req, res) => {
  const q = String(req.query.q ?? '').toLowerCase()
  const items = USERS.filter((user) => !q || user.username.includes(q) || user.email.toLowerCase().includes(q))
  res.json({ items, total: items.length, page: 1, size: items.length })
})

adminRouter.patch('/users/:id', labAuth, (req, res) => {
  const user = USERS.find((entry) => entry.id === Number(req.params.id))
  if (!user) { res.status(404).json({ code: 'USER_NOT_FOUND', message: '用户不存在' }); return }
  const body = req.body ?? {}
  if (body.role) user.role = String(body.role)
  if (body.status) user.status = String(body.status)
  res.json(user)
})

adminRouter.post('/users/:id/reset-password', labAuth, async (req, res, next) => {
  try {
    const user = USERS.find((entry) => entry.id === Number(req.params.id))
    if (!user) { res.status(404).json({ code: 'USER_NOT_FOUND', message: '用户不存在' }); return }
    if (user.status === 'disabled') {
      res.status(409).json({ code: 'ACCOUNT_DISABLED', message: '该账号已禁用，请先启用账号再重置密码' })
      return
    }
    // The admin directory is a lab view; only accounts that also exist in
    // SQLite can actually log in, so only those can be reset for real.
    const sqliteUser = await UserModel.findOne({ where: { email: user.email } })
    if (!sqliteUser) {
      res.status(404).json({ code: 'NOT_LOGIN_ACCOUNT', message: '该账号仅存在于演示目录，不能登录，无法重置密码' })
      return
    }
    if (sqliteUser.isActive === false) {
      res.status(409).json({ code: 'ACCOUNT_DISABLED', message: '该账号已禁用，请先启用账号再重置密码' })
      return
    }
    const password = 'Sp@' + Math.random().toString(36).slice(2, 8)
    sqliteUser.password = password // the model setter hashes it
    await sqliteUser.save()
    res.json({ password })
  } catch (err) { next(err) }
})

interface MerchantRow {
  id: number
  name: string
  contact: string
  phone: string
  license: string
  category: string
  status: string
  statusText: string
  ownerName: string
  ownerEmail: string
  appliedAt: string
  reason?: string
}

const MERCHANTS: MerchantRow[] = [
  { id: 1, name: '星澜自营旗舰店', contact: '陈屿', phone: '13800000004', license: '91310000MA1FL8XQ2K', category: '综合', status: 'approved', statusText: '已通过', ownerName: '陈屿', ownerEmail: 'merchant@stellarpick.example', appliedAt: '2026-01-10T08:00:00.000Z' },
  { id: 2, name: '山海器物生活馆', contact: '顾青', phone: '13900000011', license: '91330100MA2B7YQ81H', category: '家居', status: 'pending', statusText: '待审核', ownerName: '顾青', ownerEmail: 'gq@example.com', appliedAt: '2026-10-18T09:30:00.000Z' },
  { id: 3, name: '晨野咖啡烘焙', contact: '许棠', phone: '13700000022', license: '91440300MA5F2XQ33D', category: '食品', status: 'pending', statusText: '待审核', ownerName: '许棠', ownerEmail: 'erin@stellarpick.example', appliedAt: '2026-10-19T02:10:00.000Z' },
  { id: 4, name: '北岸数码配件', contact: '何嘉', phone: '13600000033', license: '91110108MA01T9K72P', category: '数码', status: 'rejected', statusText: '已驳回', ownerName: '何嘉', ownerEmail: 'dave@stellarpick.example', appliedAt: '2026-10-02T06:20:00.000Z', reason: '营业执照与经营类目不一致，请补充品牌授权。' }
]
const SEED_MERCHANTS = MERCHANTS.map((merchant) => ({ ...merchant }))

adminRouter.get('/merchants', labAuth, (req, res) => {
  const status = String(req.query.status ?? '')
  const items = status ? MERCHANTS.filter((row) => row.status === status) : MERCHANTS
  res.json({ items, total: items.length, page: 1, size: items.length })
})

adminRouter.post('/merchants/:id/approve', labAuth, (req, res) => {
  const merchant = MERCHANTS.find((row) => row.id === Number(req.params.id))
  if (!merchant) { res.status(404).json({ code: 'MERCHANT_NOT_FOUND', message: '商家不存在' }); return }
  merchant.status = 'approved'
  merchant.statusText = '已通过'
  merchant.reason = undefined
  res.json(merchant)
})

adminRouter.post('/merchants/:id/reject', labAuth, (req, res) => {
  const merchant = MERCHANTS.find((row) => row.id === Number(req.params.id))
  if (!merchant) { res.status(404).json({ code: 'MERCHANT_NOT_FOUND', message: '商家不存在' }); return }
  merchant.status = 'rejected'
  merchant.statusText = '已驳回'
  merchant.reason = String((req.body ?? {}).reason ?? '资质材料不完整')
  res.json(merchant)
})

// V07: a token with alg=none is trusted without signature verification.
function labAuth (req: any, res: any, next: any): void {
  const header = req.headers.authorization
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const parts = header.slice(7).split('.')
    if (parts.length >= 2) {
      try {
        const head = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
        if (String(head.alg).toLowerCase() === 'none') {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
          req.user = payload && payload.data ? payload : { data: payload }
          next()
          return
        }
      } catch (err) { /* fall through to the native verifier */ }
    }
  }
  security.isAuthorized()(req, res, next)
}

function userIdOf (req: any): number {
  return Number(req.user?.data?.id ?? 0)
}

function emailOf (req: any): string {
  return String(req.user?.data?.email ?? '')
}

function roleOf (req: any): string {
  return String(req.user?.data?.role ?? '').toLowerCase()
}

// The merchant console is not part of V01–V10, so it gets a real role check.
function merchantOnly (req: any, res: any, next: any): void {
  const role = roleOf(req)
  if (role !== 'merchant' && role !== 'admin') {
    res.status(403).json({ code: 'FORBIDDEN', message: '仅商家或管理员可访问该资源' })
    return
  }
  next()
}

function cartOf (userId: number): CartLine[] {
  const key = String(userId)
  if (!Array.isArray(labState.carts[key])) labState.carts[key] = []
  return labState.carts[key]
}

function cartPayload (userId: number) {
  const items = cartOf(userId).map((line) => ({ ...line, subtotal: Math.round(line.unitPrice * line.quantity * 100) / 100 }))
  return {
    items,
    total: Math.round(items.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100,
    count: items.reduce((sum, line) => sum + line.quantity, 0)
  }
}

async function productById (id: number): Promise<any | null> {
  const product = await ProductModel.findByPk(id)
  return product ? product.get({ plain: true }) : null
}

const cartRouter = Router()
cartRouter.use(express.json())
cartRouter.use(labAuth)

cartRouter.get('/', (req, res) => {
  res.json(cartPayload(userIdOf(req)))
})

// V09: unitPrice is taken verbatim from the client.
cartRouter.post('/items', async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const product = await productById(Number(body.productId))
    if (!product) {
      res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: '商品不存在' })
      return
    }
    const userId = userIdOf(req)
    const lines = cartOf(userId)
    const quantity = Math.max(1, Math.min(999, parseInt(body.quantity, 10) || 1))
    const clientPrice = body.unitPrice != null ? Number(body.unitPrice) : NaN
    const unitPrice = Number.isFinite(clientPrice) ? clientPrice : Number(product.price)
    const existing = lines.find((line) => line.productId === product.id)
    if (existing) {
      existing.quantity = Math.min(999, existing.quantity + quantity)
      existing.unitPrice = unitPrice
      existing.listPrice = Number(product.price)
    } else {
      lines.push({
        id: nextCounter('lineId'),
        productId: product.id,
        title: product.name,
        image: product.image,
        unitPrice,
        listPrice: Number(product.price),
        quantity,
        stock: 100
      })
    }
    persistRuntime()
    res.json(cartPayload(userId))
  } catch (err) { next(err) }
})

cartRouter.patch('/items/:id', (req, res) => {
  const userId = userIdOf(req)
  const line = cartOf(userId).find((entry) => entry.id === Number(req.params.id))
  if (!line) {
    res.status(404).json({ code: 'CART_ITEM_NOT_FOUND', message: '购物车中没有该商品' })
    return
  }
  const body = req.body ?? {}
  if (body.quantity != null) line.quantity = Math.max(1, Math.min(999, parseInt(body.quantity, 10) || line.quantity))
  if (body.unitPrice != null && Number.isFinite(Number(body.unitPrice))) line.unitPrice = Number(body.unitPrice)
  persistRuntime()
  res.json(cartPayload(userId))
})

cartRouter.delete('/items/:id', (req, res) => {
  const userId = userIdOf(req)
  const lines = cartOf(userId)
  const index = lines.findIndex((entry) => entry.id === Number(req.params.id))
  if (index === -1) {
    res.status(404).json({ code: 'CART_ITEM_NOT_FOUND', message: '购物车中没有该商品' })
    return
  }
  lines.splice(index, 1)
  persistRuntime()
  res.status(204).end()
})

const checkoutRouter = Router()
checkoutRouter.use(express.json())
checkoutRouter.use(labAuth)

// V09: the order total is computed from client supplied unitPrice values.
checkoutRouter.post('/', (req, res, next) => {
  try {
    const userId = userIdOf(req)
    const body = req.body ?? {}
    const lines = Array.isArray(body.items) && body.items.length > 0 ? body.items : cartOf(userId)
    if (!lines.length) {
      res.status(400).json({ code: 'EMPTY_ORDER', message: '订单中没有商品' })
      return
    }
    const items = lines.map((line: any) => {
      const unitPrice = Number(line.unitPrice ?? 0)
      const quantity = Math.max(1, parseInt(line.quantity, 10) || 1)
      return {
        productId: Number(line.productId),
        title: line.title ?? '商品',
        image: line.image ?? 'sp-1003.svg',
        unitPrice,
        quantity,
        subtotal: Math.round(unitPrice * quantity * 100) / 100
      }
    })
    const total = Math.round(items.reduce((sum: number, item: any) => sum + item.subtotal, 0) * 100) / 100
    const user = (req.user as any)?.data ?? {}
    const email = String(user.email ?? '')
    const fallbackName = email.split('@')[0] || '会员'
    const address = body.address && body.address.recipient
      ? {
          recipient: String(body.address.recipient),
          phone: String(body.address.phone ?? ''),
          region: String(body.address.region ?? ''),
          detail: String(body.address.detail ?? '')
        }
      : { recipient: fallbackName, phone: '', region: '', detail: '' }
    const nextOrderId = labState.orders.reduce((max, entry) => Math.max(max, entry.id), 2000) + 1
    const order: Order = {
      id: nextOrderId,
      ownerId: userId,
      ownerName: String(user.username || fallbackName),
      ownerEmail: email,
      status: 'pending_payment',
      statusText: '待付款',
      createdAt: new Date().toISOString(),
      total,
      items,
      shipping: body.shipping == null ? undefined : String(body.shipping),
      shippingSlot: body.shippingSlot == null ? undefined : String(body.shippingSlot),
      invoice: body.invoice == null ? undefined : String(body.invoice),
      invoiceTitle: body.invoiceTitle == null ? undefined : String(body.invoiceTitle),
      payment: body.payment == null ? undefined : String(body.payment),
      gift: body.gift == null ? undefined : String(body.gift),
      address
    }
    labState.orders.unshift(order)
    // Only remove the lines that were actually checked out; unselected cart
    // lines must survive a partial checkout.
    const purchased = new Map<number, number>()
    for (const item of items) {
      purchased.set(item.productId, (purchased.get(item.productId) ?? 0) + item.quantity)
    }
    const cartKey = String(userId)
    const remaining: CartLine[] = []
    for (const line of labState.carts[cartKey] ?? []) {
      const bought = purchased.get(line.productId) ?? 0
      if (bought <= 0) {
        remaining.push(line)
      } else if (line.quantity > bought) {
        remaining.push({ ...line, quantity: line.quantity - bought })
      }
    }
    labState.carts[cartKey] = remaining
    persistRuntime()
    res.json(order)
  } catch (err) { next(err) }
})

const emailRouter = Router()
emailRouter.use(express.json())
emailRouter.use(express.urlencoded({ extended: false }))

// V08: this sensitive operation accepts the session cookie and validates neither a CSRF
// token nor the Origin/Referer header, so a third-party page can submit it for a logged-in
// victim. Bearer tokens keep working for the regular profile form.
function cookieUser (req: any): any | undefined {
  const token = req.cookies?.sp_token
  if (!token || !security.verify(token)) return undefined
  const payload = security.decode(token)
  return payload?.data?.id ? payload.data : undefined
}

function emailAuth (req: any, res: any, next: any): void {
  const fromCookie = cookieUser(req)
  if (fromCookie) {
    req.user = { data: fromCookie }
    next()
    return
  }
  labAuth(req, res, next)
}

function currentToken (req: any): string | undefined {
  const header = req.headers.authorization
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7)
  const cookie = req.cookies?.sp_token
  return typeof cookie === 'string' ? cookie : undefined
}

/** Re-issue a signed token after a profile change, preserving the basket id. */
function refreshedToken (req: any, user: Record<string, any>): string | undefined {
  const token = currentToken(req)
  // Never turn a forged (alg=none) token into a correctly signed one.
  if (!token || !security.verify(token)) return undefined
  const payload = security.decode(token) as { bid?: number } | undefined
  const authenticatedUser: any = payload?.bid != null ? { data: user, bid: payload.bid } : { data: user }
  const next = security.authorize(authenticatedUser)
  security.authenticatedUsers.put(next, authenticatedUser)
  return next
}

function tokenUser (user: any): Record<string, any> {
  // Keep the same shape as the login token, including the password hash:
  // routes/changePassword.ts compares the current password against it.
  return user?.get ? user.get({ plain: true }) : { ...(user ?? {}) }
}

emailRouter.use(emailAuth)
emailRouter.post('/', async (req, res, next) => {
  try {
    const email = String((req.body ?? {}).email ?? '').trim()
    if (!email) {
      res.status(400).json({ code: 'BAD_REQUEST', message: '请输入新邮箱' })
      return
    }
    const userId = userIdOf(req)
    await UserModel.update({ email }, { where: { id: userId } })
    const updated = await UserModel.findByPk(userId)
    if (updated) {
      const token = refreshedToken(req, tokenUser(updated))
      if (token) res.setHeader('X-StellarPick-Token', token)
    }
    res.status(204).end()
  } catch (err) { next(err) }
})

const uploadDir = path.resolve('uploads')
fs.mkdirSync(uploadDir, { recursive: true })
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 10) + ext)
  }
})
const upload = multer({ storage })
const avatarRouter = Router()
avatarRouter.use(labAuth)
// V10: no extension / MIME validation, original extension preserved.
avatarRouter.post('/', upload.single('file'), async (req: any, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ code: 'NO_FILE', message: '请选择要上传的头像文件' })
      return
    }
    const url = '/uploads/' + req.file.filename
    const userId = userIdOf(req)
    if (userId) {
      await UserModel.update({ profileImage: url }, { where: { id: userId } })
      const updated = await UserModel.findByPk(userId)
      if (updated) {
        const token = refreshedToken(req, tokenUser(updated))
        if (token) res.setHeader('X-StellarPick-Token', token)
      }
    }
    res.json({ url, filename: req.file.filename, originalName: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size })
  } catch (err) { next(err) }
})

interface Address { id: number; name: string; phone: string; region: string; detail: string; isDefault: boolean }
const addressBook = new Map<number, Address[]>()
let nextAddressId = 1

// Alice and Bob each start with an address; all other accounts start empty
// instead of inheriting 林晓's Shanghai address.
const ADDRESS_SEEDS: Record<string, Omit<Address, 'id'>> = {
  'alice@stellarpick.example': { name: '林晓', phone: '13800000002', region: '上海市 / 上海市 / 星澜区', detail: '示例路 88 号 3 栋 1201', isDefault: true },
  'bob@stellarpick.example': { name: '周远', phone: '13800000003', region: '北京市 / 北京市 / 朝阳区', detail: '示例街 12 号 2 单元 901', isDefault: true }
}

function addressesOf (userId: number, email = ''): Address[] {
  if (!addressBook.has(userId)) {
    const seed = ADDRESS_SEEDS[email]
    addressBook.set(userId, seed ? [{ id: nextAddressId++, ...seed }] : [])
  }
  return addressBook.get(userId) as Address[]
}

const addressRouter = Router()
addressRouter.use(express.json())
addressRouter.use(labAuth)
addressRouter.get('/', (req, res) => { res.json({ items: addressesOf(userIdOf(req), emailOf(req)) }) })
addressRouter.post('/', (req, res) => {
  const userId = userIdOf(req)
  const body = req.body ?? {}
  if (!body.name || !body.phone || !body.detail) {
    res.status(400).json({ code: 'BAD_REQUEST', message: '请填写收件人、手机号和详细地址' })
    return
  }
  const list = addressesOf(userId, emailOf(req))
  if (body.isDefault) list.forEach((entry) => { entry.isDefault = false })
  const address: Address = { id: nextAddressId++, name: String(body.name), phone: String(body.phone), region: String(body.region ?? ''), detail: String(body.detail), isDefault: !!body.isDefault || list.length === 0 }
  list.push(address)
  res.json(address)
})
addressRouter.patch('/:id', (req, res) => {
  const list = addressesOf(userIdOf(req), emailOf(req))
  const address = list.find((entry) => entry.id === Number(req.params.id))
  if (!address) { res.status(404).json({ code: 'ADDRESS_NOT_FOUND', message: '地址不存在' }); return }
  const body = req.body ?? {}
  if (body.isDefault) list.forEach((entry) => { entry.isDefault = false })
  Object.assign(address, { name: body.name ?? address.name, phone: body.phone ?? address.phone, region: body.region ?? address.region, detail: body.detail ?? address.detail, isDefault: body.isDefault ?? address.isDefault })
  res.json(address)
})
addressRouter.delete('/:id', (req, res) => {
  const list = addressesOf(userIdOf(req), emailOf(req))
  const index = list.findIndex((entry) => entry.id === Number(req.params.id))
  if (index === -1) { res.status(404).json({ code: 'ADDRESS_NOT_FOUND', message: '地址不存在' }); return }
  list.splice(index, 1)
  res.status(204).end()
})

const merchantRouter = Router()
merchantRouter.use(express.json())
merchantRouter.use(labAuth)
merchantRouter.use(merchantOnly)
merchantRouter.get('/products', async (_req, res, next) => {
  try {
    const rows = await ProductModel.findAll({ order: [['id', 'ASC']], paranoid: false })
    res.json({
      items: rows
        .filter((product: any) => !HIDDEN_PRODUCT_IDS.has(product.id))
        .map((product: any) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          stock: 100,
          image: product.image,
          status: product.deletedAt ? 'off_sale' : 'on_sale',
          statusText: product.deletedAt ? '已下架' : '在售'
        }))
    })
  } catch (err) { next(err) }
})

merchantRouter.post('/products', async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const product: any = await ProductModel.create({
      name: String(body.title ?? body.name ?? '新商品'),
      description: String(body.description ?? ''),
      price: Number(body.price ?? 0),
      deluxePrice: Number(body.price ?? 0),
      image: String(body.image ?? 'sp-1003.svg')
    })
    res.json({
      id: product.id,
      title: product.name,
      price: product.price,
      stock: 100,
      image: product.image,
      status: 'on_sale',
      statusText: '在售',
      sales: 0,
      category: '全部'
    })
  } catch (err) { next(err) }
})

merchantRouter.patch('/products/:id', async (req, res, next) => {
  try {
    // The hidden seed product is V01-only; never let the merchant console
    // restore it into the public catalogue.
    if (HIDDEN_PRODUCT_IDS.has(Number(req.params.id))) {
      res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: '商品不存在' })
      return
    }
    const product: any = await ProductModel.findByPk(Number(req.params.id), { paranoid: false })
    if (!product) { res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: '商品不存在' }); return }
    const body = req.body ?? {}
    if (body.title != null || body.name != null) product.name = String(body.title ?? body.name)
    if (body.price != null) product.price = Number(body.price)
    if (body.stock != null) { /* stock is not persisted in this Juice Shop version */ }
    await product.save()
    // Sequelize ignores direct writes to the paranoid timestamp on save();
    // destroy()/restore() are the supported delist/re-list operations.
    if (body.status === 'off_sale' && !product.deletedAt) await product.destroy()
    if (body.status === 'on_sale' && product.deletedAt) await product.restore()
    res.json({
      id: product.id,
      title: product.name,
      price: product.price,
      stock: 100,
      image: product.image,
      status: product.deletedAt ? 'off_sale' : 'on_sale',
      statusText: product.deletedAt ? '已下架' : '在售',
      sales: 0,
      category: '全部'
    })
  } catch (err) { next(err) }
})

merchantRouter.get('/orders', (_req, res) => {
  res.json({ items: labState.orders.map((order) => ({ id: order.id, buyerName: order.ownerName || order.ownerEmail.split('@')[0], recipient: order.address?.recipient ?? order.ownerName, phone: order.address?.phone ?? '', region: order.address?.region ?? '', detail: order.address?.detail ?? '', total: order.total, status: order.status, statusText: order.statusText, createdAt: order.createdAt, trackingNo: order.trackingNo, items: order.items })) })
})

merchantRouter.post('/orders/:id/ship', (req, res) => {
  const order = labState.orders.find((entry) => entry.id === Number(req.params.id))
  if (!order) { res.status(404).json({ code: 'ORDER_NOT_FOUND', message: '订单不存在' }); return }
  if (order.status !== 'pending_shipment') { res.status(409).json({ code: 'ORDER_STATE_INVALID', message: '只有待发货订单可以发货' }); return }
  order.status = 'shipped'
  order.statusText = '已发货'
  order.trackingNo = String((req.body ?? {}).trackingNo || 'SF' + Date.now())
  persistRuntime()
  res.json({ id: order.id, status: order.status, trackingNo: order.trackingNo })
})

merchantRouter.get('/summary', (_req, res) => {
  res.json({ todayOrders: 3, todaySales: 1299, pendingShipment: 1, productCount: 21, merchant: { name: '星澜自营旗舰店', status: 'approved' } })
})

function isTicketAgent (req: any): boolean {
  const role = roleOf(req)
  return role === 'support' || role === 'admin'
}

function displayNameOf (req: any): string {
  const email = emailOf(req)
  const user = (req.user as any)?.data ?? {}
  return USERS.find((entry) => entry.email === email)?.name ?? String(user.username ?? email.split('@')[0] ?? '会员')
}

// Ticket detail/reply/close: owners and support/admin only.
function ticketFor (req: any, res: any): Ticket | undefined {
  const ticket = labState.tickets.find((entry) => entry.id === Number(req.params.id))
  if (!ticket) {
    res.status(404).json({ code: 'TICKET_NOT_FOUND', message: '工单不存在' })
    return undefined
  }
  if (!isTicketAgent(req) && ticket.ownerEmail !== emailOf(req)) {
    res.status(403).json({ code: 'FORBIDDEN', message: '无权访问该工单' })
    return undefined
  }
  return ticket
}

function messagesOf (ticket: Ticket): TicketMessage[] {
  const key = String(ticket.id)
  if (!Array.isArray(labState.ticketMessages[key])) {
    labState.ticketMessages[key] = [
      { id: nextCounter('messageId'), author: ticket.author, authorEmail: ticket.ownerEmail, role: 'member', body: ticket.body, createdAt: ticket.createdAt }
    ]
    persistRuntime()
  }
  return labState.ticketMessages[key]
}

const ticketRouter = Router()
ticketRouter.use(express.json())
ticketRouter.use(labAuth)
ticketRouter.get('/', (req, res) => {
  const status = String(req.query.status ?? '')
  const visible = isTicketAgent(req)
    ? labState.tickets
    : labState.tickets.filter((ticket) => ticket.ownerEmail === emailOf(req))
  const items = status ? visible.filter((ticket) => ticket.status === status) : visible
  res.json({ items, total: items.length, page: 1, size: items.length })
})

ticketRouter.get('/:id', (req, res) => {
  const ticket = ticketFor(req, res)
  if (!ticket) return
  res.json({ ...ticket, messages: messagesOf(ticket) })
})

ticketRouter.post('/:id/messages', (req, res) => {
  const ticket = ticketFor(req, res)
  if (!ticket) return
  const body = String((req.body ?? {}).body ?? '').trim()
  if (!body) { res.status(400).json({ code: 'BAD_REQUEST', message: '请输入回复内容' }); return }
  const user = (req.user as any)?.data ?? {}
  messagesOf(ticket).push({
    id: nextCounter('messageId'),
    author: displayNameOf(req),
    authorEmail: emailOf(req),
    role: String(user.role ?? 'member'),
    body,
    createdAt: new Date().toISOString()
  })
  ticket.status = 'processing'
  ticket.statusText = '处理中'
  persistRuntime()
  res.json({ ...ticket, messages: messagesOf(ticket) })
})

ticketRouter.post('/:id/close', (req, res) => {
  const ticket = ticketFor(req, res)
  if (!ticket) return
  ticket.status = 'closed'
  ticket.statusText = '已关闭'
  persistRuntime()
  res.json({ ...ticket, messages: messagesOf(ticket) })
})
ticketRouter.post('/', (req, res) => {
  const body = req.body ?? {}
  if (!body.subject || !body.body) {
    res.status(400).json({ code: 'BAD_REQUEST', message: '请填写工单主题和问题描述' })
    return
  }
  const ticket: Ticket = {
    id: nextCounter('ticketId'),
    subject: String(body.subject),
    body: String(body.body),
    status: 'open',
    statusText: '待处理',
    createdAt: new Date().toISOString(),
    author: displayNameOf(req),
    ownerEmail: emailOf(req)
  }
  labState.tickets.unshift(ticket)
  persistRuntime()
  res.json(ticket)
})

adminRouter.get('/settings', labAuth, (req, res) => {
  const role = (req.user as any)?.data?.role
  if (role !== 'admin') {
    res.status(403).json({ code: 'FORBIDDEN', message: '无权限访问该资源' })
    return
  }
  res.json({ siteName: '星澜优选', demoMode: true })
})

/** Reset in-memory state not covered by labRuntime (address book, admin directory, merchant applications). */
export function resetStellarPickState (): void {
  addressBook.clear()
  nextAddressId = 1
  USERS.splice(0, USERS.length, ...SEED_USERS.map((user) => ({ ...user })))
  MERCHANTS.splice(0, MERCHANTS.length, ...SEED_MERCHANTS.map((merchant) => ({ ...merchant })))
}

export { router, adminRouter, cartRouter, checkoutRouter, emailRouter, avatarRouter, addressRouter, merchantRouter, ticketRouter }
