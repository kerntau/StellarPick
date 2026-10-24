import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { MerchantApi } from '../../core/api/merchant.api';
import { OrdersApi } from '../../core/api/orders.api';
import { MerchantOrder, Order, Paged, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { SpDatePipe } from '../../shared/pipes/date.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { MerchantIconComponent } from './components/merchant-icon.component';
import { dayKey, initials, relativeTime } from './ops-utils';
import { OPS_CSS } from './ops-ui';

interface StatusTab {
  value: string;
  label: string;
}

interface StepItem {
  label: string;
  hint: string;
  time: string | null;
  state: 'done' | 'active' | 'todo' | 'cancel';
}

const TABS: StatusTab[] = [
  { value: '', label: '全部' },
  { value: 'pending_payment', label: '待付款' },
  { value: 'pending_shipment', label: '待发货' },
  { value: 'shipped', label: '已发货' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

const STEP_INDEX: Record<string, number> = {
  pending_payment: 1,
  pending_shipment: 2,
  shipped: 3,
  completed: 4,
};

/** 商家订单管理：状态页签 + 搜索 + 紧凑表格 + 详情抽屉（状态步进 / 时间线 / 发货）。 */
@Component({
  selector: 'app-merchant-orders',
  standalone: true,
  imports: [
    MerchantIconComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ModalComponent,
    PaginationComponent,
    StatusBadgeComponent,
    MoneyPipe,
    SpDatePipe,
  ],
  template: `
    <section class="ops-page">
      <header class="ops-head">
        <div>
          <p class="ops-eyebrow">Orders · 履约</p>
          <h2>订单管理</h2>
          <p class="ops-sub">按状态查看本店订单，待发货订单可在详情中填写物流单号完成出库。</p>
          <div class="ops-meta">
            <span>共 <b class="sp-num">{{ orders().length }}</b> 笔</span>
            <span>待发货 <b class="sp-num">{{ countOf('pending_shipment') }}</b> 笔</span>
            <span>已发货 <b class="sp-num">{{ countOf('shipped') }}</b> 笔</span>
            <span>今日 <b class="sp-num">{{ todayCount() }}</b> 笔</span>
          </div>
        </div>
        <div class="ops-actions">
          <button
            class="sp-btn sp-btn--secondary sp-btn--sm"
            type="button"
            (click)="exportCsv()"
            [disabled]="filtered().length === 0"
          >
            <app-merchant-icon name="download" [size]="16" />
            导出当前列表
          </button>
          <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="load()" [disabled]="loading()">
            <app-merchant-icon name="refresh" [size]="16" />
            {{ loading() ? '刷新中…' : '刷新' }}
          </button>
        </div>
      </header>

      @if (error()) {
        <app-error-state [message]="error()" [requestId]="requestId()" (retry)="load()" />
      }

      <div class="ops-card">
        <div class="tabs" role="tablist" aria-label="订单状态">
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
            <app-merchant-icon name="search" [size]="16" />
            <input
              class="sp-input"
              type="search"
              autocomplete="off"
              placeholder="搜索订单号、买家或商品"
              aria-label="搜索订单号、买家或商品"
              [value]="q()"
              (input)="onQueryInput($event)"
            />
          </div>
          <div class="ops-toolbar-end">
            <span class="ops-count sp-num">{{ total() }} 笔</span>
            <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="resetFilters()" [disabled]="!hasFilters()">
              清空筛选
            </button>
          </div>
        </div>

        <div class="ops-chips">
          <span class="chips-label">筛选</span>
          @if (activeTab()) {
            <span class="ops-chip"><span>状态 <strong>{{ tabLabel(activeTab()) }}</strong></span>
              <button type="button" aria-label="清除状态筛选" (click)="setTab('')">
                <app-merchant-icon name="x" [size]="13" />
              </button>
            </span>
          }
          @if (q().trim()) {
            <span class="ops-chip"><span>关键词 <strong>{{ q().trim() }}</strong></span>
              <button type="button" aria-label="清除关键词筛选" (click)="clearQuery()">
                <app-merchant-icon name="x" [size]="13" />
              </button>
            </span>
          }
          @if (!hasFilters()) {
            <span class="chips-empty">显示全部订单，可按状态或关键词筛选</span>
          }
          <span class="chips-hint">待发货订单会同步出现在工作台待办中</span>
        </div>

        @if (showSkeleton()) {
          <div class="skeleton-rows" aria-hidden="true">
            @for (row of skeletonRows; track row) {
              <div class="sp-skeleton ops-skeleton-row"></div>
            }
          </div>
        } @else if (total() > 0) {
          <div class="ops-table-wrap">
            <table class="ops-table order-table">
              <caption>订单列表，共 {{ total() }} 笔</caption>
              <thead>
                <tr>
                  <th scope="col">订单</th>
                  <th scope="col">买家</th>
                  <th scope="col">商品</th>
                  <th scope="col" class="num">金额</th>
                  <th scope="col">状态</th>
                  <th scope="col">物流</th>
                  <th scope="col" class="actions">操作</th>
                </tr>
              </thead>
              <tbody>
                @for (order of pagedOrders(); track order.id) {
                  <tr>
                    <td>
                      <span class="order-id sp-num">#{{ order.id }}</span>
                      <span class="sub">{{ order.createdAt | spDate }}</span>
                    </td>
                    <td>
                      <div class="buyer">
                        <span class="ops-avatar" aria-hidden="true">{{ initials(order.buyerName) }}</span>
                        <span class="buyer-name">{{ order.buyerName || '匿名买家' }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="ops-cell-main">
                        <img
                          class="ops-thumb"
                          [src]="order.items[0]?.image || fallbackImage"
                          alt=""
                          width="36"
                          height="36"
                          loading="lazy"
                          decoding="async"
                          (error)="fallbackImageOnError($event)"
                        />
                        <span class="ops-cell-text">
                          <strong [title]="order.items[0]?.title || '商品'">{{ order.items[0]?.title || '—' }}</strong>
                          <small>共 {{ itemCount(order) }} 件</small>
                        </span>
                      </div>
                    </td>
                    <td class="num amount">{{ order.total | spMoney }}</td>
                    <td>
                      <div class="status-cell">
                        <app-status-badge [status]="order.status" />
                        <span class="ops-stepper--mini" aria-hidden="true">
                          @for (step of [0, 1, 2, 3]; track step) {
                            <span [class.done]="stepState(order.status, step) === 'done'" [class.active]="stepState(order.status, step) === 'active'" [class.cancel]="order.status === 'cancelled' && step === 0"></span>
                          }
                        </span>
                      </div>
                    </td>
                    <td class="tracking sp-num">
                      @if (order.trackingNo) {
                        {{ order.trackingNo }}
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td class="actions">
                      <div class="ops-row-actions">
                        @if (order.status === 'pending_shipment') {
                          <button class="sp-btn sp-btn--primary sp-btn--sm" type="button" (click)="openDetail(order)">
                            发货
                          </button>
                        }
                        <button class="sp-btn sp-btn--ghost sp-btn--sm" type="button" (click)="openDetail(order)">详情</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (!error()) {
          <app-empty-state
            image="orders"
            [title]="emptyTitle()"
            [description]="emptyHint()"
            [actionLabel]="hasFilters() ? '清空筛选' : '刷新列表'"
            (action)="hasFilters() ? resetFilters() : load()"
          />
        }
      </div>

      @if (total() > 0) {
        <p class="ops-scroll-hint">左右滑动可查看完整表格</p>
        <app-pagination
          [page]="page()"
          [size]="size()"
          [total]="total()"
          (pageChange)="changePage($event)"
          (sizeChange)="changeSize($event)"
        />
      }
    </section>

    <app-modal [open]="detail() !== null" title="订单详情" variant="right" (closed)="closeDetail()">
      @if (detail(); as order) {
        <div class="ops-drawer">
          <header class="ops-drawer-head">
            <div>
              <p class="ops-eyebrow">Order</p>
              <h3 class="sp-num">#{{ order.id }}</h3>
              <p class="sp-text-12 sp-muted">下单于 {{ order.createdAt | spDate }} · {{ relative(order.createdAt) }}</p>
            </div>
            <app-status-badge [status]="order.status" />
          </header>

          <section class="ops-section">
            <h4>履约进度</h4>
            <ol class="ops-stepper">
              @for (step of steps(); track step.label) {
                <li [class.done]="step.state === 'done'" [class.active]="step.state === 'active'">
                  <span class="dot" aria-hidden="true">
                    @if (step.state === 'done') {
                      <app-merchant-icon name="check" [size]="12" />
                    } @else {
                      {{ $index + 1 }}
                    }
                  </span>
                  <span class="label"><strong>{{ step.label }}</strong></span>
                  <span class="time">{{ step.time ? shortTime(step.time) : '时间未记录' }}</span>
                </li>
              }
            </ol>
          </section>

          <section class="ops-section">
            <h4>订单信息</h4>
            <dl class="ops-meta-grid">
              <div><dt>买家</dt><dd>{{ order.buyerName || '—' }}</dd></div>
              <div><dt>联系邮箱</dt><dd>{{ detailOrder()?.ownerEmail || '—' }}</dd></div>
              <div><dt>商品件数</dt><dd class="sp-num">{{ itemCount(order) }} 件</dd></div>
              <div><dt>物流单号</dt><dd class="sp-num">{{ order.trackingNo || (order.status === 'pending_shipment' ? '待填写' : '—') }}</dd></div>
            </dl>
          </section>

          <section class="ops-section" aria-labelledby="lines-title">
            <h4 id="lines-title">商品清单</h4>
            @if (order.items.length > 0) {
              <ul class="lines">
                @for (item of order.items; track $index) {
                  <li>
                    <img [src]="item.image || fallbackImage" alt="" width="44" height="44" loading="lazy" (error)="fallbackImageOnError($event)" />
                    <span class="line-text">
                      <strong>{{ item.title }}</strong>
                      <small class="sp-num">{{ item.unitPrice | spMoney }} × {{ item.quantity }}</small>
                    </span>
                    <span class="sp-num line-total">{{ item.unitPrice * item.quantity | spMoney }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="sp-muted sp-text-13">暂无商品明细。</p>
            }
          </section>

          <dl class="summary">
            <div><dt>商品合计</dt><dd class="sp-num">{{ itemsTotal(order) | spMoney }}</dd></div>
            <div><dt>配送方式</dt><dd>标准配送 · 包邮</dd></div>
            <div class="total"><dt>实付金额</dt><dd class="sp-num">{{ order.total | spMoney }}</dd></div>
          </dl>

          <section class="ops-section" aria-labelledby="receiver-title">
            <h4 id="receiver-title">收货信息</h4>
            @if (address(); as addr) {
              <div class="receiver">
                <p>
                  <strong>{{ addr.recipient || '—' }}</strong>
                  <span class="sp-num phone">{{ addr.phone || '—' }}</span>
                </p>
                <p class="sp-secondary">{{ addr.region }} {{ addr.detail }}</p>
              </div>
            } @else if (detailLoading()) {
              <p class="sp-muted sp-text-13">正在读取收货信息…</p>
            } @else {
              <p class="sp-muted sp-text-13">该订单未提供收货信息，请联系买家确认。</p>
            }
          </section>

          <section class="ops-section" aria-labelledby="timeline-title">
            <h4 id="timeline-title">时间线</h4>
            <ol class="ops-timeline">
              @for (step of steps(); track step.label) {
                <li [class.done]="step.state === 'done'" [class.active]="step.state === 'active'">
                  <p class="tl-title">
                    {{ step.label }}
                    @if (step.state === 'active') {
                      <span class="sp-badge sp-badge--warning">当前</span>
                    }
                  </p>
                  <p class="tl-meta">
                    {{ step.hint }} · {{ step.time ? (step.time | spDate) : '时间未记录' }}
                  </p>
                </li>
              }
            </ol>
          </section>

          @if (order.status === 'pending_shipment') {
            <form class="ship" (submit)="ship($event)">
              <div class="sp-field">
                <label class="sp-label" for="tracking-no">物流单号<span class="sp-req">*</span></label>
                <input
                  id="tracking-no"
                  class="sp-input sp-num"
                  type="text"
                  autocomplete="off"
                  [value]="trackingNo()"
                  (input)="onTrackingInput($event)"
                  [attr.aria-invalid]="trackingError() ? 'true' : null"
                  aria-describedby="tracking-error"
                  placeholder="例如 SF1234567890"
                />
                @if (trackingError()) {
                  <p class="sp-error" id="tracking-error">{{ trackingError() }}</p>
                }
              </div>

              @if (shipError()) {
                <p class="sp-alert sp-alert--error" role="alert">{{ shipError() }}</p>
              }

              <button class="sp-btn sp-btn--primary sp-btn--block" type="submit" [disabled]="shipping()">
                {{ shipping() ? '发货中…' : '确认发货' }}
              </button>
              <p class="sp-hint">发货后订单状态变为「已发货」，买家可在订单详情看到物流单号。</p>
            </form>
          } @else if (order.trackingNo) {
            <div class="sp-alert sp-alert--info tracking">
              <span>物流单号：<strong class="sp-num">{{ order.trackingNo }}</strong></span>
              <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="copyTracking(order.trackingNo)">
                复制
              </button>
            </div>
          }

          <button class="sp-btn sp-btn--secondary sp-btn--block" type="button" (click)="closeDetail()">关闭</button>
        </div>
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
    .skeleton-rows { padding: 6px 0; }

    .order-table { min-width: 920px; }
    .order-id { display: block; font-weight: 600; white-space: nowrap; }
    .buyer { display: flex; align-items: center; gap: 8px; }
    .buyer-name { white-space: nowrap; max-width: 110px; overflow: hidden; text-overflow: ellipsis; }
    .amount { color: var(--sp-accent-text); font-weight: 600; }
    .status-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
    .tracking { white-space: nowrap; font-size: 12px; color: var(--sp-text-secondary); }
    .muted { color: var(--sp-text-muted); }

    .lines { display: flex; flex-direction: column; }
    .lines li { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--sp-border); }
    .lines li:last-child { border-bottom: 0; }
    .lines img { width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid var(--sp-border); flex: none; background: var(--sp-bg); }
    .line-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .line-text strong { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .line-text small { font-size: 11px; color: var(--sp-text-muted); }
    .line-total { font-weight: 600; white-space: nowrap; }

    .summary { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 12px 0; border-top: 1px solid var(--sp-border); border-bottom: 1px solid var(--sp-border); }
    .summary div { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; }
    .summary dt { color: var(--sp-text-secondary); }
    .summary dd { margin: 0; }
    .summary .total { font-size: 14px; font-weight: 700; padding-top: 4px; }
    .summary .total dd { color: var(--sp-accent-text); font-size: 20px; }

    .receiver { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
    .receiver .phone { margin-left: 8px; color: var(--sp-text-secondary); }

    .ship { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
    .ship .sp-field { margin-bottom: 0; }
    .tracking { align-items: center; justify-content: space-between; }
  `],
})
export class MerchantOrdersPage implements OnDestroy {
  private readonly api = inject(MerchantApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly fallbackImage = '/assets/sp/img/products/1001.svg';
  readonly tabs = TABS;
  readonly orders = signal<MerchantOrder[]>([]);
  readonly activeTab = signal('');
  readonly q = signal('');
  readonly page = signal(1);
  readonly size = signal(10);
  readonly loading = signal(false);
  readonly showSkeleton = signal(false);
  readonly error = signal('');
  readonly requestId = signal<string | undefined>(undefined);
  readonly detail = signal<MerchantOrder | null>(null);
  readonly detailLoading = signal(false);
  readonly detailOrder = signal<Order | null>(null);
  readonly trackingNo = signal('');
  readonly trackingError = signal('');
  readonly shipError = signal('');
  readonly shipping = signal(false);
  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  readonly filtered = computed(() => {
    const tab = this.activeTab();
    const query = this.q().trim().toLowerCase();
    return this.orders().filter((order) => {
      if (tab && order.status !== tab) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        String(order.id).includes(query) ||
        order.buyerName.toLowerCase().includes(query) ||
        order.items.some((item) => item.title.toLowerCase().includes(query))
      );
    });
  });

  readonly total = computed(() => this.filtered().length);
  readonly pagedOrders = computed(() => {
    const start = (this.page() - 1) * this.size();
    return this.filtered().slice(start, start + this.size());
  });
  readonly hasFilters = computed(() => !!this.activeTab() || !!this.q().trim());
  readonly address = computed(() => this.detailOrder()?.address ?? null);
  readonly todayCount = computed(() => {
    const key = dayKey(new Date());
    return this.orders().filter((order) => dayKey(new Date(order.createdAt)) === key).length;
  });

  readonly steps = computed<StepItem[]>(() => {
    const order = this.detail();
    if (!order) {
      return [];
    }
    const full = this.detailOrder();
    if (order.status === 'cancelled') {
      return [
        { label: '提交订单', hint: '买家创建订单', time: order.createdAt, state: 'done' },
        { label: '订单取消', hint: '买家或平台取消了订单', time: full?.completedAt ?? null, state: 'cancel' },
      ];
    }
    const index = STEP_INDEX[order.status] ?? 0;
    const defs = [
      { label: '提交订单', hint: '买家创建订单', time: order.createdAt },
      { label: '完成支付', hint: '支付成功，等待商家发货', time: full?.paidAt ?? null },
      {
        label: '商家发货',
        hint: order.trackingNo ? '物流单号 ' + order.trackingNo : '待填写物流单号',
        time: full?.shippedAt ?? null,
      },
      { label: '交易完成', hint: '买家确认收货', time: full?.completedAt ?? null },
    ];
    return defs.map((step, i) => ({
      ...step,
      state: i < index ? 'done' : i === index ? 'active' : 'todo',
    }));
  });

  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private detailSeq = 0;

  constructor() {
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status) {
      this.activeTab.set(status);
    }
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

    forkJoin({
      orders: this.api.orders(),
      directory: this.ordersApi
        .list()
        .pipe(catchError(() => of<Paged<Order>>({ items: [], total: 0, page: 1, size: 0 }))),
    }).subscribe({
      next: (result) => {
        if (seq !== this.seq) {
          return;
        }
        const buyers = new Map<number, string>();
        for (const full of result.directory.items ?? []) {
          const name = String(full.ownerName ?? '').trim() || String(full.ownerEmail ?? '').split('@')[0];
          if (name) {
            buyers.set(full.id, name);
          }
        }
        this.orders.set(
          (result.orders ?? []).map((order) => ({
            ...order,
            buyerName: (order.buyerName || '').trim() || buyers.get(order.id) || '匿名买家',
          })),
        );
        this.clampPage();
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

  countOf(status: string): number {
    if (!status) {
      return this.orders().length;
    }
    return this.orders().filter((order) => order.status === status).length;
  }

  tabLabel(value: string): string {
    return this.tabs.find((tab) => tab.value === value)?.label ?? value;
  }

  setTab(tab: string): void {
    if (this.activeTab() === tab) {
      return;
    }
    this.activeTab.set(tab);
    this.page.set(1);
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
    this.page.set(1);
  }

  clearQuery(): void {
    this.q.set('');
    this.page.set(1);
  }

  resetFilters(): void {
    this.activeTab.set('');
    this.q.set('');
    this.page.set(1);
  }

  itemCount(order: MerchantOrder): number {
    return order.items.reduce((total, item) => total + item.quantity, 0);
  }

  itemsTotal(order: MerchantOrder): number {
    return order.items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  }

  initials(name: string): string {
    return initials(name);
  }

  relative(value: string): string {
    return relativeTime(value);
  }

  /** 步进器列宽有限，用 MM-DD HH:mm 避免时间折行。 */
  shortTime(value: string | null): string {
    if (!value) {
      return '时间未记录';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '时间未记录';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  stepState(status: string, step: number): string {
    if (status === 'cancelled') {
      return step === 0 ? 'done' : '';
    }
    const index = STEP_INDEX[status] ?? 0;
    if (step < index) {
      return 'done';
    }
    return step === index ? 'active' : '';
  }

  fallbackImageOnError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.dataset['fallback'] === '1') {
      return;
    }
    img.dataset['fallback'] = '1';
    img.src = this.fallbackImage;
  }

  openDetail(order: MerchantOrder): void {
    this.detail.set(order);
    this.detailOrder.set(null);
    this.detailLoading.set(true);
    this.trackingNo.set('');
    this.trackingError.set('');
    this.shipError.set('');
    this.shipping.set(false);

    const seq = ++this.detailSeq;
    this.ordersApi.get(order.id).subscribe({
      next: (full) => {
        if (seq !== this.detailSeq) {
          return;
        }
        this.detailOrder.set(full);
        this.detailLoading.set(false);
      },
      error: () => {
        if (seq !== this.detailSeq) {
          return;
        }
        this.detailLoading.set(false);
      },
    });
  }

  closeDetail(): void {
    if (this.shipping()) {
      return;
    }
    this.detailSeq += 1;
    this.detail.set(null);
    this.detailOrder.set(null);
    this.detailLoading.set(false);
  }

  onTrackingInput(event: Event): void {
    this.trackingNo.set((event.target as HTMLInputElement).value);
    if (this.trackingError()) {
      this.trackingError.set('');
    }
  }

  ship(event: Event): void {
    event.preventDefault();
    const order = this.detail();
    if (!order || this.shipping()) {
      return;
    }
    const trackingNo = this.trackingNo().trim();
    if (!trackingNo) {
      this.trackingError.set('请填写物流单号后再发货。');
      return;
    }
    this.shipping.set(true);
    this.shipError.set('');
    this.api.ship(order.id, trackingNo).subscribe({
      next: () => {
        this.shipping.set(false);
        this.detail.set(null);
        this.detailOrder.set(null);
        this.toast.show('订单 #' + order.id + ' 已发货', 'success');
        this.load();
      },
      error: (err: unknown) => {
        this.shipping.set(false);
        this.shipError.set(errorMessage(err));
      },
    });
  }

  copyTracking(trackingNo: string | undefined): void {
    if (!trackingNo) {
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(trackingNo)
        .then(() => this.toast.show('物流单号已复制', 'success'))
        .catch(() => this.toast.show('复制失败，请手动选择单号', 'error'));
      return;
    }
    this.toast.show('当前浏览器不支持自动复制', 'info');
  }

  exportCsv(): void {
    const rows = this.filtered();
    if (rows.length === 0) {
      return;
    }
    const header = ['订单号', '买家', '商品件数', '金额', '状态', '下单时间', '物流单号'];
    const lines = rows.map((order) => [
      order.id,
      order.buyerName,
      this.itemCount(order),
      order.total,
      order.statusText || order.status,
      order.createdAt,
      order.trackingNo || '',
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(','))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'merchant-orders-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.toast.show('已导出 ' + rows.length + ' 笔订单', 'success');
  }

  changePage(page: number): void {
    this.page.set(page);
  }

  changeSize(size: number): void {
    this.size.set(size);
    this.page.set(1);
  }

  emptyTitle(): string {
    if (this.q().trim()) {
      return '没有匹配的订单';
    }
    const tab = this.tabs.find((item) => item.value === this.activeTab());
    return tab && tab.value ? '没有' + tab.label + '订单' : '还没有订单';
  }

  emptyHint(): string {
    if (this.hasFilters()) {
      return '换个关键词，或切换到其他状态页签看看。';
    }
    return '订单产生后会出现在这里；买家下单后记得及时发货。';
  }

  private clampPage(): void {
    const maxPage = Math.max(1, Math.ceil(this.filtered().length / this.size()));
    if (this.page() > maxPage) {
      this.page.set(maxPage);
    }
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
