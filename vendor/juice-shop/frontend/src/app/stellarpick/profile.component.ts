import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { RouterLink } from '@angular/router'

@Component({
  selector: 'app-sp-profile',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sp-profile">
      <header>
        <p class="eyebrow">会员中心</p>
        <h1>个人资料</h1>
        <p class="sub">管理头像、邮箱与账号安全。</p>
      </header>

      @if (!token) {
        <div class="notice"><p>登录后管理个人资料。</p><a class="btn" routerLink="/login">去登录</a></div>
      } @else {
        <section class="card avatar-card">
          <img class="avatar" [src]="avatarUrl()" alt="当前头像" width="96" height="96" />
          <div class="avatar-side">
            <h2>头像</h2>
            <p class="muted">支持 JPG / PNG / WebP / SVG，演示环境不校验类型。</p>
            <input #fileInput type="file" accept="image/*,.svg" (change)="upload($event)" aria-label="上传头像" />
            <div class="row">
              <button type="button" class="btn" (click)="fileInput.click()" [disabled]="uploading()">{{ uploading() ? '上传中…' : '更换头像' }}</button>
              <a class="link" [href]="avatarUrl()" target="_blank" rel="noopener">查看原图</a>
            </div>
            @if (uploadError()) { <p class="error-text">{{ uploadError() }}</p> }
          </div>
        </section>

        <section class="card">
          <h2>修改邮箱</h2>
          <p class="muted">邮箱用于接收订单通知与账号提醒。</p>
          <div class="row">
            <input type="email" [value]="email()" (input)="onEmail($event)" aria-label="新邮箱" />
            <button type="button" class="btn" (click)="saveEmail()" [disabled]="saving()">{{ saving() ? '保存中…' : '保存邮箱' }}</button>
          </div>
          @if (emailMessage()) { <p class="ok">{{ emailMessage() }}</p> }
        </section>

        <section class="card">
          <h2>账号</h2>
          <dl>
            <div><dt>昵称</dt><dd>{{ name() }}</dd></div>
            <div><dt>角色</dt><dd>{{ roleText() }}</dd></div>
            <div><dt>登录态</dt><dd>JWT 存于 localStorage</dd></div>
          </dl>
          <div class="row">
            <a class="btn secondary" routerLink="/account/orders">我的订单</a>
            <a class="btn secondary" routerLink="/cart">购物车</a>
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .sp-profile { max-width: 820px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0 0 20px; font-size: 13px; }
    .card { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 20px 24px; margin-bottom: 16px; }
    .card h2 { font-size: 16px; margin: 0 0 8px; }
    .avatar-card { display: flex; gap: 24px; align-items: flex-start; }
    .avatar { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; background: #F5F7FA; border: 1px solid #E4E7EC; }
    .avatar-side { flex: 1; min-width: 0; }
    .muted { color: #667085; font-size: 13px; margin: 0 0 10px; }
    input[type=file] { display: none; }
    input[type=email] { flex: 1 1 240px; height: 40px; border: 1px solid #D0D5DD; border-radius: 4px; padding: 0 12px; font-size: 14px; }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .btn { height: 40px; padding: 0 18px; border: 0; border-radius: 6px; background: #0B2545; color: #fff; cursor: pointer; font-size: 14px; text-decoration: none; display: inline-flex; align-items: center; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn.secondary { background: #fff; color: #0B2545; border: 1px solid #D0D5DD; }
    .link { color: #1C4C9C; font-size: 13px; }
    .ok { color: #1F7A5C; font-size: 13px; margin: 10px 0 0; }
    .error-text { color: #C0392B; font-size: 13px; margin: 10px 0 0; }
    .notice { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 20px; }
    dl { margin: 12px 0 16px; display: flex; flex-direction: column; gap: 8px; }
    dl > div { display: flex; gap: 16px; font-size: 14px; }
    dt { color: #475467; width: 64px; }
    dd { margin: 0; }
  `]
})
export class SpProfileComponent {
  private readonly http = inject(HttpClient)
  readonly token = localStorage.getItem('token')
  readonly payload = this.decode()
  readonly name = signal(String(this.payload?.data?.email ?? '会员').split('@')[0])
  readonly email = signal(String(this.payload?.data?.email ?? ''))
  readonly role = signal(String(this.payload?.data?.role ?? 'customer'))
  readonly avatarUrl = signal<string>(String(this.payload?.data?.profileImage ?? '/assets/public/images/uploads/default.svg'))
  readonly uploading = signal(false)
  readonly uploadError = signal('')
  readonly saving = signal(false)
  readonly emailMessage = signal('')

  decode (): any {
    if (!this.token) return null
    try {
      const b64 = this.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
      return JSON.parse(atob(padded))
    } catch { return null }
  }

  headers (): HttpHeaders { return new HttpHeaders({ Authorization: 'Bearer ' + this.token }) }

  roleText (): string { return ({ admin: '管理员', customer: '会员', merchant: '商家', support: '客服' } as Record<string, string>)[this.role()] ?? '会员' }

  onEmail (event: Event): void { this.email.set((event.target as HTMLInputElement).value) }

  upload (event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    this.uploading.set(true)
    this.uploadError.set('')
    const form = new FormData()
    form.append('file', file)
    this.http.post<{ url: string }>('/api/account/avatar', form, { headers: this.headers() }).subscribe({
      next: (res) => { this.avatarUrl.set(res.url); this.uploading.set(false) },
      error: (err) => { this.uploadError.set(err?.error?.message ?? '上传失败，请重试'); this.uploading.set(false) }
    })
  }

  saveEmail (): void {
    this.saving.set(true)
    this.emailMessage.set('')
    this.http.post('/api/account/email', { email: this.email() }, { headers: this.headers() }).subscribe({
      next: () => { this.saving.set(false); this.emailMessage.set('邮箱已更新') },
      error: (err) => { this.saving.set(false); this.emailMessage.set(err?.error?.message ?? '保存失败') }
    })
  }
}