import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { AdminApi } from '../../core/api/admin.api';
import { Merchant, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SpDatePipe } from '../../shared/pipes/date.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { AdminIconComponent } from './components/admin-icon.component';
import { OPS_CSS } from './ops-ui';
import { daysSince } from './ops-utils';

type Tab = 'all' | 'pending' | 'approved' | 'rejected';

interface TabItem {
  value: Tab;
  label: string;
}

interface CheckItem {
  label: string;
  ok: boolean;
}

const REJECT_PRESETS = [
  '营业执照信息与店铺名称不一致，请补充一致的主体材料。',
  '经营类目不在平台招商范围内，请调整后重新提交。',
  '联系电话无法核实，请补充可接通的负责人联系方式。',
];

/** 商家审核：状态页签 + 搜索 + 资质卡（完整度）+ 通过 / 驳回（原因）。 */
@Component({
  selector: 'app-admin-merchants',
  standalone: true,
  imports: [
    AdminIconComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ModalComponent,
    SpDatePipe,
  ],
  template: `
    <section class="ops-page">
      <header class="ops-head">
        <div>
          <p class="ops-eyebrow">Merchants · 入驻审核</p>
          <h2>商家审核</h2>
          <p class="ops-sub">核对入驻资质后通过或驳回申请，处理结果即时同步到商家中心。</p>
          <div class="ops-meta">
            <span>共 <b class="sp-num">{{ merchants().length }}</b> 家</span>
            <span>待审核 <b class="sp-num">{{ countOf('pending') }}</b></span>
            <span>已通过 <b class="sp-num">{{ countOf('approved') }}</b></span>
            <span>已驳回 <b class="sp-num">{{ countOf('rejected') }}</b></span>
          </div>
        </div>
        <div class="ops-actions">
          <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="load()" [disabled]="loading()">
            <app-admin-icon name="refresh" [size]="16" />
            {{ loading() ? '刷新中…' : '刷新列表' }}
          </button>
        </div>
      </header>

      @if (error()) {
        <app-error-state [message]="error()" [requestId]="requestId()" (retry)="load()" />
      }

      <div class="ops-card">
        <div class="tabs" role="tablist" aria-label="商家审核状态">
          @for (tab of tabs; track tab.value) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === tab.value"
              [attr.tabindex]="activeTab() === tab.value ? 0 : -1"
              (click)="setTab(tab.value)"
              (keydown)="onTabKey($event)"
            >
              {{ tab.label }}
              <span class="tab-count sp-num">{{ countOf(tab.value) }}</span>
            </button>
          }
        </div>

        <div class="ops-toolbar">
          <div class="ops-search">
            <app-admin-icon name="search" [size]="16" />
            <input
              class="sp-input"
              type="search"
              autocomplete="off"
              placeholder="搜索店铺、联系人或营业执照号"
              aria-label="搜索店铺、联系人或营业执照号"
              [value]="q()"
              (input)="onQueryInput($event)"
            />
          </div>
          <select class="sp-select" aria-label="排序方式" (change)="onSort($event)">
            <option value="newest" [selected]="sort() === 'newest'">最新申请</option>
            <option value="oldest" [selected]="sort() === 'oldest'">等待最久</option>
            <option value="name" [selected]="sort() === 'name'">店铺名称</option>
          </select>
          <div class="ops-toolbar-end">
            <span class="ops-count sp-num">{{ filtered().length }} 家</span>
            <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="resetFilters()" [disabled]="!hasFilters()">
              清空筛选
            </button>
          </div>
        </div>

        <div class="ops-chips">
          <span class="chips-label">筛选</span>
          @if (activeTab() !== 'all') {
            <span class="ops-chip"><span>状态 <strong>{{ tabLabel(activeTab()) }}</strong></span>
              <button type="button" aria-label="清除状态筛选" (click)="setTab('all')">
                <app-admin-icon name="x" [size]="13" />
              </button>
            </span>
          }
          @if (q().trim()) {
            <span class="ops-chip"><span>关键词 <strong>{{ q().trim() }}</strong></span>
              <button type="button" aria-label="清除关键词筛选" (click)="clearQuery()">
                <app-admin-icon name="x" [size]="13" />
              </button>
            </span>
          }
          @if (!hasFilters()) {
            <span class="chips-empty">显示全部入驻申请</span>
          }
          <span class="chips-hint">资质完整度按执照、联系人、电话、类目四项计算</span>
        </div>

        @if (showSkeleton()) {
          <div class="merchant-grid">
            @for (row of skeletonRows; track row) {
              <div class="sp-skeleton card-sk"></div>
            }
          </div>
        } @else if (filtered().length > 0) {
          <div class="merchant-grid">
            @for (merchant of filtered(); track merchant.id) {
              <article class="merchant-card">
                <header class="card-head">
                  <div class="name-block">
                    <h3>{{ merchant.name }}</h3>
                    <p class="sp-text-12 sp-muted">
                      申请编号 #{{ merchant.id }} · {{ merchant.category || '未填类目' }} · 等待
                      <span class="sp-num">{{ waitingDays(merchant.appliedAt) }}</span> 天
                    </p>
                  </div>
                  <span [class]="'sp-badge status-pill status-pill--' + merchant.status">{{ statusLabel(merchant.status) }}</span>
                </header>

                <div class="score">
                  <div class="score-head">
                    <span>资质完整度</span>
                    <strong class="sp-num">{{ score(merchant) }}/4</strong>
                  </div>
                  <div class="score-bar" role="img" [attr.aria-label]="'资质完整度 ' + score(merchant) + ' / 4'">
                    <span [style.width.%]="(score(merchant) / 4) * 100"></span>
                  </div>
                  <ul class="checks">
                    @for (check of checks(merchant); track check.label) {
                      <li [class.ok]="check.ok">
                        <app-admin-icon [name]="check.ok ? 'check-circle' : 'alert-circle'" [size]="13" />
                        {{ check.label }}
                      </li>
                    }
                  </ul>
                </div>

                <dl class="qual">
                  <div><dt>联系人</dt><dd>{{ merchant.contact || '—' }}</dd></div>
                  <div><dt>联系电话</dt><dd class="sp-num">{{ merchant.phone || '—' }}</dd></div>
                  <div class="wide"><dt>营业执照号</dt><dd class="sp-num license">{{ merchant.license || '演示资质待补充' }}</dd></div>
                  <div><dt>经营类目</dt><dd>{{ merchant.category || '—' }}</dd></div>
                  <div><dt>申请时间</dt><dd class="sp-num">{{ merchant.appliedAt | spDate }}</dd></div>
                  <div><dt>负责人账号</dt><dd>{{ merchant.ownerName || '—' }}</dd></div>
                  <div><dt>登录邮箱</dt><dd class="email">{{ merchant.ownerEmail || '—' }}</dd></div>
                </dl>

                @if (merchant.reason) {
                  <p class="sp-alert sp-alert--error reason" role="note">
                    <app-admin-icon name="alert-circle" [size]="16" />
                    <span>驳回原因：{{ merchant.reason }}</span>
                  </p>
                }

                <footer class="card-actions">
                  @if (merchant.status === 'pending') {
                    <button
                      class="sp-btn sp-btn--primary sp-btn--sm"
                      type="button"
                      [disabled]="approvingId() !== null"
                      (click)="openApprove(merchant)"
                    >
                      <app-admin-icon name="check" [size]="16" />
                      {{ approvingId() === merchant.id ? '处理中…' : '通过' }}
                    </button>
                    <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="openReject(merchant)">
                      <app-admin-icon name="x" [size]="16" />
                      驳回
                    </button>
                  } @else if (merchant.status === 'approved') {
                    <span class="state-note sp-text-13">
                      <app-admin-icon name="check-circle" [size]="16" />
                      已通过审核，店铺可正常经营
                    </span>
                  } @else {
                    <span class="state-note sp-text-13">
                      <app-admin-icon name="x-circle" [size]="16" />
                      已驳回，等待商家补充材料
                    </span>
                  }
                </footer>
              </article>
            }
          </div>
        } @else if (!error()) {
          <app-empty-state
            image="orders"
            [title]="emptyTitle()"
            description="新的入驻申请或审核结果会出现在对应状态页签中。"
            actionLabel="刷新列表"
            (action)="load()"
          />
        }
      </div>
    </section>

    <app-modal [open]="approveTarget() !== null" title="通过入驻申请" (closed)="closeApprove()">
      @if (approveTarget(); as merchant) {
        <div class="confirm">
          <p class="sp-secondary">
            确认通过「<strong>{{ merchant.name }}</strong>」的入驻申请？通过后该店铺可进入商家中心并上架商品。
          </p>
          <dl class="confirm-meta">
            <div><dt>联系人</dt><dd>{{ merchant.contact || '—' }}</dd></div>
            <div><dt>营业执照号</dt><dd class="sp-num">{{ merchant.license || '—' }}</dd></div>
            <div><dt>经营类目</dt><dd>{{ merchant.category || '—' }}</dd></div>
            <div><dt>申请时间</dt><dd class="sp-num">{{ merchant.appliedAt | spDate }}</dd></div>
          </dl>

          @if (approveError()) {
            <p class="sp-alert sp-alert--error" role="alert">{{ approveError() }}</p>
          }

          <div class="modal-actions">
            <button class="sp-btn sp-btn--secondary" type="button" (click)="closeApprove()">取消</button>
            <button class="sp-btn sp-btn--primary" type="button" [disabled]="approvingId() !== null" (click)="approve(merchant)">
              {{ approvingId() === merchant.id ? '处理中…' : '确认通过' }}
            </button>
          </div>
        </div>
      }
    </app-modal>

    <app-modal [open]="rejectTarget() !== null" title="驳回入驻申请" (closed)="closeReject()">
      @if (rejectTarget(); as merchant) {
        <form class="reject" (submit)="submitReject($event)">
          <p class="sp-secondary">
            将驳回「{{ merchant.name }}」的入驻申请。驳回原因会展示给申请人，请填写清楚、可执行。
          </p>

          <div class="presets" role="group" aria-label="常用驳回原因">
            @for (preset of presets; track preset) {
              <button class="preset" type="button" (click)="usePreset(preset)">{{ preset }}</button>
            }
          </div>

          <div class="sp-field">
            <label class="sp-label" for="reject-reason">驳回原因<span class="sp-req">*</span></label>
            <textarea
              id="reject-reason"
              class="sp-textarea"
              rows="4"
              [value]="rejectReason()"
              (input)="onReasonInput($event)"
              [attr.aria-invalid]="rejectError() ? 'true' : null"
              aria-describedby="reject-error reject-hint"
              placeholder="例如：营业执照信息与店铺名称不一致，请补充一致的主体材料后重新提交。"
            ></textarea>
            @if (rejectError()) {
              <p class="sp-error" id="reject-error">{{ rejectError() }}</p>
            }
            <p class="sp-hint" id="reject-hint">至少 4 个字，便于申请人理解下一步。</p>
          </div>

          <div class="modal-actions">
            <button class="sp-btn sp-btn--secondary" type="button" (click)="closeReject()">取消</button>
            <button class="sp-btn sp-btn--danger" type="submit" [disabled]="rejecting()">
              {{ rejecting() ? '提交中…' : '确认驳回' }}
            </button>
          </div>
        </form>
      }
    </app-modal>
  `,
  styles: [OPS_CSS, `
    .tabs { display: flex; gap: 2px; padding: 0 8px; border-bottom: 1px solid var(--sp-border); overflow-x: auto; }
    .tabs button {
      display: inline-flex; align-items: center; gap: 6px; min-height: 46px; padding: 0 12px;
      border: 0; border-bottom: 2px solid transparent; background: transparent;
      font-size: 13px; color: var(--sp-text-secondary); white-space: nowrap;
    }
    .tabs button:hover { color: var(--sp-primary); }
    .tabs button[aria-selected='true'] { color: var(--sp-primary); font-weight: 700; border-bottom-color: var(--sp-accent); }
    .tab-count { display: inline-flex; min-width: 20px; justify-content: center; padding: 0 6px; border-radius: 999px; background: var(--sp-bg); color: var(--sp-text-secondary); font-size: 11px; font-weight: 700; }
    .tabs button[aria-selected='true'] .tab-count { background: #FBF0DC; color: var(--sp-accent-text); }
    .chips-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; color: var(--sp-text-muted); }
    .chips-empty { font-size: 12px; color: var(--sp-text-muted); }
    .chips-hint { margin-left: auto; font-size: 11px; color: var(--sp-text-muted); }

    .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; background: var(--sp-bg); color: var(--sp-text-secondary); flex: none; }
    .status-pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .status-pill--pending { background: var(--sp-warning-soft); color: var(--sp-warning); }
    .status-pill--approved { background: var(--sp-success-soft); color: var(--sp-success); }
    .status-pill--rejected { background: var(--sp-danger-soft); color: var(--sp-danger); }
    .merchant-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 14px; }
    .card-sk { height: 340px; border-radius: 8px; }
    .merchant-card { display: flex; flex-direction: column; border: 1px solid var(--sp-border); border-radius: 10px; background: var(--sp-surface); overflow: hidden; }
    .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 16px 10px; }
    .name-block { min-width: 0; }
    .name-block h3 { font-size: 16px; letter-spacing: -0.01em; }
    .name-block p { margin-top: 2px; }

    .score { padding: 0 16px 12px; display: flex; flex-direction: column; gap: 6px; }
    .score-head { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--sp-text-muted); }
    .score-head strong { color: var(--sp-text); font-size: 12px; }
    .score-bar { height: 6px; border-radius: 999px; background: var(--sp-bg); overflow: hidden; }
    .score-bar span { display: block; height: 100%; border-radius: 999px; background: var(--sp-sage); }
    .checks { display: flex; flex-wrap: wrap; gap: 4px 12px; }
    .checks li { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--sp-text-muted); }
    .checks li.ok { color: var(--sp-success); }
    .checks li app-admin-icon { color: var(--sp-warning); }
    .checks li.ok app-admin-icon { color: var(--sp-success); }

    .qual { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; padding: 12px 16px; margin: 0; border-top: 1px solid var(--sp-border); background: #FDFCFA; }
    .qual .wide { grid-column: 1 / -1; }
    .qual div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .qual dt { font-size: 11px; color: var(--sp-text-muted); }
    .qual dd { margin: 0; font-size: 13px; color: var(--sp-text); word-break: break-all; }
    .qual .email { color: var(--sp-text-secondary); }
    .license { letter-spacing: .02em; }

    .reason { margin: 12px 16px 0; font-size: 13px; align-items: flex-start; }
    .card-actions { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--sp-border); margin-top: auto; }
    .state-note { display: inline-flex; align-items: center; gap: 6px; color: var(--sp-text-secondary); }
    .state-note app-admin-icon { color: var(--sp-success); }

    .confirm { display: flex; flex-direction: column; gap: 12px; }
    .confirm-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin: 0; padding: 12px 14px; border-radius: 8px; background: var(--sp-bg); }
    .confirm-meta div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .confirm-meta dt { font-size: 11px; color: var(--sp-text-muted); }
    .confirm-meta dd { margin: 0; font-size: 13px; }

    .reject { display: flex; flex-direction: column; gap: 8px; }
    .presets { display: flex; flex-wrap: wrap; gap: 6px; }
    .preset { border: 1px solid var(--sp-border-strong); background: var(--sp-surface); border-radius: 999px; padding: 6px 10px; min-height: 34px; font-size: 12px; color: var(--sp-text-secondary); text-align: left; }
    .preset:hover { border-color: var(--sp-primary); color: var(--sp-primary); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

    @media (max-width: 1100px) {
      .merchant-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 767px) {
      .merchant-grid { padding: 10px; gap: 10px; }
      .qual { grid-template-columns: 1fr; }
      .qual .wide { grid-column: auto; }
      .card-head { padding: 12px 14px 8px; }
      .score, .qual { padding-left: 14px; padding-right: 14px; }
      .reason { margin-left: 14px; margin-right: 14px; }
      .card-actions { padding: 10px 14px 12px; }
      .chips-hint { display: none; }
    }
  `],
})
export class AdminMerchantsPage implements OnDestroy {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  readonly tabs: TabItem[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待审核' },
    { value: 'approved', label: '已通过' },
    { value: 'rejected', label: '已驳回' },
  ];
  readonly activeTab = signal<Tab>('pending');
  readonly q = signal('');
  readonly sort = signal<'newest' | 'oldest' | 'name'>('newest');
  readonly merchants = signal<Merchant[]>([]);
  readonly loading = signal(false);
  readonly showSkeleton = signal(false);
  readonly error = signal('');
  readonly requestId = signal<string | undefined>(undefined);
  readonly approvingId = signal<number | null>(null);
  readonly approveTarget = signal<Merchant | null>(null);
  readonly approveError = signal('');
  readonly rejectTarget = signal<Merchant | null>(null);
  readonly rejectReason = signal('');
  readonly rejectError = signal('');
  readonly rejecting = signal(false);
  readonly skeletonRows = [1, 2, 3, 4];
  readonly presets = REJECT_PRESETS;

