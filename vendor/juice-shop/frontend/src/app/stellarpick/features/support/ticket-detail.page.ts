import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupportApi } from '../../core/api/support.api';
import { AuthStore } from '../../core/auth/auth.store';
import { Ticket, TicketMessage, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SpDatePipe } from '../../shared/pipes/date.pipe';
import { BreadcrumbComponent, Crumb } from '../../shared/ui/breadcrumb/breadcrumb.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';

interface MessageGroup {
  key: string;
  label: string;
  items: TicketMessage[];
}

function toDate(value: string): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(value: string): string {
  const date = toDate(value);
  return date ? date.toDateString() : 'unknown';
}

function dayLabel(value: string): string {
  const date = toDate(value);
  if (!date) {
    return '时间未知';
  }
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = (startOf(today) - startOf(date)) / 86400000;
  if (diff === 0) {
    return '今天';
  }
  if (diff === 1) {
    return '昨天';
  }
  return date.getFullYear() + ' 年 ' + (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日';
}

@Component({
  selector: 'app-ticket-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    IconComponent,
    SpDatePipe,
    BreadcrumbComponent,
    ErrorStateComponent,
    ModalComponent,
    SkeletonComponent,
    StatusBadgeComponent,
  ],
  template: `
    <div class="sp-container detail">
      <app-breadcrumb [items]="crumbs()" />

      @if (showSkeleton()) {
        <div class="sp-card sp-card--pad sk">
          <app-skeleton variant="line" width="42%" />
          <app-skeleton variant="line" width="68%" />
          <app-skeleton variant="line" width="100%" />
          <app-skeleton variant="line" width="86%" />
        </div>
      } @else if (error()) {
        <app-error-state [message]="error()" [requestId]="requestId()" (retry)="load()" />
        <div class="mt">
          <a class="sp-btn sp-btn--secondary" routerLink="/support/tickets">返回工单列表</a>
        </div>
      } @else if (loading()) {
        <div class="loading-placeholder"></div>
      } @else {
        @if (ticket(); as t) {
          <header class="head sp-card sp-card--pad">
            <div class="head-main">
              <div class="title-row">
                <h1>{{ t.subject }}</h1>
                <app-status-badge [status]="t.status" />
              </div>
              <p class="meta">
                <span>工单号 <span class="sp-num">#{{ t.id }}</span></span>
                <span>提交人 {{ t.userName }}</span>
                <span>创建于 {{ t.createdAt | spDate }}</span>
                <span>更新于 {{ t.updatedAt | spDate }}</span>
              </p>
            </div>
            <div class="head-actions">
              <a class="sp-btn sp-btn--ghost sp-btn--sm" routerLink="/support/tickets">
                <app-icon name="chevron-left" [size]="16" />返回列表
              </a>
              @if (t.status !== 'closed') {
                <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="openClose()">关闭工单</button>
              }
            </div>
          </header>

          <section class="thread sp-card" aria-labelledby="thread-title">
            <div class="thread-head">
              <h2 id="thread-title">对话记录</h2>
              <span class="sp-text-12 sp-muted">{{ messages().length }} 条消息</span>
            </div>

            @if (messages().length === 0) {
              <p class="no-msg sp-muted">还没有消息。写下你的问题，客服会尽快回复。</p>
            } @else {
              <!-- Scrollable transcript: focusable so keyboard users can scroll it. -->
              <div class="thread-body" #threadBody tabindex="0" role="group" aria-labelledby="thread-title">
                @for (group of groups(); track group.key) {
                  <div class="day-divider" role="separator"><span>{{ group.label }}</span></div>
                  <ol class="messages">
                    @for (msg of group.items; track msg.id) {
                      <li class="msg" [class.mine]="isMine(msg)">
                        <span class="avatar" [class.support]="!isMine(msg)" aria-hidden="true">
                          <app-icon [name]="isMine(msg) ? 'user' : 'headset'" [size]="16" />
                        </span>
                        <div class="bubble-wrap">
                          <div class="who">
                            <span class="name">{{ who(msg) }}</span>
                            <time [attr.datetime]="msg.createdAt">{{ msg.createdAt | spDate }}</time>
                          </div>
                          <div class="bubble"><p>{{ msg.body }}</p></div>
                        </div>
                      </li>
                    }
                  </ol>
                }
              </div>
            }
          </section>

          <section class="reply sp-card sp-card--pad" aria-labelledby="reply-title">
            <div class="reply-head">
              <h2 id="reply-title">{{ agentView() ? '回复会员' : '回复工单' }}</h2>
              @if (agentView() && t.status !== 'closed') {
                <span class="sp-badge sp-badge--info">客服视角</span>
              }
            </div>

            @if (t.status === 'closed') {
              <div class="sp-alert sp-alert--info closed-alert">
                <app-icon name="info" [size]="18" />
                <span>工单已关闭，无法继续回复。如仍有问题，请新建一个工单。</span>
              </div>
              <div class="closed-actions">
                <a class="sp-btn sp-btn--secondary" routerLink="/support/tickets">返回工单列表</a>
                <a class="sp-btn sp-btn--primary" routerLink="/support/tickets">新建工单</a>
              </div>
            } @else {
              <form (submit)="$event.preventDefault(); send()" novalidate>
                <div class="sp-field">
                  <div class="label-row">
                    <label class="sp-label" for="reply-body">回复内容<span class="sp-req">*</span></label>
                    <span class="sp-text-12 sp-muted sp-num">{{ reply().length }}/1000</span>
                  </div>
                  <textarea id="reply-body" class="sp-textarea" maxlength="1000" rows="4"
                            [placeholder]="agentView() ? '以客服身份回复，说明处理结果或需要会员补充的信息…' : '补充问题细节，或告诉客服你的处理结果…'"
                            [value]="reply()" (input)="onReplyInput($event)"
                            (keydown)="onReplyKeydown($event)"
                            [attr.aria-invalid]="replyError() ? 'true' : null"
                            [attr.aria-describedby]="replyError() ? 'reply-error' : 'reply-hint'"></textarea>
                  @if (replyError()) {
                    <p class="sp-error" id="reply-error">{{ replyError() }}</p>
                  } @else {
                    <p class="sp-hint" id="reply-hint">最多 1000 字，Ctrl / ⌘ + Enter 快速发送。客服会在工作时间内回复。</p>
                  }
                </div>
                <div class="form-actions">
                  <button class="sp-btn sp-btn--primary" type="submit" [disabled]="sending() || !reply().trim()"
                          [attr.aria-busy]="sending()">
                    {{ sending() ? '发送中…' : '发送回复' }}
                  </button>
                </div>
              </form>
            }
          </section>
        }
      }
    </div>

    <app-modal [open]="closeOpen()" title="关闭工单" (closed)="cancelClose()">
      <p class="confirm-text">
        关闭后将无法继续回复，确认关闭工单 <span class="sp-num">#{{ id() }}</span> 吗？
      </p>
      <div class="modal-actions">
        <button class="sp-btn sp-btn--secondary" type="button" (click)="cancelClose()" [disabled]="closing()">再想想</button>
        <button class="sp-btn sp-btn--danger" type="button" (click)="closeTicket()" [disabled]="closing()">
          {{ closing() ? '关闭中…' : '确认关闭' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .detail { max-width: 880px; padding-bottom: 64px; }
    .head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 16px; flex-wrap: wrap; margin-top: 8px;
    }
    .head-main { min-width: 0; }
    .title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .head h1 { font-size: 22px; line-height: 1.4; word-break: break-word; }
    .meta {
      display: flex; flex-wrap: wrap; gap: 4px 16px;
      margin-top: 10px; font-size: 12px; color: var(--sp-text-muted);
    }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .thread { margin-top: 16px; }
    .thread-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 16px 20px; border-bottom: 1px solid var(--sp-border);
    }
    .thread-head h2 { font-size: 16px; }
    .thread-body {
      max-height: 560px; overflow-y: auto; padding: 4px 20px 20px;
      scroll-behavior: smooth; overscroll-behavior: contain;
    }
    .no-msg { padding: 40px 20px; text-align: center; font-size: 14px; }
    .day-divider {
      display: flex; align-items: center; gap: 12px;
      margin: 16px 0 4px; font-size: 12px; color: var(--sp-text-muted);
    }
    .day-divider::before, .day-divider::after {
      content: ''; flex: 1 1 auto; height: 1px; background: var(--sp-border);
    }
    .day-divider span {
      flex: 0 0 auto; padding: 1px 10px; border-radius: var(--sp-radius-pill); background: var(--sp-bg);
    }
    .messages { display: flex; flex-direction: column; gap: 18px; padding-top: 12px; }
    .msg { display: flex; align-items: flex-start; gap: 10px; }
    .msg.mine { flex-direction: row-reverse; }
    .avatar {
      width: 32px; height: 32px; flex: none; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--sp-bg); color: var(--sp-primary);
    }
    .avatar.support { background: var(--sp-info-soft); color: var(--sp-info); }
    .bubble-wrap { min-width: 0; max-width: 72%; }
    .msg.mine .bubble-wrap { display: flex; flex-direction: column; align-items: flex-end; }
    .who {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 4px; font-size: 12px; color: var(--sp-text-muted);
    }
    .msg.mine .who { flex-direction: row-reverse; }
    .who .name { font-weight: 600; color: var(--sp-text-secondary); }
    .bubble {
      padding: 10px 14px; border-radius: 12px; background: var(--sp-bg);
      font-size: 14px; line-height: 1.7; color: var(--sp-text); word-break: break-word;
    }
    .bubble p { white-space: pre-wrap; }
    .msg.mine .bubble { background: var(--sp-primary); color: #fff; }

    .reply { margin-top: 16px; }
    .reply-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .reply h2 { font-size: 16px; }
    .closed-alert { align-items: center; }
    .closed-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .form-actions { display: flex; justify-content: flex-end; }
    .label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }

    .loading-placeholder { min-height: 280px; }
    .sk { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    app-skeleton { display: block; }
    .mt { margin-top: 16px; }
    .confirm-text { font-size: 14px; line-height: 1.8; color: var(--sp-text-secondary); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }

    @media (max-width: 767px) {
      .detail { padding-bottom: 40px; }
      .head { flex-direction: column; padding: 16px; }
      .head h1 { font-size: 19px; }
      .head-actions { width: 100%; }
      .head-actions .sp-btn { flex: 1 1 auto; min-height: 44px; }
      .thread-body { max-height: 62vh; padding: 4px 14px 16px; }
      .thread-head { padding: 14px 16px; }
      .messages { gap: 14px; }
      .bubble-wrap { max-width: 84%; }
      .reply { padding: 16px; }
      .closed-actions .sp-btn { flex: 1 1 auto; }
    }
  `],
})
export class TicketDetailPage {
  private readonly api = inject(SupportApi);
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly threadBody = viewChild<ElementRef<HTMLElement>>('threadBody');

