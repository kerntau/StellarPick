import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SupportApi } from '../../core/api/support.api';
import { AuthStore } from '../../core/auth/auth.store';
import { Ticket, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SpDatePipe } from '../../shared/pipes/date.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';

interface StatusTab {
  value: string;
  label: string;
}

/** 状态值与后端一致：open / processing / closed。 */
const STATUS_TABS: StatusTab[] = [
  { value: '', label: '全部' },
  { value: 'open', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'closed', label: '已关闭' },
];

@Component({
  selector: 'app-tickets-page',
  standalone: true,
  imports: [
    RouterLink,
    IconComponent,
    SpDatePipe,
    EmptyStateComponent,
    ErrorStateComponent,
    ModalComponent,
    PaginationComponent,
    SkeletonComponent,
    StatusBadgeComponent,
  ],
  template: `
    <div class="sp-container tickets">
      <header class="head">
        <div class="head-main">
          <p class="sp-eyebrow">客户服务</p>
          <h1>客服工单</h1>
          <p class="sp-secondary head-desc">
            提交问题、跟进处理进度，所有对话都会保存在工单里。
          </p>
          <ul class="service-meta">
            <li><app-icon name="clock" [size]="14" />工作日 9:00–21:00 有人值守</li>
            <li><app-icon name="headset" [size]="14" />平均 2 小时内首次回复</li>
          </ul>
        </div>
        @if (loggedIn()) {
          <button class="sp-btn sp-btn--primary new-btn" type="button" (click)="openCreate()">
            <app-icon name="plus" [size]="16" />新建工单
          </button>
        }
      </header>

      @if (!loggedIn()) {
        <div class="sp-card login-empty">
          <app-empty-state image="orders" title="登录后查看客服工单"
                           description="工单会保存在你的账号下，方便随时跟进处理进度。"
                           actionLabel="去登录" (action)="goLogin()" />
          <p class="alt">还没有账号？<a class="sp-link" routerLink="/register">立即注册</a></p>
        </div>
      } @else {
        <div class="sp-tabbar" role="tablist" aria-label="按工单状态筛选">
          @for (tab of tabs; track tab.value; let i = $index) {
            <button type="button" role="tab" [id]="'ticket-tab-' + (tab.value || 'all')"
                    [attr.aria-selected]="status() === tab.value" aria-controls="ticket-panel"
                    [tabindex]="status() === tab.value ? 0 : -1"
                    (click)="select(tab.value)" (keydown)="onTabKeydown($event, i)">
              {{ tab.label }}<span class="count sp-num">{{ countOf(tab.value) }}</span>
            </button>
          }
        </div>

        <div id="ticket-panel" class="panel" role="tabpanel" tabindex="0"
             [attr.aria-labelledby]="'ticket-tab-' + (status() || 'all')" [attr.aria-busy]="loading()">
          @if (error()) {
            <app-error-state [message]="error()" [requestId]="requestId()" (retry)="load()" />
          } @else if (showSkeleton()) {
            <app-skeleton variant="table" />
          } @else if (loading()) {
            <div class="loading-placeholder"></div>
          } @else if (tickets().length === 0) {
            @if (status()) {
              <app-empty-state image="search" title="没有「{{ statusLabel() }}」的工单"
                               description="换个状态看看，或提交一个新的工单。"
                               actionLabel="查看全部工单" (action)="select('')" />
            } @else {
              <app-empty-state image="orders" title="还没有提交过工单"
                               description="遇到问题时提交工单，客服会在工作时间内回复。"
                               actionLabel="新建工单" (action)="openCreate()" />
            }
          } @else {
            <div class="list-head">
              <p class="sp-text-13 sp-secondary">
                共 <strong class="sp-num">{{ total() }}</strong> 个工单
                <span class="sp-muted">· 按最近更新排序</span>
              </p>
              <button class="sp-btn sp-btn--ghost sp-btn--sm" type="button" (click)="load()">
                <app-icon name="refresh" [size]="14" />刷新
              </button>
            </div>

            <ul class="list">
              @for (ticket of tickets(); track ticket.id) {
                <li>
                  <a class="ticket sp-card" [routerLink]="['/support/tickets', ticket.id]">
                    <div class="ticket-main">
                      <div class="ticket-top">
                        <h2 class="sp-clamp-1">{{ ticket.subject }}</h2>
                        <app-status-badge [status]="ticket.status" />
                      </div>
                      <p class="last sp-clamp-2">{{ ticket.lastMessage || '暂无消息' }}</p>
                      <div class="ticket-meta">
                        <span class="sp-num">#{{ ticket.id }}</span>
                        <span class="who"><app-icon name="user" [size]="12" />{{ ticket.userName }}</span>
                        <span class="when"><app-icon name="clock" [size]="12" />{{ ticket.updatedAt | spDate }}</span>
                        <span class="sp-num">{{ ticket.messageCount || 0 }} 条消息</span>
                      </div>
                    </div>
                    <span class="go">查看详情 <app-icon name="chevron-right" [size]="14" /></span>
                  </a>
                </li>
              }
            </ul>

            @if (total() > size()) {
              <app-pagination [page]="page()" [size]="size()" [total]="total()"
                              (pageChange)="goPage($event)" (sizeChange)="changeSize($event)" />
            }
          }
        </div>
      }
    </div>

    <app-modal [open]="modalOpen()" title="新建工单" (closed)="closeCreate()">
      <form (submit)="$event.preventDefault(); submit()" novalidate>
        <div class="sp-field">
          <div class="label-row">
            <label class="sp-label" for="ticket-subject">工单主题<span class="sp-req">*</span></label>
            <span class="sp-text-12 sp-muted sp-num">{{ subject().length }}/60</span>
          </div>
          <input id="ticket-subject" class="sp-input" type="text" maxlength="60" autocomplete="off"
                 placeholder="一句话描述你的问题" [value]="subject()" (input)="onSubjectInput($event)"
                 [attr.aria-invalid]="subjectError() ? 'true' : null"
                 [attr.aria-describedby]="subjectError() ? 'subject-error' : 'subject-hint'" />
          @if (subjectError()) {
            <p class="sp-error" id="subject-error">{{ subjectError() }}</p>
          } @else {
            <p class="sp-hint" id="subject-hint">2–60 个字，例如「订单 1001 的发票抬头需要修改」。</p>
          }
        </div>

        <div class="sp-field">
          <div class="label-row">
            <label class="sp-label" for="ticket-body">问题描述<span class="sp-req">*</span></label>
            <span class="sp-text-12 sp-muted sp-num">{{ body().length }}/1000</span>
          </div>
          <textarea id="ticket-body" class="sp-textarea" maxlength="1000" rows="5"
                    placeholder="请描述订单号、遇到的情况和期望的处理方式…"
                    [value]="body()" (input)="onBodyInput($event)"
                    [attr.aria-invalid]="bodyError() ? 'true' : null"
                    [attr.aria-describedby]="bodyError() ? 'body-error' : 'body-hint'"></textarea>
          @if (bodyError()) {
            <p class="sp-error" id="body-error">{{ bodyError() }}</p>
          } @else {
            <p class="sp-hint" id="body-hint">10–1000 个字。演示环境请勿填写真实个人信息。</p>
          }
        </div>

        <div class="modal-actions">
          <button class="sp-btn sp-btn--secondary" type="button" (click)="closeCreate()" [disabled]="submitting()">取消</button>
          <button class="sp-btn sp-btn--primary" type="submit" [disabled]="submitting()" [attr.aria-busy]="submitting()">
            {{ submitting() ? '提交中…' : '提交工单' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: [`
    .tickets { max-width: 1000px; padding: 24px 24px 64px; }
    .head {
      display: flex; align-items: flex-end; justify-content: space-between;
      gap: 16px; flex-wrap: wrap; padding: 8px 0 20px;
    }
    .head-main { min-width: 0; }
    .head h1 { font-size: 32px; margin: 6px 0 8px; }
    .head-desc { font-size: 14px; max-width: 560px; }
    .service-meta {
      display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 10px;
      font-size: 12px; color: var(--sp-text-muted);
    }
    .service-meta li { display: inline-flex; align-items: center; gap: 5px; }
    .service-meta app-icon { color: var(--sp-text-muted); }

    .sp-tabbar { margin-top: 4px; }
    .sp-tabbar .count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; height: 18px; margin-left: 6px; padding: 0 5px;
      border-radius: var(--sp-radius-pill); background: var(--sp-bg);
      font-size: 11px; font-weight: 600; color: var(--sp-text-secondary); line-height: 1;
    }
    .sp-tabbar button[aria-selected='true'] .count { background: #FBF0DC; color: var(--sp-accent-text); }
    .panel { padding-top: 16px; }
    .loading-placeholder { min-height: 240px; }
    .panel:focus-visible { outline: 2px solid var(--sp-focus); outline-offset: 4px; border-radius: 8px; }

    .list-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; padding: 0 2px 12px;
    }
    .list-head strong { color: var(--sp-text); }

    .list { display: flex; flex-direction: column; gap: 12px; }
    .ticket {
      display: flex; align-items: center; gap: 16px;
      padding: 16px 20px;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    .ticket:hover { border-color: var(--sp-border-strong); box-shadow: var(--sp-shadow-md); color: inherit; }
    .ticket-main { min-width: 0; flex: 1 1 auto; }
    .ticket-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .ticket-top h2 { font-size: 16px; min-width: 0; }
    .last { margin-top: 6px; font-size: 14px; line-height: 1.7; color: var(--sp-text-secondary); }
    .ticket-meta {
      display: flex; align-items: center; flex-wrap: wrap; gap: 4px 16px;
      margin-top: 10px; font-size: 12px; color: var(--sp-text-muted);
    }
    .ticket-meta .who, .ticket-meta .when { display: inline-flex; align-items: center; gap: 4px; }
    .ticket .go {
      flex: 0 0 auto; display: inline-flex; align-items: center; gap: 2px;
      color: var(--sp-primary); font-size: 13px; font-weight: 600;
    }

    .login-empty { padding: 8px 24px 24px; }
    .alt { text-align: center; padding-bottom: 8px; font-size: 14px; color: var(--sp-text-secondary); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
    .label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }

    @media (max-width: 767px) {
      .tickets { padding: 16px 16px 48px; }
      .head { align-items: stretch; padding-bottom: 16px; }
      .head h1 { font-size: 26px; }
      .head-desc { font-size: 13px; }
      .new-btn { width: 100%; min-height: 44px; }
      .sp-tabbar { gap: 0; }
      .sp-tabbar button { padding: 12px 10px; }
      .ticket { padding: 14px 16px; gap: 8px; }
      .ticket .go { display: none; }
      .ticket-top h2 { font-size: 15px; }
      .ticket-meta { gap: 4px 12px; }
      .list-head { padding-bottom: 8px; }
    }
  `],
})
export class TicketsPage {
  private readonly api = inject(SupportApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly tabs = STATUS_TABS;
  readonly loggedIn = this.auth.isLoggedIn;

  readonly status = signal('');
  readonly page = signal(1);
  readonly size = signal(10);
  readonly total = signal(0);
  readonly counts = signal<Record<string, number>>({});
  readonly tickets = signal<Ticket[]>([]);
  readonly loading = signal(false);
  readonly showSkeleton = signal(false);
  readonly error = signal('');
  readonly requestId = signal<string | undefined>(undefined);

  readonly modalOpen = signal(false);
  readonly subject = signal('');
  readonly body = signal('');
  readonly subjectError = signal('');
  readonly bodyError = signal('');
  readonly submitting = signal(false);

  readonly statusLabel = computed(() => this.tabs.find((tab) => tab.value === this.status())?.label ?? '该状态');

  private skeletonTimer?: ReturnType<typeof setTimeout>;
  private seq = 0;

  constructor() {
    if (this.loggedIn()) {
      this.load();
    }
  }

  load(): void {
    if (!this.loggedIn()) {
      return;
    }
    const seq = ++this.seq;
    this.error.set('');
    this.requestId.set(undefined);
    this.beginLoading();

    this.api.tickets(this.status(), this.page(), this.size()).subscribe({
      next: (res) => {
        if (seq !== this.seq) {
          return;
        }
        this.tickets.set(res.items ?? []);
        this.total.set(res.total ?? 0);
        this.counts.set(res.counts ?? {});
        this.endLoading();
      },
      error: (err) => {
        if (seq !== this.seq) {
          return;
        }
        this.tickets.set([]);
        this.total.set(0);
        this.counts.set({});
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
        this.endLoading();
      },
    });
  }

  countOf(status: string): number {
    return status ? (this.counts()[status] ?? 0) : (this.counts()['all'] ?? 0);
  }

  select(value: string): void {
    if (this.status() === value) {
      return;
    }
    this.status.set(value);
    this.page.set(1);
    this.load();
  }

  goPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  changeSize(size: number): void {
    this.size.set(size);
    this.page.set(1);
    this.load();
  }

  onTabKeydown(event: KeyboardEvent, index: number): void {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowRight') {
      next = (index + 1) % this.tabs.length;
    } else if (event.key === 'ArrowLeft') {
      next = (index - 1 + this.tabs.length) % this.tabs.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else {
      next = this.tabs.length - 1;
    }
    this.select(this.tabs[next].value);
    document.getElementById('ticket-tab-' + (this.tabs[next].value || 'all'))?.focus();
  }

  goLogin(): void {
    this.router.navigate(['/login'], { queryParams: { next: '/support/tickets' } });
  }

  openCreate(): void {
    this.subject.set('');
    this.body.set('');
    this.subjectError.set('');
    this.bodyError.set('');
    this.submitting.set(false);
    this.modalOpen.set(true);
  }

  closeCreate(): void {
    if (this.submitting()) {
      return;
    }
    this.modalOpen.set(false);
  }

  onSubjectInput(event: Event): void {
    this.subject.set((event.target as HTMLInputElement).value);
    this.subjectError.set('');
  }

  onBodyInput(event: Event): void {
    this.body.set((event.target as HTMLTextAreaElement).value);
    this.bodyError.set('');
  }

  submit(): void {
    if (this.submitting()) {
      return;
    }
    const subject = this.subject().trim();
    const body = this.body().trim();
    let valid = true;

    if (subject.length < 2 || subject.length > 60) {
      this.subjectError.set('请填写 2–60 个字的工单主题');
      valid = false;
    } else {
      this.subjectError.set('');
    }

    if (body.length < 10 || body.length > 1000) {
      this.bodyError.set('请填写 10–1000 个字的问题描述');
      valid = false;
    } else {
      this.bodyError.set('');
    }

    if (!valid) {
      const target = this.subjectError() ? 'ticket-subject' : 'ticket-body';
      document.getElementById(target)?.focus();
      return;
    }

    this.submitting.set(true);
    this.api.create(subject, body).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.modalOpen.set(false);
        this.toast.show('工单已提交，客服会尽快回复');
        if (created?.id) {
          this.router.navigate(['/support/tickets', created.id]);
        } else {
          this.page.set(1);
          this.load();
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.show(errorMessage(err), 'error');
      },
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