  readonly filtered = computed(() => {
    const tab = this.activeTab();
    const query = this.q().trim().toLowerCase();
    const rows = this.merchants().filter((merchant) => {
      const inTab = tab === 'all' || merchant.status === tab;
      if (!inTab) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [merchant.name, merchant.contact, merchant.license, merchant.ownerEmail, merchant.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
    const mode = this.sort();
    return rows.sort((a, b) => {
      if (mode === 'name') {
        return a.name.localeCompare(b.name, 'zh-CN');
      }
      const diff = new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      return mode === 'oldest' ? -diff : diff;
    });
  });

  readonly hasFilters = computed(() => this.activeTab() !== 'all' || !!this.q().trim());

  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor() {
    this.load();
  }

  load(): void {
    const seq = ++this.seq;
    this.error.set('');
    this.requestId.set(undefined);
    this.loading.set(true);
    this.clearTimer();
    this.timer = setTimeout(() => {
      if (seq === this.seq) {
        this.showSkeleton.set(true);
      }
    }, 300);

    this.api.merchants().subscribe({
      next: (items) => {
        if (seq !== this.seq) {
          return;
        }
        this.merchants.set(items ?? []);
        this.finish();
      },
      error: (err: unknown) => {
        if (seq !== this.seq) {
          return;
        }
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
        this.finish();
      },
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  countOf(tab: Tab): number {
    return tab === 'all' ? this.merchants().length : this.merchants().filter((merchant) => merchant.status === tab).length;
  }

  tabLabel(value: Tab): string {
    return this.tabs.find((tab) => tab.value === value)?.label ?? value;
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  onTabKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const index = this.tabs.findIndex((tab) => tab.value === this.activeTab());
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = this.tabs[(index + delta + this.tabs.length) % this.tabs.length];
    this.setTab(next.value);
    const target = event.target as HTMLElement | null;
    target?.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[this.tabs.indexOf(next)]?.focus();
  }

  onQueryInput(event: Event): void {
    this.q.set((event.target as HTMLInputElement).value);
  }

  onSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as 'newest' | 'oldest' | 'name');
  }

  clearQuery(): void {
    this.q.set('');
  }

  resetFilters(): void {
    this.activeTab.set('all');
    this.q.set('');
  }

  waitingDays(value: string): number {
    return daysSince(value);
  }

  statusLabel(status: string): string {
    if (status === 'approved') {
      return '已通过';
    }
    if (status === 'rejected') {
      return '已驳回';
    }
    return '待审核';
  }

  checks(merchant: Merchant): CheckItem[] {
    return [
      { label: '营业执照', ok: !!String(merchant.license ?? '').trim() },
      { label: '联系人', ok: !!String(merchant.contact ?? '').trim() },
      { label: '联系电话', ok: !!String(merchant.phone ?? '').trim() },
      { label: '经营类目', ok: !!String(merchant.category ?? '').trim() },
    ];
  }

  score(merchant: Merchant): number {
    return this.checks(merchant).filter((check) => check.ok).length;
  }

  emptyTitle(): string {
    if (this.q().trim()) {
      return '没有匹配的入驻申请';
    }
    if (this.activeTab() === 'pending') {
      return '没有待审核的商家';
    }
    if (this.activeTab() === 'approved') {
      return '还没有已通过的商家';
    }
    if (this.activeTab() === 'rejected') {
      return '还没有被驳回的商家';
    }
    return '还没有商家入驻申请';
  }

  openApprove(merchant: Merchant): void {
    this.approveTarget.set(merchant);
    this.approveError.set('');
  }

  closeApprove(): void {
    if (this.approvingId() !== null) {
      return;
    }
    this.approveTarget.set(null);
    this.approveError.set('');
  }

  approve(merchant: Merchant): void {
    if (this.approvingId() !== null) {
      return;
    }
    this.approvingId.set(merchant.id);
    this.approveError.set('');
    this.api.approveMerchant(merchant.id).subscribe({
      next: () => {
        this.approvingId.set(null);
        this.approveTarget.set(null);
        this.toast.show('已通过「' + merchant.name + '」的入驻申请', 'success');
        this.load();
      },
      error: (err: unknown) => {
        this.approvingId.set(null);
        this.approveError.set(errorMessage(err));
      },
    });
  }

  openReject(merchant: Merchant): void {
    this.rejectTarget.set(merchant);
    this.rejectReason.set('');
    this.rejectError.set('');
    this.rejecting.set(false);
  }

  closeReject(): void {
    if (this.rejecting()) {
      return;
    }
    this.rejectTarget.set(null);
    this.rejectError.set('');
  }

  usePreset(reason: string): void {
    this.rejectReason.set(reason);
    this.rejectError.set('');
  }

  onReasonInput(event: Event): void {
    this.rejectReason.set((event.target as HTMLTextAreaElement).value);
    if (this.rejectError()) {
      this.rejectError.set('');
    }
  }

  submitReject(event: Event): void {
    event.preventDefault();
    const target = this.rejectTarget();
    if (!target || this.rejecting()) {
      return;
    }
    const reason = this.rejectReason().trim();
    if (reason.length < 4) {
      this.rejectError.set('请填写至少 4 个字的驳回原因。');
      return;
    }
    this.rejecting.set(true);
    this.api.rejectMerchant(target.id, reason).subscribe({
      next: () => {
        this.rejecting.set(false);
        this.toast.show('已驳回「' + target.name + '」的入驻申请', 'success');
        this.closeReject();
        this.load();
      },
      error: (err: unknown) => {
        this.rejecting.set(false);
        this.rejectError.set(errorMessage(err));
      },
    });
  }

  private finish(): void {
    this.loading.set(false);
    this.showSkeleton.set(false);
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
