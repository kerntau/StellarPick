import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { RouterLink } from '@angular/router'

interface Product { id: number; name: string; price: number; image: string }
interface CartLine { id: number; productId: number; title: string; image: string; unitPrice: number; quantity: number; subtotal: number }

@Component({
  selector: 'app-sp-cart',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sp-cart">
      <header>
        <p class="eyebrow">购物车</p>
        <h1>确认清单</h1>
        <p class="sub">单价由客户端提交，服务端按提交值计算（V09）。</p>
      </header>

      @if (!token) {
        <div class="notice"><p>登录后查看购物车。</p><a class="btn" routerLink="/login">去登录</a></div>
      } @else {
        <section class="card add">
          <h2>挑选商品</h2>
          <div class="add-row">
            <select [value]="selected()" (change)="onSelect($event)" aria-label="选择商品">
              <option value="">请选择商品</option>
              @for (product of products(); track product.id) {
                <option [value]="product.id">{{ product.name }} · ¥{{ product.price }}</option>
              }
            </select>
            <button type="button" class="btn" (click)="add()" [disabled]="!selected()">加入购物车</button>
          </div>
        </section>

        @if (error()) { <div class="error">{{ error() }}</div> }

        @if (lines().length === 0) {
          <div class="notice"><p>购物车还是空的，去挑几件喜欢的吧。</p><a class="btn" routerLink="/">去逛逛</a></div>
        } @else {
          <section class="card">
            <table>
              <thead><tr><th>商品</th><th>单价</th><th>数量</th><th class="num">小计</th><th></th></tr></thead>
              <tbody>
                @for (line of lines(); track line.id) {
                  <tr>
                    <td class="product">
                      <img [src]="'/assets/public/images/products/' + line.image" [alt]="line.title" width="48" height="48" />
                      <span>{{ line.title }}</span>
                    </td>
                    <td class="num">¥{{ line.unitPrice.toFixed(2) }}</td>
                    <td>
                      <div class="stepper">
                        <button type="button" (click)="setQty(line, line.quantity - 1)" [disabled]="line.quantity <= 1">−</button>
                        <span>{{ line.quantity }}</span>
                        <button type="button" (click)="setQty(line, line.quantity + 1)">+</button>
                      </div>
                    </td>
                    <td class="num">¥{{ line.subtotal.toFixed(2) }}</td>
                    <td><button type="button" class="link" (click)="remove(line)">删除</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </section>

          <section class="summary">
            <div><span>商品件数</span><strong>{{ count() }} 件</strong></div>
            <div><span>商品金额</span><strong>¥{{ total().toFixed(2) }}</strong></div>
            <div class="total"><span>合计</span><strong>¥{{ total().toFixed(2) }}</strong></div>
            <a class="btn block" routerLink="/checkout">去结算</a>
            @if (lastOrder()) { <p class="ok">下单成功：订单 {{ lastOrder()!.id }}，实付 ¥{{ lastOrder()!.total.toFixed(2) }}</p> }
          </section>
        }
      }
    </div>
  `,
  styles: [`
    .sp-cart { max-width: 960px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0 0 20px; font-size: 13px; }
    .card { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 18px 20px; margin-bottom: 16px; }
    .card h2 { font-size: 15px; margin: 0 0 12px; }
    .add-row { display: flex; gap: 10px; flex-wrap: wrap; }
    select { flex: 1 1 260px; height: 40px; border: 1px solid #D0D5DD; border-radius: 4px; padding: 0 10px; font-size: 14px; background: #fff; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 8px 10px; color: #475467; font-size: 12px; border-bottom: 1px solid #E4E7EC; }
    td { padding: 12px 10px; border-bottom: 1px solid #F2F4F7; vertical-align: middle; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .product { display: flex; align-items: center; gap: 10px; }
    .product img { border-radius: 4px; background: #F5F7FA; }
    .stepper { display: inline-flex; align-items: center; border: 1px solid #D0D5DD; border-radius: 4px; overflow: hidden; }
    .stepper button { width: 30px; height: 30px; border: 0; background: #fff; cursor: pointer; }
    .stepper span { min-width: 32px; text-align: center; font-size: 13px; }
    .link { border: 0; background: none; color: #C0392B; cursor: pointer; font-size: 13px; }
    .summary { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 18px 20px; max-width: 360px; margin-left: auto; display: flex; flex-direction: column; gap: 10px; }
    .summary > div { display: flex; justify-content: space-between; font-size: 14px; color: #475467; }
    .summary .total { border-top: 1px solid #E4E7EC; padding-top: 10px; font-weight: 700; color: #0F1720; }
    .summary .total strong { color: #8A5A00; font-size: 22px; }
    .btn { height: 40px; padding: 0 18px; border: 0; border-radius: 6px; background: #0B2545; color: #fff; cursor: pointer; font-size: 14px; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn.block { width: 100%; }
    .notice, .error { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .error { background: #FBEAE8; color: #8E2A20; border-color: #F2C7C1; }
    .ok { color: #1F7A5C; font-size: 13px; margin: 0; }
    .muted { color: #667085; }
  `]
})
export class SpCartComponent {
  private readonly http = inject(HttpClient)
  readonly token = localStorage.getItem('token')
  readonly products = signal<Product[]>([])
  readonly lines = signal<CartLine[]>([])
  readonly total = signal(0)
  readonly count = signal(0)
  readonly selected = signal('')
  readonly error = signal('')
  readonly checkingOut = signal(false)
  readonly lastOrder = signal<{ id: number; total: number } | null>(null)

  constructor () {
    this.http.get<{ data: Product[] }>('/rest/products/search?q=').subscribe({
      next: (res) => this.products.set(res.data ?? []),
      error: () => this.error.set('商品加载失败，请稍后重试')
    })
    this.refresh()
  }

  refresh (): void {
    if (!this.token) return
    this.http.get<{ items: CartLine[]; total: number; count: number }>('/api/cart', { headers: this.headers() }).subscribe({
      next: (res) => { this.lines.set(res.items ?? []); this.total.set(res.total ?? 0); this.count.set(res.count ?? 0) },
      error: (err) => this.error.set(err?.error?.message ?? '购物车加载失败')
    })
  }

  headers (): HttpHeaders { return new HttpHeaders({ Authorization: 'Bearer ' + this.token }) }

  onSelect (event: Event): void { this.selected.set((event.target as HTMLSelectElement).value) }

  add (): void {
    const product = this.products().find((entry) => entry.id === Number(this.selected()))
    if (!product) return
    // V09: the product price is submitted as unitPrice; the client can change it.
    this.http.post('/api/cart/items', { productId: product.id, quantity: 1, unitPrice: product.price }, { headers: this.headers() }).subscribe({
      next: () => this.refresh(),
      error: (err) => this.error.set(err?.error?.message ?? '加入购物车失败')
    })
  }

  setQty (line: CartLine, quantity: number): void {
    if (quantity < 1) return
    this.http.patch('/api/cart/items/' + line.id, { quantity }, { headers: this.headers() }).subscribe({
      next: (res: any) => { this.lines.set(res.items); this.total.set(res.total); this.count.set(res.count) },
      error: (err) => this.error.set(err?.error?.message ?? '更新失败')
    })
  }

  remove (line: CartLine): void {
    this.http.delete('/api/cart/items/' + line.id, { headers: this.headers() }).subscribe({
      next: () => this.refresh(),
      error: (err) => this.error.set(err?.error?.message ?? '删除失败')
    })
  }

  checkout (): void {
    this.checkingOut.set(true)
    const items = this.lines().map((line) => ({ productId: line.productId, title: line.title, image: line.image, unitPrice: line.unitPrice, quantity: line.quantity }))
    this.http.post<{ id: number; total: number }>('/api/checkout', { items }, { headers: this.headers() }).subscribe({
      next: (res) => { this.lastOrder.set(res); this.checkingOut.set(false); this.refresh() },
      error: (err) => { this.error.set(err?.error?.message ?? '下单失败'); this.checkingOut.set(false) }
    })
  }
}