  private readonly idParam = signal(Number(this.route.snapshot.paramMap.get('id')));
  readonly id = this.idParam.asReadonly();
  readonly crumbs = computed<Crumb[]>(() => [
    { label: '首页', link: '/' },
    { label: '客服工单', link: '/support/tickets' },
    { label: '工单 #' + this.id() },
  ]);

  readonly ticket = signal<Ticket | null>(null);
  readonly messages = computed<TicketMessage[]>(() => this.ticket()?.messages ?? []);
  readonly loading = signal(false);
  readonly showSkeleton = signal(false);
  readonly error = signal('');
  readonly requestId = signal<string | undefined>(undefined);

  readonly reply = signal('');
  readonly replyError = signal('');
  readonly sending = signal(false);

  readonly closeOpen = signal(false);
  readonly closing = signal(false);

  /** 客服 / 管理员看到的是工单处理视角：客服消息靠右，会员消息靠左。 */
  readonly agentView = computed(() => this.auth.role() === 'support' || this.auth.role() === 'admin');

  readonly groups = computed<MessageGroup[]>(() => {
    const out: MessageGroup[] = [];
    for (const message of this.messages()) {
      const key = dayKey(message.createdAt);
      const last = out[out.length - 1];
      if (last && last.key === key) {
        last.items.push(message);
      } else {
        out.push({ key, label: dayLabel(message.createdAt), items: [message] });
      }
    }
    return out;
  });

