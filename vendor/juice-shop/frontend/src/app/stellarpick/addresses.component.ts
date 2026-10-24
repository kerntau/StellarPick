import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { RouterLink } from '@angular/router'

interface Address { id: number; name: string; phone: string; region: string; detail: string; isDefault: boolean }

@Component({
  selector: 'app-sp-addresses',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sp-addresses">
      <header>
        <p class="eyebrow">会员中心</p>
        <h1>收货地址</h1>
        <p class="sub">管理常用收货地址，结算时可直接选择。</p>
      </header>

      @if (!token) {
        <div class="notice"><p>登录后管理收货地址。</p><a class="btn" routerLink="/login">去登录</a></div>
      } @else {
        <section class="card">
          <h2>新增地址</h2>
          <div class="form">
            <label>收货人<input [value]="name()" (input)="name.set($any($event.target).value)" /></label>
            <label>手机号<input [value]="phone()" (input)="phone.set($any($event.target).value)" /></label>
            <label class="wide">省市区<input [value]="region()" (input)="region.set($any($event.target).value)" /></label>
            <label class="wide">详细地址<input [value]="detail()" (input)="detail.set($any($event.target).value)" /></label>
            <label class="check"><input type="checkbox" [checked]="isDefault()" (change)="isDefault.set($any($event.target).checked)" /> 设为默认地址</label>
            <button type="button" class="btn" (click)="add()">保存地址</button>
          </div>
          @if (message()) { <p class="ok">{{ message() }}</p> }
        </section>

        @if (items().length === 0) {
          <div class="notice">还没有收货地址，先新增一个吧。</div>
        } @else {
          <ul class="list">
            @for (item of items(); track item.id) {
              <li class="card address">
                <div class="who">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.phone }}</span>
                  @if (item.isDefault) { <span class="badge">默认</span> }
                </div>
                <p>{{ item.region }} {{ item.detail }}</p>
                <div class="ops">
                  @if (!item.isDefault) { <button type="button" (click)="setDefault(item)">设为默认</button> }
                  <button type="button" class="danger" (click)="remove(item)">删除</button>
                </div>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  styles: [`
    .sp-addresses { max-width: 820px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0 0 20px; font-size: 13px; }
    .card { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 18px 20px; margin-bottom: 14px; }
    .card h2 { font-size: 15px; margin: 0 0 12px; }
    .form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: end; }
    .form label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #475467; }
    .form label.wide { grid-column: 1 / -1; }
    .form label.check { flex-direction: row; align-items: center; gap: 8px; font-size: 13px; }
    input:not([type=checkbox]) { height: 38px; border: 1px solid #D0D5DD; border-radius: 4px; padding: 0 10px; font-size: 14px; }
    .btn { height: 40px; padding: 0 18px; border: 0; border-radius: 6px; background: #0B2545; color: #fff; cursor: pointer; font-size: 14px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
    .list { list-style: none; padding: 0; margin: 0; }
    .address .who { display: flex; align-items: center; gap: 10px; }
    .address p { color: #475467; font-size: 14px; margin: 8px 0 12px; }
    .badge { background: #FBF0DC; color: #8A5A00; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
    .ops { display: flex; gap: 14px; }
    .ops button { border: 0; background: none; color: #1C4C9C; cursor: pointer; font-size: 13px; padding: 0; }
    .ops button.danger { color: #C0392B; }
    .notice { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 20px; }
    .ok { color: #1F7A5C; font-size: 13px; margin: 10px 0 0; }
    @media (max-width: 640px) { .form { grid-template-columns: 1fr; } }
  `]
})
export class SpAddressesComponent {
  private readonly http = inject(HttpClient)
  readonly token = localStorage.getItem('token')
  readonly items = signal<Address[]>([])
  readonly name = signal('')
  readonly phone = signal('')
  readonly region = signal('')
  readonly detail = signal('')
  readonly isDefault = signal(false)
  readonly message = signal('')

  constructor () { this.load() }

  headers (): HttpHeaders { return new HttpHeaders({ Authorization: 'Bearer ' + this.token }) }

  load (): void {
    if (!this.token) return
    this.http.get<{ items: Address[] }>('/api/addresses', { headers: this.headers() }).subscribe({
      next: (res) => this.items.set(res.items ?? [])
    })
  }

  add (): void {
    this.message.set('')
    this.http.post<Address>('/api/addresses', { name: this.name(), phone: this.phone(), region: this.region(), detail: this.detail(), isDefault: this.isDefault() }, { headers: this.headers() }).subscribe({
      next: () => { this.message.set('地址已保存'); this.name.set(''); this.phone.set(''); this.region.set(''); this.detail.set(''); this.isDefault.set(false); this.load() },
      error: (err) => this.message.set(err?.error?.message ?? '保存失败')
    })
  }

  setDefault (item: Address): void {
    this.http.patch('/api/addresses/' + item.id, { isDefault: true }, { headers: this.headers() }).subscribe({ next: () => this.load() })
  }

  remove (item: Address): void {
    this.http.delete('/api/addresses/' + item.id, { headers: this.headers() }).subscribe({ next: () => this.load() })
  }
}
