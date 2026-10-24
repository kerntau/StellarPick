import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'

interface Row { id: number; name: string; price: number; stock: number; image: string; status: string; statusText: string }

@Component({
  selector: 'app-sp-merchant-products',
  standalone: true,
  template: `
    <div class="sp-mp">
      <header><p class="eyebrow">商家中心</p><h1>商品管理</h1><p class="sub">本店商品、库存与上下架状态。</p></header>
      @if (error()) { <div class="error">{{ error() }}</div> } @else {
        <div class="table-wrap">
          <table>
            <caption>共 {{ items().length }} 件商品</caption>
            <thead><tr><th>商品</th><th>价格</th><th>库存</th><th>状态</th></tr></thead>
            <tbody>
              @for (row of items(); track row.id) {
                <tr>
                  <td class="product"><img [src]="'/assets/public/images/products/' + row.image" [alt]="row.name" width="44" height="44" /><span>{{ row.name }}</span></td>
                  <td class="num">¥{{ row.price.toFixed(2) }}</td>
                  <td class="num">{{ row.stock }}</td>
                  <td><span class="badge" [class.off]="row.status === 'off_sale'">{{ row.statusText }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .sp-mp { max-width: 1000px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0 0 20px; font-size: 13px; }
    .table-wrap { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    caption { text-align: left; padding: 14px 16px 0; color: #475467; font-size: 12px; }
    th { text-align: left; padding: 12px 16px; background: #F9FAFB; color: #475467; font-size: 12px; border-bottom: 1px solid #E4E7EC; }
    td { padding: 12px 16px; border-bottom: 1px solid #F2F4F7; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .product { display: flex; align-items: center; gap: 10px; }
    .product img { border-radius: 4px; background: #F5F7FA; }
    .badge { background: #E7F4EF; color: #1F7A5C; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
    .badge.off { background: #F2F4F7; color: #475467; }
    .error { background: #FBEAE8; color: #8E2A20; padding: 16px; border-radius: 8px; }
  `]
})
export class SpMerchantProductsComponent {
  private readonly http = inject(HttpClient)
  readonly token = localStorage.getItem('token')
  readonly items = signal<Row[]>([])
  readonly error = signal('')
  constructor () {
    this.http.get<{ items: Row[] }>('/api/merchant/products', { headers: new HttpHeaders({ Authorization: 'Bearer ' + this.token }) }).subscribe({
      next: (res) => this.items.set(res.items ?? []),
      error: () => this.error.set('加载失败，请稍后重试')
    })
  }
}
