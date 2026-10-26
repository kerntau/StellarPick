import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { OrdersApi } from '../../core/api/orders.api';
import { CartService } from '../../core/cart.service';
import { Order, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SpDatePipe } from '../../shared/pipes/date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ConfirmDialogComponent } from './components/confirm-dialog.component';

interface OrderTab {
  key: string;
  label: string;
}

interface OrderStep {
  key: string;
  label: string;
}

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [
    RouterLink,
    MoneyPipe,
    SpDatePipe,
    EmptyStateComponent,
    ErrorStateComponent,
    PaginationComponent,
    SkeletonComponent,
    StatusBadgeComponent,
    IconComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <div class="page-head">
      <div>
        <h1>我的订单</h1>
        <p class="sp-secondary">查看订单进度，完成付款、确认收货与评价。</p>
      </div>
      @if (allCount() > 0) {
        <span class="sp-text-13 sp-muted">共 {{ allCount() }} 笔订单</span>
      }
    </div>

    <div class="order-stats" aria-label="订单概览">
      @for (stat of statCards; track stat.key) {
        <button
          class="stat"
          type="button"
          [class.is-on]="status() === stat.key"
          [attr.aria-pressed]="status() === stat.key"
          (click)="selectTab(stat.key)"
        >
          <span class="stat-icon" aria-hidden="true"><app-icon [name]="stat.icon" [size]="18" /></span>
          <span class="stat-copy">
            <strong class="sp-num">{{ tabCount(stat.key) }}</strong>
            <small>{{ stat.label }}</small>
          </span>
          <app-icon class="stat-arrow" name="chevron-right" [size]="14" />
        </button>
      }
    </div>

    <div class="sp-tabbar" role="tablist" aria-label="订单状态筛选">
      @for (tab of tabs; track tab.key; let index = $index) {
        <button
          [id]="'order-tab-' + tab.key"
          type="button"
          role="tab"
          aria-controls="orders-panel"
          [attr.aria-selected]="status() === tab.key"
          [tabindex]="status() === tab.key ? 0 : -1"
          (click)="selectTab(tab.key)"
          (keydown)="onTabKeydown($event, index)"
        >
          {{ tab.label }}
          @if (tabCount(tab.key) > 0) {
            <span class="tab-count sp-num">{{ tabCount(tab.key) }}</span>
          }
        </button>
      }
    </div>

    <section
      id="orders-panel"
      role="tabpanel"
      [attr.aria-labelledby]="'order-tab-' + status()"
      tabindex="0"
      class="orders-panel"
    >
      @if (showSkeleton()) {
        <div class="order-list">
          @for (row of skeletonRows; track row) {
            <div class="sp-card sk-order">
              <app-skeleton variant="line" width="30%" />
              <app-skeleton variant="line" width="100%" />
              <app-skeleton variant="line" width="55%" />
            </div>
          }
        </div>
      } @else if (error()) {
        <app-error-state
          [message]="error() ?? '加载失败，请稍后重试'"
          [requestId]="requestId()"
          (retry)="load()"
        />
      } @else if (orders().length === 0) {
        <app-empty-state
          image="orders"
          [title]="emptyTitle()"
          description="还没有相关订单，去逛逛把喜欢的商品带回家。"
          actionLabel="去逛逛"
          actionLink="/category/all"
        />
      } @else {
        <div class="order-list">
          @for (order of orders(); track order.id) {
            <article class="sp-card order">
              <header class="order-head">
                <div class="order-meta">
                  <span class="order-no">订单号 <strong class="sp-num">{{ order.id }}</strong></span>
                  <span class="sp-text-12 sp-muted sp-num">{{ order.createdAt | spDate }}</span>
                </div>
                <app-status-badge [status]="order.status" />
              </header>

              <div class="order-body">
                <div class="order-main">
                  <div class="thumbs">
                    @for (item of thumbs(order); track item.productId + '-' + $index) {
                      <!-- The image alt names the link; the visible ×N badge must stay
                           part of the accessible name, so no aria-label here. -->
                      <a class="thumb" [routerLink]="['/product', item.productId]">
                        <img [src]="item.image" [alt]="item.title" width="64" height="64" loading="lazy" />
                        <span class="qty sp-num">×{{ item.quantity }}</span>
                      </a>
                    }
                  </div>

                  <div class="order-text">
                    <p class="items-line sp-clamp-1">{{ itemSummary(order) }}</p>
                    <p class="sp-text-12 sp-muted sp-clamp-1">
                      收货人 {{ recipient(order) }}
                      @if (tracking(order)) {
                        <span class="dot-sep">·</span> 运单号 <span class="sp-num">{{ tracking(order) }}</span>
                      } @else {
                        <span class="dot-sep">·</span> 共 {{ countItems(order) }} 件商品
                      }
                      @if (order.status === 'shipped') {
                        <span class="dot-sep">·</span> 预计 1–2 天送达
                      }
                    </p>
                    @if (orderStepIndex(order.status) >= 0) {
                      <ol class="order-timeline" [attr.aria-label]="'订单 ' + order.id + ' 进度'">
                        @for (step of orderSteps; track step.key; let i = $index) {
                          <li [class.on]="orderStepIndex(order.status) >= i">
                            <span class="timeline-dot" aria-hidden="true"></span>{{ step.label }}
                          </li>
                        }
                      </ol>
                    }
                  </div>
                </div>

                <div class="amount">
                  <span class="sp-text-12 sp-muted">共 {{ countItems(order) }} 件</span>
                  <span class="total sp-num">{{ order.total | spMoney }}</span>
                </div>
              </div>

              <footer class="order-foot">
                <a class="sp-btn sp-btn--ghost sp-btn--sm" [routerLink]="['/account/orders', order.id]">
                  查看详情
                </a>
                <div class="ops">
                  @switch (order.status) {
                    @case ('pending_payment') {
                      <button
                        class="sp-btn sp-btn--secondary sp-btn--sm"
                        type="button"
                        [disabled]="busyId() === order.id"
                        (click)="askCancel(order)"
                      >
                        取消订单
                      </button>
                      <button
                        class="sp-btn sp-btn--primary sp-btn--sm"
                        type="button"
                        [disabled]="busyId() === order.id"
                        (click)="pay(order)"
                      >
                        {{ busyId() === order.id ? '处理中…' : '去支付' }}
                      </button>
                    }
                    @case ('shipped') {
                      <button
                        class="sp-btn sp-btn--primary sp-btn--sm"
                        type="button"
                        [disabled]="busyId() === order.id"
                        (click)="confirmReceipt(order)"
                      >
                        {{ busyId() === order.id ? '处理中…' : '确认收货' }}
                      </button>
                    }
                    @case ('completed') {
                      <a
                        class="sp-btn sp-btn--secondary sp-btn--sm"
                        [routerLink]="['/account/orders', order.id]"
                        [queryParams]="{ review: 1 }"
                      >
                        评价
                      </a>
                      <button class="sp-btn sp-btn--ghost sp-btn--sm" type="button" (click)="buyAgain(order)">
                        再买
                      </button>
                    }
                    @default {
                      <button class="sp-btn sp-btn--ghost sp-btn--sm" type="button" (click)="buyAgain(order)">
                        再买
                      </button>
                    }
                  }
                </div>
              </footer>
            </article>
          }
        </div>

        @if (total() > size()) {
          <app-pagination
            [page]="page()"
            [size]="size()"
            [total]="total()"
            (pageChange)="goPage($event)"
            (sizeChange)="changeSize($event)"
          />
        }
      }
    </section>

    <app-confirm-dialog
      [open]="cancelTarget() !== null"
      title="取消订单"
      [message]="cancelMessage()"
      confirmLabel="取消订单"
      cancelLabel="保留订单"
      [danger]="true"
      [busy]="cancelBusy()"
      [error]="cancelError()"
      (confirmed)="cancelOrder()"
      (closed)="closeCancel()"
    />
  `,
  styles: [
    `
      .page-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px 16px;
        padding-bottom: 12px;
        flex-wrap: wrap;
      }
      .page-head > .sp-text-13 { white-space: nowrap; }
      .page-head h1 { font-size: 28px; }
      .page-head p { margin-top: 4px; }

      .order-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }
      .stat {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 68px;
        padding: 12px 14px;
        border: 1px solid var(--sp-border);
        border-radius: 8px;
        background: var(--sp-surface);
        box-shadow: var(--sp-shadow-sm);
        text-align: left;
        color: var(--sp-text);
        transition: border-color .15s ease, background-color .15s ease, box-shadow .15s ease;
      }
      .stat:hover { border-color: var(--sp-border-strong); background: #FFFDF8; }
      .stat.is-on { border-color: var(--sp-primary); background: #FFFDF8; box-shadow: 0 0 0 2px rgba(180, 101, 63, .12); }
      .stat-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--sp-bg);
        color: var(--sp-accent-text);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
      }
      .stat.is-on .stat-icon { background: #FBF0DC; }
      .stat-copy { display: flex; flex-direction: column; gap: 0; min-width: 0; flex: 1 1 auto; }
      .stat-copy strong { font-size: 20px; line-height: 1.1; color: var(--sp-primary); }
      .stat-copy small { font-size: 11.5px; color: var(--sp-text-muted); }
      .stat-arrow { color: var(--sp-border-strong); flex: 0 0 auto; }

      .orders-panel { padding-top: 16px; outline-offset: 4px; }
      .order-list { display: flex; flex-direction: column; gap: 16px; }

      .sk-order { display: flex; flex-direction: column; gap: 12px; padding: 20px; }

      .order { overflow: hidden; }
      .order-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 20px;
        background: #FCFAF6;
        border-bottom: 1px solid var(--sp-border);
        flex-wrap: wrap;
      }
      .order-meta { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
      .order-no { font-size: var(--sp-text-13); color: var(--sp-text-secondary); }
      .order-no strong { color: var(--sp-text); font-size: var(--sp-text-14); }
      .tab-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        margin-left: 4px;
        padding: 0 5px;
        border-radius: var(--sp-radius-pill);
        background: var(--sp-bg);
        color: var(--sp-text-secondary);
        font-size: 11px;
        font-weight: 700;
      }
      .sp-tabbar button[aria-selected='true'] .tab-count { background: var(--sp-primary); color: #fff; }

      .order-body {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 20px;
      }
      .order-main { display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1 1 auto; }
      .order-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .items-line { font-size: var(--sp-text-13); font-weight: 600; color: var(--sp-text); }
      .order-timeline { display: flex; align-items: center; gap: 0; margin: 3px 0 0; padding: 0; list-style: none; }
      .order-timeline li { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: var(--sp-text-muted); white-space: nowrap; }
      .order-timeline li + li::before { content: ''; width: 18px; height: 1px; background: var(--sp-border); margin: 0 4px; }
      .timeline-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sp-border-strong); }
      .order-timeline li.on { color: var(--sp-text-secondary); }
      .order-timeline li.on .timeline-dot { background: var(--sp-sage); }
      .dot-sep { margin: 0 4px; color: var(--sp-text-muted); }
      .thumbs { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
      .thumb {
        position: relative;
        display: block;
        width: 64px;
        height: 64px;
        border-radius: var(--sp-radius-sm);
        overflow: hidden;
        border: 1px solid var(--sp-border);
        background: var(--sp-bg);
        flex: 0 0 auto;
      }
      .thumb img { width: 100%; height: 100%; object-fit: cover; }
      .thumb .qty {
        position: absolute;
        right: 0;
        bottom: 0;
        padding: 0 4px;
        font-size: 11px;
        line-height: 1.5;
        color: #fff;
        background: rgba(15, 23, 32, 0.72);
        border-radius: 4px 0 0 0;
      }
      .amount { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex: 0 0 auto; }
      .total { color: var(--sp-accent-text); font-size: var(--sp-text-20); font-weight: 800; }

      .order-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 20px;
        border-top: 1px solid var(--sp-border);
        flex-wrap: wrap;
      }
      .ops { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .ops .sp-btn { min-height: 44px; }

      @media (max-width: 1023px) {
        .order-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 767px) {
        .page-head h1 { font-size: 24px; }
        .order-stats { gap: 8px; }
        .stat { min-height: 60px; padding: 10px 12px; }
        .stat-icon { width: 32px; height: 32px; }
        .stat-copy strong { font-size: 18px; }
        .order-timeline { flex-wrap: wrap; gap: 2px 0; }
        .order-body { align-items: flex-start; flex-direction: column; }
        .order-main { width: 100%; align-items: flex-start; }
        .amount { flex-direction: row; align-items: baseline; gap: 8px; }
        .order-foot { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 8px; }
        .order-foot > .sp-btn { justify-content: center; min-height: 44px; }
        .ops { justify-content: flex-end; margin-left: auto; }
        .ops .sp-btn { min-height: 44px; }
        .sp-tabbar { flex-wrap: wrap; gap: 0; }
        .sp-tabbar button { flex: 1 0 auto; padding: 10px 10px; font-size: var(--sp-text-13); }
      }
      @media (max-width: 360px) {
        .thumb { width: 56px; height: 56px; }
      }
    `,
  ],
})
export class OrdersPage {
  private readonly api = inject(OrdersApi);
  private readonly cart = inject(CartService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly tabs: OrderTab[] = [
    { key: 'all', label: '全部' },
    { key: 'pending_payment', label: '待付款' },
    { key: 'pending_shipment', label: '待发货' },
    { key: 'shipped', label: '已发货' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ];

  readonly statCards = [
    { key: 'pending_payment', label: '待付款', icon: 'credit-card' },
    { key: 'pending_shipment', label: '待发货', icon: 'package' },
    { key: 'shipped', label: '待收货', icon: 'truck' },
    { key: 'completed', label: '已完成', icon: 'check' },
  ];

  readonly orderSteps: OrderStep[] = [
    { key: 'pending_payment', label: '待付款' },
    { key: 'pending_shipment', label: '待发货' },
    { key: 'shipped', label: '已发货' },
    { key: 'completed', label: '已完成' },
  ];

  readonly status = signal('all');
  readonly page = signal(1);
  readonly size = signal(10);
  readonly orders = signal<Order[]>([]);
  readonly total = signal(0);
  readonly counts = signal<Record<string, number>>({ all: 0 });
  readonly showSkeleton = signal(false);
  readonly error = signal<string | null>(null);
  readonly requestId = signal<string | undefined>(undefined);
  readonly busyId = signal<number | null>(null);

  readonly cancelTarget = signal<Order | null>(null);
  readonly cancelBusy = signal(false);
  readonly cancelError = signal<string | null>(null);

  readonly skeletonRows = [1, 2, 3];

  readonly allCount = computed(() => this.counts()['all'] ?? this.total());

  readonly emptyTitle = computed(() => {
    if (this.status() === 'all') {
      return '还没有订单';
    }
    const tab = this.tabs.find((item) => item.key === this.status());
    return tab ? '没有' + tab.label + '订单' : '还没有订单';
  });

  readonly cancelMessage = computed(() => {
    const target = this.cancelTarget();
    return target ? '确定取消订单 #' + target.id + ' 吗？取消后无法恢复，需要重新下单。' : '';
  });

  private seq = 0;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const raw = params.get('status') ?? 'all';
      const next = this.tabs.some((tab) => tab.key === raw) ? raw : 'all';
      this.status.set(next);
      this.page.set(1);
      this.load();
    });
    this.loadCounts();
  }

  selectTab(key: string): void {
    if (this.status() === key) {
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: key === 'all' ? null : key },
      queryParamsHandling: 'merge',
    });
  }

  onTabKeydown(event: KeyboardEvent, index: number): void {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) {
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
    const tab = this.tabs[next];
    this.selectTab(tab.key);
    setTimeout(() => document.getElementById('order-tab-' + tab.key)?.focus());
  }

  load(): void {
    const seq = ++this.seq;
    this.error.set(null);
    this.requestId.set(undefined);
    this.showSkeleton.set(false);
    const timer = setTimeout(() => {
      if (seq === this.seq) {
        this.showSkeleton.set(true);
      }
    }, 300);

    this.api.list(this.status() === 'all' ? undefined : this.status(), this.page(), this.size()).subscribe({
      next: (result) => {
        clearTimeout(timer);
        if (seq !== this.seq) {
          return;
        }
        this.showSkeleton.set(false);
        this.orders.set(result.items ?? []);
        this.total.set(result.total ?? 0);
      },
      error: (err) => {
        clearTimeout(timer);
        if (seq !== this.seq) {
          return;
        }
        this.showSkeleton.set(false);
        this.orders.set([]);
        this.total.set(0);
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
      },
    });
  }

  loadCounts(): void {
    this.api.list(undefined, 1, 100).subscribe({
      next: (result) => {
        const next: Record<string, number> = { all: result.total ?? 0 };
        for (const order of result.items ?? []) {
          next[order.status] = (next[order.status] ?? 0) + 1;
        }
        this.counts.set(next);
      },
      error: () => undefined,
    });
  }

  tabCount(key: string): number {
    return this.counts()[key] ?? 0;
  }

  orderStepIndex(status: string): number {
    switch (status) {
      case 'pending_payment':
        return 0;
      case 'pending_shipment':
        return 1;
      case 'shipped':
        return 2;
      case 'completed':
        return 3;
      default:
        return -1;
    }
  }

  goPage(page: number): void {
    this.page.set(page);
    this.load();
    document.getElementById('orders-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  changeSize(size: number): void {
    this.size.set(size);
    this.page.set(1);
    this.load();
  }

  thumbs(order: Order): Order['items'] {
    return order.items.slice(0, 4);
  }

  countItems(order: Order): number {
    if (typeof order.itemCount === 'number') {
      return order.itemCount;
    }
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  itemSummary(order: Order): string {
    const items = order.items ?? [];
    if (items.length === 0) {
      return '共 ' + this.countItems(order) + ' 件商品';
    }
    const first = items[0].title;
    return items.length > 1 ? first + ' 等 ' + items.length + ' 种商品' : first;
  }

  recipient(order: Order): string {
    return order.address?.recipient || order.ownerName || '—';
  }

  tracking(order: Order): string {
    if (order.trackingNo) {
      return order.trackingNo;
    }
    return order.status === 'shipped' || order.status === 'completed'
      ? 'SP' + String(order.id).padStart(8, '0') + 'DEMO'
      : '';
  }

  pay(order: Order): void {
    if (this.busyId() !== null) {
      return;
    }
    this.busyId.set(order.id);
    this.api.pay(order.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.show('支付成功，等待发货');
        this.load();
        this.loadCounts();
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  confirmReceipt(order: Order): void {
    if (this.busyId() !== null) {
      return;
    }
    this.busyId.set(order.id);
    this.api.confirm(order.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.show('已确认收货');
        this.load();
        this.loadCounts();
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  buyAgain(order: Order): void {
    const items = order.items ?? [];
    if (items.length === 0) {
      return;
    }
    // V09: re-order with the unit price captured in the order snapshot.
    forkJoin(items.map((item) => this.cart.add(item.productId, item.quantity, item.unitPrice))).subscribe({
      next: () => this.toast.show('已加入购物车'),
      error: (err) => this.toast.show(errorMessage(err), 'error'),
    });
  }

  askCancel(order: Order): void {
    this.cancelError.set(null);
    this.cancelTarget.set(order);
  }

  closeCancel(): void {
    if (this.cancelBusy()) {
      return;
    }
    this.cancelTarget.set(null);
    this.cancelError.set(null);
  }

  cancelOrder(): void {
    const target = this.cancelTarget();
    if (!target) {
      return;
    }
    this.cancelBusy.set(true);
    this.cancelError.set(null);
    this.api.cancel(target.id).subscribe({
      next: () => {
        this.cancelBusy.set(false);
        this.cancelTarget.set(null);
        this.toast.show('订单已取消');
        this.load();
        this.loadCounts();
      },
      error: (err) => {
        this.cancelBusy.set(false);
        this.cancelError.set(errorMessage(err));
      },
    });
  }
}