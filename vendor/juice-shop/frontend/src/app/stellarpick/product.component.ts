import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'

interface Product { id: number; name: string; description: string; price: number; deluxePrice?: number; image: string }

@Component({
  selector: 'app-sp-product',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sp-product">
      <a class="back" routerLink="/">← 返回商城</a>

      @if (loading()) {
        <p class="muted">正在加载商品…</p>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (product(); as p) {
        <div class="grid">
          <div class="media">
            <img [src]="'/assets/public/images/products/' + p.image" [alt]="p.name" width="800" height="800" />
          </div>
          <div class="info">
            <p class="eyebrow">星澜优选</p>
            <h1>{{ p.name }}</h1>
            <p class="sub">{{ p.description }}</p>
            <div class="price">¥{{ p.price.toFixed(2) }}</div>
            <p class="stock">现货 · 48 小时内发货</p>

            <div class="qty">
              <span>数量</span>
              <div class="stepper">
                <button type="button" (click)="setQty(quantity() - 1)" [disabled]="quantity() <= 1">−</button>
                <span>{{ quantity() }}</span>
                <button type="button" (click)="setQty(quantity() + 1)">+</button>
              </div>
            </div>

            <div class="actions">
              <button type="button" class="btn" (click)="add(false)" [disabled]="busy()">加入购物车</button>
              <button type="button" class="btn accent" (click)="add(true)" [disabled]="busy()">立即购买</button>
            </div>
            @if (message()) { <p class="ok">{{ message() }}</p> }

            <ul class="promises">
              <li>正品保障</li>
              <li>7 天无理由退换</li>
              <li>满 99 元包邮</li>
            </ul>

            <div class="links">
              <a [routerLink]="['/product', p.id, 'reviews']">查看全部评价</a>
              <a routerLink="/cart">去购物车</a>
            </div>
          </div>
        </div>

        <section class="card">
          <h2>商品详情</h2>
          <p>{{ p.description }}</p>
          <p class="muted">演示环境：商品、价格与库存均为虚构数据。</p>
        </section>
      }
    </div>
  `,
  styles: [`
    .sp-product { max-width: 1100px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .back { color: #475467; text-decoration: none; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 20px 0 32px; }
    .media img { width: 100%; border-radius: 12px; border: 1px solid #E4E7EC; background: #F1F3F6; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 6px; }
    h1 { font-size: 30px; margin: 0 0 8px; }
    .sub { color: #475467; font-size: 14px; margin: 0 0 18px; }
    .price { color: #8A5A00; font-size: 34px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .stock { color: #1F7A5C; font-size: 13px; margin: 6px 0 20px; }
    .qty { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #475467; margin-bottom: 16px; }
    .stepper { display: inline-flex; align-items: center; border: 1px solid #D0D5DD; border-radius: 4px; overflow: hidden; }
    .stepper button { width: 34px; height: 34px; border: 0; background: #fff; cursor: pointer; }
    .stepper span { min-width: 40px; text-align: center; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn { height: 44px; padding: 0 24px; border: 0; border-radius: 6px; background: #0B2545; color: #fff; cursor: pointer; font-size: 14px; }
    .btn.accent { background: #E8A33D; color: #0B2545; }
    .btn:disabled { opacity: .5; }
    .ok { color: #1F7A5C; font-size: 13px; }
    .promises { list-style: none; padding: 16px 0 0; margin: 16px 0 0; border-top: 1px solid #E4E7EC; display: flex; gap: 18px; font-size: 12px; color: #475467; }
    .links { display: flex; gap: 16px; margin-top: 16px; font-size: 13px; }
    .links a { color: #1C4C9C; text-decoration: none; }
    .card { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 20px 24px; }
    .card h2 { font-size: 16px; margin: 0 0 10px; }
    .muted { color: #667085; font-size: 13px; }
    .error { background: #FBEAE8; color: #8E2A20; padding: 16px; border-radius: 8px; }
    @media (max-width: 767px) { .grid { grid-template-columns: 1fr; gap: 20px; } }
  `]
})
export class SpProductComponent {
  private readonly http = inject(HttpClient)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  readonly token = localStorage.getItem('token')
  readonly product = signal<Product | null>(null)
  readonly quantity = signal(1)
  readonly loading = signal(true)
  readonly error = signal('')
  readonly busy = signal(false)
  readonly message = signal('')

  constructor () {
    const id = this.route.snapshot.paramMap.get('id')
    this.http.get<{ data: Product }>('/api/Products/' + id).subscribe({
      next: (res) => { this.product.set(res.data); this.loading.set(false) },
      error: () => { this.error.set('商品不存在或已下架'); this.loading.set(false) }
    })
  }

  setQty (value: number): void { if (value >= 1 && value <= 99) this.quantity.set(value) }

  add (buyNow: boolean): void {
    const product = this.product()
    if (!product) return
    if (!this.token) { this.router.navigate(['/login']); return }
    this.busy.set(true)
    this.http.post('/api/cart/items', { productId: product.id, quantity: this.quantity(), unitPrice: product.price }, {
      headers: new HttpHeaders({ Authorization: 'Bearer ' + this.token })
    }).subscribe({
      next: () => {
        this.busy.set(false)
        if (buyNow) { this.router.navigate(['/checkout']) } else { this.message.set('已加入购物车') }
      },
      error: () => { this.busy.set(false); this.message.set('加入购物车失败，请稍后重试') }
    })
  }
}
