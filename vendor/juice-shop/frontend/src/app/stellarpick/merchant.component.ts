import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { RouterLink } from '@angular/router'

interface Summary { todayOrders: number; todaySales: number; pendingShipment: number; productCount: number; merchant: { name: string; status: string } }

@Component({
  selector: 'app-sp-merchant',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sp-merchant">
      <header>
        <p class="eyebrow">商家中心</p>
        <h1>{{ summary()?.merchant?.name || '星澜自营旗舰店' }}</h1>
        <p class="sub">今日经营概览 · 演示数据</p>
      </header>

      @if (error()) {
        <div class="error">{{ error() }}</div>
      } @else {
        <div class="stats">
          <div class="stat"><span>今日订单</span><strong>{{ summary()?.todayOrders ?? 0 }}</strong></div>
          <div class="stat"><span>今日销售额</span><strong>¥{{ (summary()?.todaySales ?? 0).toFixed(2) }}</strong></div>
          <div class="stat"><span>待发货</span><strong>{{ summary()?.pendingShipment ?? 0 }}</strong></div>
          <div class="stat"><span>商品总数</span><strong>{{ summary()?.productCount ?? 0 }}</strong></div>
        </div>

        <section class="card">
          <h2>近 7 日订单趋势</h2>
          <div class="chart" aria-label="近 7 日订单趋势（演示静态数据）">
            @for (bar of bars; track bar.day) {
              <div class="bar-item">
                <div class="bar" [style.height.%]="bar.value"></div>
                <span>{{ bar.day }}</span>
              </div>
            }
          </div>
        </section>

        <div class="quick">
          <a routerLink="/merchant/products">商品管理</a>
          <a routerLink="/merchant/orders">订单管理</a>
          <a routerLink="/account/orders">查看订单</a>
          <a routerLink="/">返回商城</a>
          <a routerLink="/admin/users">平台用户</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .sp-merchant { max-width: 1000px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0 0 20px; font-size: 13px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
    .stat { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; }
    .stat span { color: #475467; font-size: 12px; }
    .stat strong { font-size: 26px; font-variant-numeric: tabular-nums; }
    .card { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 18px 20px; margin-bottom: 16px; }
    .card h2 { font-size: 15px; margin: 0 0 16px; }
    .chart { display: flex; align-items: flex-end; gap: 18px; height: 180px; padding: 0 8px; }
    .bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end; }
    .bar { width: 100%; max-width: 46px; background: linear-gradient(180deg, #E8A33D, #B4690E); border-radius: 4px 4px 0 0; }
    .bar-item span { font-size: 12px; color: #475467; }
    .quick { display: flex; gap: 12px; flex-wrap: wrap; }
    .quick a { padding: 10px 16px; border: 1px solid #D0D5DD; border-radius: 6px; color: #0B2545; text-decoration: none; font-size: 14px; }
    .error { background: #FBEAE8; color: #8E2A20; padding: 16px; border-radius: 8px; }
    @media (max-width: 767px) { .stats { grid-template-columns: 1fr 1fr; } }
  `]
})
export class SpMerchantComponent {
  private readonly http = inject(HttpClient)
  readonly token = localStorage.getItem('token')
  readonly summary = signal<Summary | null>(null)
  readonly error = signal('')
  readonly bars = [
    { day: '周四', value: 40 }, { day: '周五', value: 62 }, { day: '周六', value: 52 },
    { day: '周日', value: 84 }, { day: '周一', value: 66 }, { day: '周二', value: 92 }, { day: '周三', value: 74 }
  ]

  constructor () {
    if (!this.token) { this.error.set('登录后查看商家工作台'); return }
    this.http.get<Summary>('/api/merchant/summary', { headers: new HttpHeaders({ Authorization: 'Bearer ' + this.token }) }).subscribe({
      next: (res) => this.summary.set(res),
      error: () => this.error.set('加载失败，请稍后重试')
    })
  }
}