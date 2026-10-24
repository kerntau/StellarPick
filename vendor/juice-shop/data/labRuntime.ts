/*
 * 星澜优选 lab runtime store.
 * Orders / carts / tickets live here so they survive a process restart.
 * State is mirrored to data/lab-runtime.json on every mutation.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface OrderItem {
  productId: number
  title: string
  image: string
  unitPrice: number
  quantity: number
  subtotal?: number
}

export interface Order {
  id: number
  ownerId: number
  ownerName: string
  ownerEmail: string
  status: string
  statusText: string
  createdAt: string
  total: number
  items: OrderItem[]
  address: { recipient: string; phone: string; region: string; detail: string }
  trackingNo?: string
}

export interface CartLine {
  id: number
  productId: number
  title: string
  image: string
  unitPrice: number
  quantity: number
  stock: number
}

export interface Ticket {
  id: number
  subject: string
  body: string
  status: string
  statusText: string
  createdAt: string
  author: string
}

export interface TicketMessage {
  id: number
  author: string
  role: string
  body: string
  createdAt: string
}

interface LabState {
  orders: Order[]
  carts: Record<string, CartLine[]>
  tickets: Ticket[]
  ticketMessages: Record<string, TicketMessage[]>
  counters: { lineId: number; ticketId: number; messageId: number }
}

export const SEED_VERSION = '2026.10.21'

const runtimeFile = path.resolve('data/lab-runtime.json')

const item = (productId: number, title: string, unitPrice: number, quantity: number): OrderItem => ({
  productId,
  title,
  image: 'sp-' + productId + '.svg',
  unitPrice,
  quantity
})

// Seeded orders. ownerId values are historical seed ids, so the order list is
// matched by owner e-mail first and ownerId second (alice/bob ids are 26/27).
export const SEED_ORDERS: Order[] = [
  {
    id: 1001,
    ownerId: 2,
    ownerName: '林晓',
    ownerEmail: 'alice@stellarpick.example',
    status: 'completed',
    statusText: '已完成',
    createdAt: '2026-10-12T10:20:00.000Z',
    total: 499,
    items: [item(1005, '星澜长绒棉四件套', 499, 1)],
    address: { recipient: '林晓', phone: '13800000002', region: '上海市 / 上海市 / 星澜区', detail: '示例路 88 号 3 栋 1201' }
  },
  {
    id: 1002,
    ownerId: 3,
    ownerName: '周远',
    ownerEmail: 'bob@stellarpick.example',
    status: 'pending_shipment',
    statusText: '待发货',
    createdAt: '2026-10-18T06:05:00.000Z',
    total: 556,
    items: [item(1003, '星澜 316 不锈钢保温杯 500ml', 129, 2), item(1012, '星澜 65W 氮化镓充电器', 149, 2)],
    address: { recipient: '周远', phone: '13800000003', region: '北京市 / 北京市 / 朝阳区', detail: '示例街 12 号 2 单元 901' }
  },
  {
    id: 1003,
    ownerId: 2,
    ownerName: '林晓',
    ownerEmail: 'alice@stellarpick.example',
    status: 'shipped',
    statusText: '已发货',
    createdAt: '2026-10-15T02:30:00.000Z',
    total: 499,
    trackingNo: 'SF1234567890',
    items: [item(1005, '星澜长绒棉四件套', 499, 1)],
    address: { recipient: '林晓', phone: '13800000002', region: '上海市 / 上海市 / 星澜区', detail: '示例路 88 号 3 栋 1201' }
  },
  {
    id: 1004,
    ownerId: 3,
    ownerName: '周远',
    ownerEmail: 'bob@stellarpick.example',
    status: 'completed',
    statusText: '已完成',
    createdAt: '2026-10-08T09:10:00.000Z',
    total: 329,
    items: [item(1008, '星澜羊毛盖毯', 329, 1)],
    address: { recipient: '周远', phone: '13800000003', region: '北京市 / 北京市 / 朝阳区', detail: '示例街 12 号 2 单元 901' }
  },
  {
    id: 1005,
    ownerId: 2,
    ownerName: '林晓',
    ownerEmail: 'alice@stellarpick.example',
    status: 'pending_payment',
    statusText: '待付款',
    createdAt: '2026-10-20T13:40:00.000Z',
    total: 129,
    items: [item(1003, '星澜 316 不锈钢保温杯 500ml', 129, 1)],
    address: { recipient: '林晓', phone: '13800000002', region: '上海市 / 上海市 / 星澜区', detail: '示例路 88 号 3 栋 1201' }
  },
  {
    id: 1006,
    ownerId: 3,
    ownerName: '周远',
    ownerEmail: 'bob@stellarpick.example',
    status: 'shipped',
    statusText: '已发货',
    createdAt: '2026-10-16T11:00:00.000Z',
    total: 168,
    trackingNo: 'SF0987654321',
    items: [item(1019, '星澜冷萃咖啡液礼盒', 168, 1)],
    address: { recipient: '周远', phone: '13800000003', region: '北京市 / 北京市 / 朝阳区', detail: '示例街 12 号 2 单元 901' }
  },
  {
    id: 1007,
    ownerId: 2,
    ownerName: '林晓',
    ownerEmail: 'alice@stellarpick.example',
    status: 'completed',
    statusText: '已完成',
    createdAt: '2026-10-01T08:00:00.000Z',
    total: 69,
    items: [item(1007, '星澜可折叠收纳箱', 69, 1)],
    address: { recipient: '林晓', phone: '13800000002', region: '上海市 / 上海市 / 星澜区', detail: '示例路 88 号 3 栋 1201' }
  },
  {
    id: 1008,
    ownerId: 6,
    ownerName: '苏晴',
    ownerEmail: 'carol@stellarpick.example',
    status: 'completed',
    statusText: '已完成',
    createdAt: '2026-09-28T15:20:00.000Z',
    total: 159,
    items: [item(1002, '星澜陶瓷餐盘四件套', 159, 1)],
    address: { recipient: '苏晴', phone: '13800000006', region: '广东省 / 深圳市 / 南山区', detail: '示例大道 6 号' }
  },
  {
    id: 1009,
    ownerId: 1,
    ownerName: '平台管理员',
    ownerEmail: 'admin@stellarpick.example',
    status: 'completed',
    statusText: '已完成',
    createdAt: '2026-09-20T04:10:00.000Z',
    total: 269,
    items: [item(1001, '星澜轻量不粘炒锅 28cm', 269, 1)],
    address: { recipient: '平台管理员', phone: '13800000001', region: '上海市 / 上海市 / 星澜区', detail: '示例路 88 号' }
  },
  {
    id: 1010,
    ownerId: 3,
    ownerName: '周远',
    ownerEmail: 'bob@stellarpick.example',
    status: 'completed',
    statusText: '已完成',
    createdAt: '2026-09-18T07:45:00.000Z',
    total: 138,
    items: [item(1020, '星澜坚果每日礼盒', 138, 1)],
    address: { recipient: '周远', phone: '13800000003', region: '北京市 / 北京市 / 朝阳区', detail: '示例街 12 号 2 单元 901' }
  }
]

export const SEED_TICKETS: Ticket[] = [
  { id: 1, subject: '发票抬头需要修改', body: '订单 1002 的发票抬头写错了，麻烦改成公司名称。', status: 'processing', statusText: '处理中', createdAt: '2026-10-20T10:00:00.000Z', author: '林晓' },
  { id: 2, subject: '保温杯到货后杯盖有划痕', body: '杯盖边缘有一道明显划痕，想申请换货。', status: 'open', statusText: '待处理', createdAt: '2026-10-19T10:10:00.000Z', author: '林晓' },
  { id: 3, subject: '配送时间能否改到周末', body: '工作日家里没人，希望周六送达。', status: 'closed', statusText: '已关闭', createdAt: '2026-10-12T09:00:00.000Z', author: '周远' }
]

function clone<T> (value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function seedState (): LabState {
  return {
    orders: clone(SEED_ORDERS),
    carts: {},
    tickets: clone(SEED_TICKETS),
    ticketMessages: {},
    counters: { lineId: 1, ticketId: 4, messageId: 1 }
  }
}

function loadState (): LabState {
  const state = seedState()
  try {
    if (!fs.existsSync(runtimeFile)) {
      return state
    }
    const raw = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'))
    if (Array.isArray(raw.orders) && raw.orders.length > 0) state.orders = raw.orders
    if (raw.carts && typeof raw.carts === 'object') state.carts = raw.carts
    if (Array.isArray(raw.tickets) && raw.tickets.length > 0) state.tickets = raw.tickets
    if (raw.ticketMessages && typeof raw.ticketMessages === 'object') state.ticketMessages = raw.ticketMessages
    if (raw.counters && typeof raw.counters === 'object') state.counters = { ...state.counters, ...raw.counters }
  } catch (err) {
    console.warn('lab-runtime.json could not be read, falling back to seed data: ' + String(err))
  }
  return state
}

export const labState: LabState = loadState()

export function persistRuntime (): void {
  try {
    fs.mkdirSync(path.dirname(runtimeFile), { recursive: true })
    const tmpFile = runtimeFile + '.tmp'
    // Empty carts carry no state and would only bloat the file.
    const carts = Object.fromEntries(Object.entries(labState.carts).filter(([, lines]) => Array.isArray(lines) && lines.length > 0))
    fs.writeFileSync(tmpFile, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), ...labState, carts }, null, 2))
    fs.renameSync(tmpFile, runtimeFile)
  } catch (err) {
    console.error('lab runtime could not be persisted: ' + String(err))
  }
}

export function resetRuntime (): void {
  const fresh = seedState()
  labState.orders = fresh.orders
  labState.carts = fresh.carts
  labState.tickets = fresh.tickets
  labState.ticketMessages = fresh.ticketMessages
  labState.counters = fresh.counters
  persistRuntime()
}

export function nextCounter (key: keyof LabState['counters']): number {
  const value = labState.counters[key]
  labState.counters[key] = value + 1
  return value
}

export function runtimeFilePath (): string {
  return runtimeFile
}