  private skeletonTimer?: ReturnType<typeof setTimeout>;
  private loadedId: number | null = null;
  private seq = 0;

  constructor() {
    // 同一路由内切换工单（前进/后退或直接改 URL）时组件会被复用，需按参数重新加载。
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (!Number.isFinite(id) || id <= 0) {
        this.error.set('工单编号不正确，请从工单列表进入。');
        return;
      }
      this.idParam.set(id);
      if (this.loadedId !== id) {
        this.loadedId = id;
        this.reply.set('');
        this.replyError.set('');
        this.load();
      }
    });
  }

  load(silent = false): void {
    if (!Number.isFinite(this.id())) {
      return;
    }
    const seq = ++this.seq;
    this.error.set('');
    this.requestId.set(undefined);
    if (silent) {
      this.loading.set(true);
    } else {
      this.beginLoading();
    }

    this.api.ticket(this.id()).subscribe({
      next: (ticket) => {
        if (seq !== this.seq) {
          return;
        }
        this.ticket.set(ticket);
        this.endLoading();
      },
      error: (err) => {
        if (seq !== this.seq) {
          return;
        }
        this.ticket.set(null);
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
        this.endLoading();
      },
    });
  }

  isMine(message: TicketMessage): boolean {
    const fromAgent = message.role === 'support' || message.role === 'admin';
    if (this.agentView()) {
      return fromAgent;
    }
    const email = this.auth.user()?.email;
    if (message.authorEmail && email) {
      return message.authorEmail === email;
    }
    return !fromAgent;
  }

  who(message: TicketMessage): string {
    const fromAgent = message.role === 'support' || message.role === 'admin';
    if (this.isMine(message)) {
      return message.author || this.auth.user()?.name || (fromAgent ? '客服' : '我');
    }
    if (fromAgent) {
      return message.author || '客服';
    }
    // 会员账号的 username 可能为空，此时用工单提交人兜底，避免出现「会员」这种无名标签。
    return message.author || this.ticket()?.userName || '会员';
  }

  onReplyInput(event: Event): void {
    this.reply.set((event.target as HTMLTextAreaElement).value);
    this.replyError.set('');
  }

  onReplyKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    if (this.sending()) {
      return;
    }
    const body = this.reply().trim();
    if (!body) {
      this.replyError.set('请输入回复内容');
      document.getElementById('reply-body')?.focus();
      return;
    }
    if (body.length > 1000) {
      this.replyError.set('回复内容不能超过 1000 字');
      return;
    }
    this.replyError.set('');
    this.sending.set(true);

    this.api.reply(this.id(), body).subscribe({
      next: (ticket) => {
        this.sending.set(false);
        this.reply.set('');
        // 回复接口返回整条工单，直接替换会话流，避免二次请求造成的闪动。
        this.ticket.set(ticket);
        this.toast.show('回复已发送');
        this.scrollToLatest();
      },
      error: (err) => {
        this.sending.set(false);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  openClose(): void {
    this.closeOpen.set(true);
  }

  cancelClose(): void {
    if (this.closing()) {
      return;
    }
    this.closeOpen.set(false);
  }

  closeTicket(): void {
    if (this.closing()) {
      return;
    }
    this.closing.set(true);
    this.api.close(this.id()).subscribe({
      next: (ticket) => {
        this.closing.set(false);
        this.closeOpen.set(false);
        this.ticket.set(ticket);
        this.toast.show('工单已关闭', 'info');
      },
      error: (err) => {
        this.closing.set(false);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  private scrollToLatest(): void {
    setTimeout(() => {
      const el = this.threadBody()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  private beginLoading(): void {
    this.loading.set(true);
    this.showSkeleton.set(false);
    clearTimeout(this.skeletonTimer);
    this.skeletonTimer = setTimeout(() => this.showSkeleton.set(true), 300);
  }

  private endLoading(): void {
    clearTimeout(this.skeletonTimer);
    this.loading.set(false);
    this.showSkeleton.set(false);
  }
}
