import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { RouterLink } from '@angular/router'

interface CartLine { id: number; productId: number; title: string; image: string; unitPrice: number; quantity: number; subtotal: number }

@Component({
  selector: 'app-sp-checkout',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sp-checkout">
      <header>
        <p class="eyebrow">结算</p>
        <h1>确认订单</h1>
        <p class="sub">核对收货信息与商品清单，提交后我们立即为你备货。</p>
      </header>

      @if (!token) {
        <div class="notice"><p>登录后结算。</p><a class="btn" routerLink="/login">去登录</a></div>
      } @else if (done()) {
        <div class="card ok">
          <h2>下单成功</h2>
          <p>订单 {{ done()!.id }} 已提交，实付 ¥{{ done()!.total.toFixed(2) }}。</p>
          <a class="btn" routerLink="/account/orders">查看我的订单</a>
        </div>
      } @else if (lines().length === 0) {
        <div class="notice"><p>购物车是空的，先去挑几件商品吧。</p><a class="btn" routerLink="/">去逛逛</a></div>
      } @else {
        <section class="card">
          <h2>收货地址</h2>
          <div class="form">
            <label>收货人<input [value]="recipient()" (input)="recipient.set($any($event.target).value)" /></label>
            <label>手机号<input [value]="phone()" (input)="phone.set($any($event.target).value)" /></label>
            <label class="wide">省市区<input [value]="region()" (input)="region.set($any($event.target).value)" /></label>
            <label class="wide">详细地址<input [value]="detail()" (input)="detail.set($any($event.target).value)" /></label>
          </div>
        </section>

        <section class="card">
          <h2>配送与发票</h2>
          <div class="choices">
            <label><input type="radio" name="ship" checked /> 标准配送（免运费）</label>
            <label><input type="radio" name="ship" /> 次日达（演示）</label>
          </div>
          <div class="choices">
            <label><input type="radio" name="invoice" checked /> 不开票</label>
            <label><input type="radio" name="invoice" /> 电子普通发票</label>
          </div>
        </section>

        <section class="card">
          <h2>商品清单</h2>
          <table>
            <thead><tr><th>商品</th><th>单价</th><th>数量</th><th class="num">小计</th></tr></thead>
            <tbody>
              @for (line of lines(); track line.id) {
                <tr>
                  <td class="product"><img [src]="'/assets/public/images/products/' + line.image" [alt]="line.title" width="44" height="44" /><span>{{ line.title }}</span></td>
                  <td class="num">¥{{ line.unitPrice.toFixed(2) }}</td>
                  <td class="num">{{ line.quantity }}</td>
                  <td class="num">¥{{ line.subtotal.toFixed(2) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>

        <section class="summary">
          <div><span>商品件数</span><strong>{{ count() }} 件</strong></div>
          <div><span>商品金额</span><strong>¥{{ total().toFixed(2) }}</strong></div>
          <div><span>运费</span><strong>¥0.00</strong></div>
          <div class="total"><span>应付合计</span><strong>¥{{ total().toFixed(2) }}</strong></div>
          <button type="button" class="btn block" (click)="submit()" [disabled]="submitting()">{{ submitting() ? '提交中…' : '提交订单' }}</button>
          <a class="back" routerLink="/cart">返回购物车</a>
        </section>
      }
    </div>
  `,
  styles: [`
    .sp-checkout { max-width: 960px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0 0 20px; font-size: 13px; }
    .card { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 18px 20px; margin-bottom: 16px; }
    .card h2 { font-size: 15px; margin: 0 0 12px; }
    .form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #475467; }
    .form label.wide { grid-column: 1 / -1; }
    input[type=text], input:not([type]) { height: 38px; border: 1px solid #D0D5DD; border-radius: 4px; padding: 0 10px; font-size: 14px; }
    .choices { display: flex; gap: 20px; flex-wrap: wrap; font-size: 14px; margin-bottom: 10px; }
    .choices label { display: inline-flex; align-items: center; gap: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 8px 10px; color: #475467; font-size: 12px; border-bottom: 1px solid #E4E7EC; }
    td { padding: 10px; border-bottom: 1px solid #F2F4F7; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .product { display: flex; align-items: center; gap: 10px; }
    .product img { border-radius: 4px; background: #F5F7FA; }
    .summary { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 18px 20px; max-width: 360px; margin-left: auto; display: flex; flex-direction: column; gap: 10px; }
    .summary > div { display: flex; justify-content: space-between; font-size: 14px; color: #475467; }
    .summary .total { border-top: 1px solid #E4E7EC; padding-top: 10px; font-weight: 700; color: #0F1720; }
    .summary .total strong { color: #8A5A00; font-size: 22px; }
    .btn { height: 40px; padding: 0 18px; border: 0; border-radius: 6px; background: #0B2545; color: #fff; cursor: pointer; font-size: 14px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
    .btn.block { width: 100%; }
    .btn:disabled { opacity: .5; }
    .back { text-align: center; color: #475467; font-size: 13px; text-decoration: none; }
    .notice, .card.ok { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 24px; }
    .card.ok h2 { color: #1F7A5C; }
    @media (max-width: 640px) { .form { grid-template-columns: 1fr; } }
  `]
})
export class SpCheckoutComponent {
  private readonly http = inject(HttpClient)
  readonly token = localStorage.getItem('token')
  readonly lines = signal<CartLine[]>([])
  readonly total = signal(0)
  readonly count = signal(0)
  readonly recipient = signal('林晓')
  readonly phone = signal('13800000002')
  readonly region = signal('上海市 / 上海市 / 星澜区')
  readonly detail = signal('示例路 88 号 3 栋 1201')
  readonly submitting = signal(false)
  readonly done = signal<{ id: number; total: number } | null>(null)

  constructor () {
    if (this.token) {
      this.http.get<{ items: CartLine[]; total: number; count: number }>('/api/cart', { headers: this.headers() }).subscribe({
        next: (res) => { this.lines.set(res.items ?? []); this.total.set(res.total ?? 0); this.count.set(res.count ?? 0) }
      })
    }
  }

  headers (): HttpHeaders { return new HttpHeaders({ Authorization: 'Bearer ' + this.token }) }

  submit (): void {
    this.submitting.set(true)
    const items = this.lines().map((line) => ({ productId: line.productId, title: line.title, image: line.image, unitPrice: line.unitPrice, quantity: line.quantity }))
    // V09: unitPrice is sent as-is from the cart line.
    this.http.post<{ id: number; total: number }>('/api/checkout', { items, address: { recipient: this.recipient(), phone: this.phone(), region: this.region(), detail: this.detail() } }, { headers: this.headers() }).subscribe({
      next: (res) => { this.done.set(res); this.submitting.set(false) },
      error: () => this.submitting.set(false)
    })
  }
}
