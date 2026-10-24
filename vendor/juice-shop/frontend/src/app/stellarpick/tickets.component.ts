import { Component, inject, signal } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { SlicePipe } from '@angular/common'
import { RouterLink } from '@angular/router'

interface Ticket { id: number; subject: string; body: string; status: string; statusText: string; createdAt: string; author: string }

@Component({
  selector: 'app-sp-tickets',
  standalone: true,
  imports: [RouterLink, SlicePipe],
  template: `
    <div class="sp-tickets">
      <header>
        <p class="eyebrow">客户服务</p>
        <h1>客服工单</h1>
        <p class="sub">提交问题、跟进处理进度，所有对话都会保存在工单里。</p>
      </header>

      @if (!token) {
        <div class="notice"><p>登录后查看工单。</p><a class="btn" routerLink="/login">去登录</a></div>
      } @else {
        <section class="card">
          <h2>新建工单</h2>
          <div class="form">
            <input placeholder="工单主题" [value]="subject()" (input)="subject.set($any($event.target).value)" aria-label="工单主题" />
            <textarea placeholder="请描述遇到的问题" [value]="body()" (input)="body.set($any($event.target).value)" aria-label="问题描述"></textarea>
            <button type="button" class="btn" (click)="create()">提交工单</button>
          </div>
          @if (message()) { <p class="ok">{{ message() }}</p> }
        </section>

        <div class="tabs" role="tablist" aria-label="工单状态">
          @for (tab of tabs; track tab.key) {
            <button type="button" role="tab" [attr.aria-selected]="status() === tab.key" [class.on]="status() === tab.key" (click)="setStatus(tab.key)">{{ tab.label }}</button>
          }
        </div>

        @if (items().length === 0) {
          <div class="notice">当前没有工单。</div>
        } @else {
          <ul class="list">
            @for (ticket of items(); track ticket.id) {
              <li class="card">
                <div class="row"><strong>{{ ticket.subject }}</strong><span class="badge" [class.closed]="ticket.status === 'closed'">{{ ticket.statusText }}</span></div>
                <p class="body">{{ ticket.body }}</p>
                <p class="meta">#{{ ticket.id }} · {{ ticket.createdAt | slice:0:10 }} · {{ ticket.author }}</p>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  styles: [`
    .sp-tickets { max-width: 860px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 0 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0 0 20px; font-size: 13px; }
    .card { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 18px 20px; margin-bottom: 14px; }
    .card h2 { font-size: 15px; margin: 0 0 12px; }
    .form { display: flex; flex-direction: column; gap: 10px; }
    input, textarea { border: 1px solid #D0D5DD; border-radius: 4px; padding: 10px 12px; font-size: 14px; font-family: inherit; }
    textarea { min-height: 90px; resize: vertical; }
    .btn { align-self: flex-start; height: 40px; padding: 0 18px; border: 0; border-radius: 6px; background: #0B2545; color: #fff; cursor: pointer; }
    .tabs { display: flex; gap: 4px; border-bottom: 1px solid #E4E7EC; margin: 18px 0 14px; }
    .tabs button { border: 0; background: none; padding: 10px 14px; font-size: 14px; color: #475467; cursor: pointer; border-bottom: 2px solid transparent; }
    .tabs button.on { color: #0B2545; font-weight: 700; border-bottom-color: #E8A33D; }
    .list { list-style: none; padding: 0; margin: 0; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .badge { background: #EAF1FD; color: #1C4C9C; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
    .badge.closed { background: #F2F4F7; color: #475467; }
    .body { color: #475467; font-size: 14px; margin: 8px 0; }
    .meta { color: #667085; font-size: 12px; margin: 0; }
    .notice { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 20px; }
    .ok { color: #1F7A5C; font-size: 13px; margin: 8px 0 0; }
  `]
})
export class SpTicketsComponent {
  private readonly http = inject(HttpClient)
  readonly token = localStorage.getItem('token')
  readonly items = signal<Ticket[]>([])
  readonly status = signal('')
  readonly subject = signal('')
  readonly body = signal('')
  readonly message = signal('')
  readonly tabs = [
    { key: '', label: '全部' }, { key: 'open', label: '待处理' },
    { key: 'processing', label: '处理中' }, { key: 'closed', label: '已关闭' }
  ]

  constructor () { this.load() }

  headers (): HttpHeaders { return new HttpHeaders({ Authorization: 'Bearer ' + this.token }) }

  load (): void {
    if (!this.token) return
    const query = this.status() ? '?status=' + this.status() : ''
    this.http.get<{ items: Ticket[] }>('/api/support/tickets' + query, { headers: this.headers() }).subscribe({
      next: (res) => this.items.set(res.items ?? [])
    })
  }

  setStatus (key: string): void { this.status.set(key); this.load() }

  create (): void {
    this.message.set('')
    this.http.post<Ticket>('/api/support/tickets', { subject: this.subject(), body: this.body() }, { headers: this.headers() }).subscribe({
      next: () => { this.message.set('工单已提交'); this.subject.set(''); this.body.set(''); this.status.set(''); this.load() },
      error: (err) => this.message.set(err?.error?.message ?? '提交失败')
    })
  }
}