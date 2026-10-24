import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { SlicePipe } from '@angular/common'

interface Row { id: number; buyerName: string; total: number; status: string; statusText: string; createdAt: string; trackingNo?: string }

@Component({
  selector: 'app-sp-merchant-orders',
  standalone: true,
  imports: [SlicePipe],
  template: `
    <div class="sp-mo">
      <header><p class="eyebrow">商家中心</p><h1>订单管理</h1><p class="sub">查看订单并填写物流单号发货。</p></header>
      @if (error()) { <div class="error">{{ error() }}</div> } @else {
        <div class="table-wrap">
          <table>
            <caption>共 {{ items().length }} 个订单</caption>
            <thead><tr><th>订单号</th><th>买家</th><th>金额</th><th>状态</th><th>下单时间</th><th>操作</th></tr></thead>
            <tbody>
              @for (row of items(); track row.id) {
                <tr>
                  <td>{{ row.id }}</td>
                  <td>{{ row.buyerName }}</td>
                  <td class="num">¥{{ row.total.toFixed(2) }}</td>
                  <td><span class="badge">{{ row.statusText }}</span></td>
                  <td>{{ row.createdAt | slice:0:10 }}</td>
                  <td>
                    @if (row.status === 'pending_shipment') {
                      <button type="button" class="btn" (click)="ship(row)">发货</button>
                    } @else if (row.trackingNo) {
                      <span class="muted">{{ row.trackingNo }}</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .sp-mo { max-width: 1000px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0 0 20px; font-size: 13px; }
    .table-wrap { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    caption { text-align: left; padding: 14px 16px 0; color: #475467; font-size: 12px; }
    th { text-align: left; padding: 12px 16px; background: #F9FAFB; color: #475467; font-size: 12px; border-bottom: 1px solid #E4E7EC; white-space: nowrap; }
    td { padding: 12px 16px; border-bottom: 1px solid #F2F4F7; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .badge { background: #EAF1FD; color: #1C4C9C; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
    .btn { height: 30px; padding: 0 12px; border: 0; border-radius: 4px; background: #0B2545; color: #fff; cursor: pointer; font-size: 12px; }
    .muted { color: #667085; font-size: 12px; }
    .error { background: #FBEAE8; color: #8E2A20; padding: 16px; border-radius: 8px; }
  `]
})
export class SpMerchantOrdersComponent {
  private readonly http = inject(HttpClient)
  readonly token = localStorage.getItem('token')
  readonly items = signal<Row[]>([])
  readonly error = signal('')
  constructor () { this.load() }

  headers (): HttpHeaders { return new HttpHeaders({ Authorization: 'Bearer ' + this.token }) }

  load (): void {
    this.http.get<{ items: Row[] }>('/api/merchant/orders', { headers: this.headers() }).subscribe({
      next: (res) => this.items.set(res.items ?? []),
      error: () => this.error.set('加载失败，请稍后重试')
    })
  }

  ship (row: Row): void {
    const trackingNo = window.prompt('请输入物流单号', 'SF' + Date.now())
    if (!trackingNo) return
    this.http.post('/api/merchant/orders/' + row.id + '/ship', { trackingNo }, { headers: this.headers() }).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.message ?? '发货失败')
    })
  }
}