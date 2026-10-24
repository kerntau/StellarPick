import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { SlicePipe } from '@angular/common'
import { RouterLink } from '@angular/router'

interface OrderItem { productId: number; title: string; image: string; unitPrice: number; quantity: number }
interface Order { id: number; ownerId: number; ownerName: string; ownerEmail: string; statusText: string; total: number; createdAt: string; items: OrderItem[] }

@Component({
  selector: 'app-sp-order-list',
  standalone: true,
  imports: [RouterLink, SlicePipe],
  template: `
    <div class="sp-orders">
      <header>
        <p class="eyebrow">会员中心</p>
        <h1>我的订单</h1>
        <p class="sub">查看订单状态、商品与物流信息。</p>
      </header>

      @if (!token) {
        <div class="notice">
          <p>登录后查看订单。</p>
          <a class="btn" routerLink="/login">去登录</a>
        </div>
      } @else if (loading()) {
        <p class="muted">正在加载订单…</p>
      } @else if (error()) {
        <div class="error">{{ error() }} <button type="button" (click)="load()">重试</button></div>
      } @else {
        <ul class="list">
          @for (order of orders(); track order.id) {
            <li>
              <a [routerLink]="['/account/orders', order.id]">
                <div class="row">
                  <strong>订单 {{ order.id }}</strong>
                  <span class="badge">{{ order.statusText }}</span>
                  <span class="total">¥{{ order.total.toFixed(2) }}</span>
                </div>
                <p class="meta">{{ order.createdAt | slice:0:10 }} · {{ order.items.length }} 件商品</p>
                <div class="thumbs">
                  @for (item of order.items; track item.productId) {
                    <img [src]="'/assets/public/images/products/' + item.image" [alt]="item.title" width="56" height="56" />
                  }
                </div>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .sp-orders { max-width: 960px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 6px; }
    .sub { color: #475467; margin: 0 0 24px; }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .list a { display: block; padding: 18px 20px; background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; color: inherit; text-decoration: none; }
    .list a:hover { border-color: #0B2545; box-shadow: 0 4px 12px rgba(16,24,40,.08); }
    .row { display: flex; align-items: center; gap: 12px; }
    .row strong { font-size: 15px; }
    .badge { background: #EAF1FD; color: #1C4C9C; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
    .total { margin-left: auto; color: #8A5A00; font-weight: 700; font-size: 18px; font-variant-numeric: tabular-nums; }
    .meta { color: #667085; font-size: 12px; margin: 6px 0 10px; }
    .thumbs { display: flex; gap: 8px; }
    .thumbs img { border-radius: 4px; border: 1px solid #E4E7EC; background: #F5F7FA; }
    .notice, .error { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 24px; }
    .btn { display: inline-block; margin-top: 8px; background: #0B2545; color: #fff; border-radius: 6px; padding: 10px 18px; text-decoration: none; }
    .muted { color: #667085; }
  `]
})
export class SpOrderListComponent {
  private readonly http = inject(HttpClient)
  readonly token = localStorage.getItem('token')
  readonly orders = signal<Order[]>([])
  readonly loading = signal(false)
  readonly error = signal('')

  constructor () { this.load() }

  load (): void {
    if (!this.token) return
    this.loading.set(true)
    this.error.set('')
    this.http.get<{ items: Order[] }>('/api/orders', {
      headers: new HttpHeaders({ Authorization: 'Bearer ' + this.token })
    }).subscribe({
      next: (res) => { this.orders.set(res.items ?? []); this.loading.set(false) },
      error: (err) => { this.error.set(err?.error?.message ?? '加载失败，请稍后重试'); this.loading.set(false) }
    })
  }
}