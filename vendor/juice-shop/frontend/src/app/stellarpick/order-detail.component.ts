import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { SlicePipe } from '@angular/common'
import { ActivatedRoute, RouterLink } from '@angular/router'

interface OrderItem { productId: number; title: string; image: string; unitPrice: number; quantity: number }
interface Order {
  id: number
  ownerId: number
  ownerName: string
  ownerEmail: string
  status: string
  statusText: string
  total: number
  createdAt: string
  items: OrderItem[]
  address: { recipient: string; phone: string; region: string; detail: string }
  trackingNo?: string
}

@Component({
  selector: 'app-sp-order-detail',
  standalone: true,
  imports: [RouterLink, SlicePipe],
  template: `
    <div class="sp-order">
      <a class="back" routerLink="/account/orders">← 返回订单列表</a>

      @if (!token) {
        <div class="notice"><p>登录后查看订单。</p><a class="btn" routerLink="/login">去登录</a></div>
      } @else if (loading()) {
        <p class="muted">正在加载订单…</p>
      } @else if (error()) {
        <div class="error">{{ error() }} <button type="button" (click)="load()">重试</button></div>
      } @else if (order(); as o) {
        <header class="head">
          <div>
            <p class="eyebrow">订单详情</p>
            <h1>订单 {{ o.id }}</h1>
            <p class="sub">下单时间 {{ o.createdAt | slice:0:16 }}</p>
          </div>
          <span class="badge">{{ o.statusText }}</span>
        </header>

        <section class="card">
          <h2>商品清单</h2>
          <table>
            <thead><tr><th>商品</th><th>单价</th><th>数量</th><th class="num">小计</th></tr></thead>
            <tbody>
              @for (item of o.items; track item.productId) {
                <tr>
                  <td class="product">
                    <img [src]="'/assets/public/images/products/' + item.image" [alt]="item.title" width="48" height="48" />
                    <span>{{ item.title }}</span>
                  </td>
                  <td class="num">¥{{ item.unitPrice.toFixed(2) }}</td>
                  <td class="num">{{ item.quantity }}</td>
                  <td class="num">¥{{ (item.unitPrice * item.quantity).toFixed(2) }}</td>
                </tr>
              }
            </tbody>
          </table>
          <div class="total">实付金额 <strong>¥{{ o.total.toFixed(2) }}</strong></div>
        </section>

        <div class="grid">
          <section class="card">
            <h2>收货信息</h2>
            <dl>
              <div><dt>收货人</dt><dd>{{ o.address.recipient }} {{ o.address.phone }}</dd></div>
              <div><dt>收货地址</dt><dd>{{ o.address.region }} {{ o.address.detail }}</dd></div>
              <div><dt>下单账号</dt><dd>{{ o.ownerName }}（{{ o.ownerEmail }}）</dd></div>
            </dl>
          </section>
          <section class="card">
            <h2>物流信息</h2>
            <dl>
              <div><dt>配送方式</dt><dd>标准配送</dd></div>
              <div><dt>运单号</dt><dd>{{ o.trackingNo || '待发货后生成' }}</dd></div>
              <div><dt>物流状态</dt><dd>{{ o.statusText }}</dd></div>
            </dl>
          </section>
        </div>
      }
    </div>
  `,
  styles: [`
    .sp-order { max-width: 960px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .back { color: #475467; text-decoration: none; font-size: 13px; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin: 20px 0 24px; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0; font-size: 13px; }
    .badge { background: #EAF1FD; color: #1C4C9C; border-radius: 999px; padding: 4px 12px; font-size: 13px; }
    .card { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 20px 24px; margin-bottom: 16px; }
    .card h2 { font-size: 16px; margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; color: #475467; font-size: 12px; font-weight: 600; padding: 8px 10px; border-bottom: 1px solid #E4E7EC; }
    td { padding: 12px 10px; border-bottom: 1px solid #F2F4F7; vertical-align: middle; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .product { display: flex; align-items: center; gap: 12px; }
    .product img { border-radius: 4px; background: #F5F7FA; }
    .total { text-align: right; padding-top: 14px; color: #475467; }
    .total strong { color: #8A5A00; font-size: 22px; margin-left: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    dl { margin: 0; display: flex; flex-direction: column; gap: 10px; }
    dl > div { display: flex; gap: 16px; font-size: 14px; }
    dt { color: #475467; width: 72px; flex: none; }
    dd { margin: 0; }
    .notice, .error { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 24px; }
    .btn { display: inline-block; margin-top: 8px; background: #0B2545; color: #fff; border-radius: 6px; padding: 10px 18px; text-decoration: none; }
    .muted { color: #667085; }
    @media (max-width: 767px) { .grid { grid-template-columns: 1fr; } .head { flex-direction: column; } }
  `]
})
export class SpOrderDetailComponent {
  private readonly http = inject(HttpClient)
  private readonly route = inject(ActivatedRoute)
  readonly token = localStorage.getItem('token')
  readonly order = signal<Order | null>(null)
  readonly loading = signal(false)
  readonly error = signal('')

  constructor () { this.load() }

  load (): void {
    if (!this.token) return
    this.loading.set(true)
    this.error.set('')
    const id = this.route.snapshot.paramMap.get('id')
    this.http.get<Order>('/api/orders/' + id, {
      headers: new HttpHeaders({ Authorization: 'Bearer ' + this.token })
    }).subscribe({
      next: (order) => { this.order.set(order); this.loading.set(false) },
      error: (err) => { this.error.set(err?.error?.message ?? '加载失败，请稍后重试'); this.loading.set(false) }
    })
  }
}