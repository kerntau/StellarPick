import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { SlicePipe } from '@angular/common'

interface AdminUser { id: number; username: string; name: string; email: string; role: string; status: string; createdAt: string }

@Component({
  selector: 'app-sp-admin-users',
  standalone: true,
  imports: [SlicePipe],
  template: `
    <div class="sp-admin">
      <header>
        <p class="eyebrow">平台管理</p>
        <h1>用户管理</h1>
        <p class="sub">按账号、角色与状态查看平台账号。</p>
      </header>

      <div class="filters">
        <input type="search" placeholder="账号 / 邮箱" [value]="q()" (input)="onQuery($event)" aria-label="搜索账号或邮箱" />
        <select [value]="role()" (change)="onRole($event)" aria-label="角色筛选">
          <option value="">全部角色</option>
          <option value="admin">管理员</option>
          <option value="member">会员</option>
          <option value="merchant">商家</option>
          <option value="support">客服</option>
        </select>
        <select [value]="status()" (change)="onStatus($event)" aria-label="状态筛选">
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="disabled">已禁用</option>
        </select>
      </div>

      @if (error()) {
        <div class="error">{{ error() }}</div>
      } @else {
        <div class="table-wrap">
          <table>
            <caption>用户列表，共 {{ filtered().length }} 个账号</caption>
            <thead>
              <tr><th scope="col">ID</th><th scope="col">账号</th><th scope="col">邮箱</th><th scope="col">角色</th><th scope="col">状态</th><th scope="col">注册时间</th></tr>
            </thead>
            <tbody>
              @for (user of filtered(); track user.id) {
                <tr>
                  <td>{{ user.id }}</td>
                  <td><strong>{{ user.username }}</strong> <span class="muted">{{ user.name }}</span></td>
                  <td>{{ user.email }}</td>
                  <td>{{ roleText(user.role) }}</td>
                  <td><span class="badge" [class.off]="user.status === 'disabled'">{{ user.status === 'disabled' ? '已禁用' : '正常' }}</span></td>
                  <td>{{ user.createdAt | slice:0:10 }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .sp-admin { max-width: 1100px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0 0 20px; }
    .filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
    input, select { height: 40px; border: 1px solid #D0D5DD; border-radius: 4px; padding: 0 12px; font-size: 14px; background: #fff; }
    input { flex: 1 1 240px; }
    .table-wrap { overflow-x: auto; background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    caption { text-align: left; padding: 14px 16px 0; color: #475467; font-size: 12px; }
    th { text-align: left; padding: 12px 16px; background: #F9FAFB; color: #475467; font-size: 12px; border-bottom: 1px solid #E4E7EC; white-space: nowrap; }
    td { padding: 14px 16px; border-bottom: 1px solid #E4E7EC; }
    tbody tr:nth-child(even) { background: rgba(15,23,32,.03); }
    .muted { color: #667085; font-size: 12px; margin-left: 6px; }
    .badge { background: #E7F4EF; color: #1F7A5C; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
    .badge.off { background: #FBEAE8; color: #C0392B; }
    .error { background: #FBEAE8; color: #8E2A20; padding: 16px; border-radius: 8px; }
  `]
})
export class SpAdminUsersComponent {
  private readonly http = inject(HttpClient)
  readonly token = localStorage.getItem('token')
  readonly users = signal<AdminUser[]>([])
  readonly q = signal('')
  readonly role = signal('')
  readonly status = signal('')
  readonly error = signal('')

  constructor () { this.load() }

  load (): void {
    if (!this.token) { this.error.set('登录后查看用户列表'); return }
    this.http.get<{ items: AdminUser[] }>('/api/admin/users', { headers: new HttpHeaders({ Authorization: 'Bearer ' + this.token }) })
      .subscribe({ next: (res) => this.users.set(res.items ?? []), error: (err) => this.error.set(err?.error?.message ?? '加载失败，请稍后重试') })
  }

  filtered (): AdminUser[] {
    const q = this.q().toLowerCase()
    return this.users().filter((user) =>
      (!q || user.username.includes(q) || user.email.toLowerCase().includes(q)) &&
      (!this.role() || user.role === this.role()) &&
      (!this.status() || user.status === this.status())
    )
  }

  onQuery (event: Event): void { this.q.set((event.target as HTMLInputElement).value) }
  onRole (event: Event): void { this.role.set((event.target as HTMLSelectElement).value) }
  onStatus (event: Event): void { this.status.set((event.target as HTMLSelectElement).value) }
  roleText (role: string): string { return ({ admin: '管理员', member: '会员', merchant: '商家', support: '客服' } as Record<string, string>)[role] ?? role }
}
