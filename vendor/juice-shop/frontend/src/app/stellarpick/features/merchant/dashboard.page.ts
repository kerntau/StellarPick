import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MerchantApi } from '../../core/api/merchant.api';
import { MerchantOrder, MerchantProduct, errorMessage, errorRequestId } from '../../core/models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { MerchantIconComponent } from './components/merchant-icon.component';
import { MerchantStatComponent } from './components/merchant-stat.component';
import { TrendChartComponent } from './components/trend-chart.component';
import {
  DAY_MS,
  dayKey,
  dayLabel,
  daysSince,
  formatPct,
  lastNDays,
  pctChange,
  relativeTime,
  startOfDay,
  sum,
  weekdayLabel,
} from './ops-utils';
import { OPS_CSS } from './ops-ui';

interface TodoItem {
  label: string;
  value: number;
  unit: string;
  hint: string;
  link: string;
  query?: Record<string, string>;
  icon: string;
  tone: string;
}

interface StructureItem {
  label: string;
  count: number;
  pct: number;
  color: string;
}

interface FeedItem {
  id: number;
  title: string;
  desc: string;
  amount: number;
  time: string;
  icon: string;
  tone: string;
}

const TREND_DAYS = 7;

/** 商家工作台：经营指标 + 7 日趋势 + 订单结构 + 店铺动态 + 待办 + 快捷入口。 */
@Component({
  selector: 'app-merchant-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    MerchantIconComponent,
    MerchantStatComponent,
    TrendChartComponent,
    ErrorStateComponent,
    MoneyPipe,
  ],
  template: `
    <section class="ops-page">
      <header class="ops-head">
        <div>
          <p class="ops-eyebrow">Store operations · 星澜自营旗舰店</p>
          <h2>工作台</h2>
          <p class="ops-sub">近 7 日经营概览、履约待办与店铺动态，数据来自订单与商品接口。</p>
          <div class="ops-meta">
            <span>{{ todayLabel }}</span>
            <span>今日 <b class="sp-num">{{ todayOrders() }}</b> 单</span>
            <span>今日成交 <b class="sp-num">{{ todaySales() | spMoney }}</b></span>
            <span>营业状态 <b>正常</b></span>
          </div>
        </div>
        <div class="ops-actions">
          <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="load()" [disabled]="loading()">
            <app-merchant-icon name="refresh" [size]="16" />
            {{ loading() ? '刷新中…' : '刷新数据' }}
          </button>
          <a class="sp-btn sp-btn--primary sp-btn--sm" routerLink="/merchant/products" [queryParams]="{ new: '1' }">
            <app-merchant-icon name="plus" [size]="16" />
            新增商品
          </a>
        </div>
      </header>

      @if (error()) {
        <app-error-state [message]="error()" [requestId]="requestId()" (retry)="load()" />
      }

      <div class="metrics" aria-label="经营指标">
        @if (showSkeleton()) {
          @for (row of skeletonRows; track row) {
            <div class="sp-skeleton metric-sk"></div>
          }
        } @else {
          <app-merchant-stat
            label="近 7 日订单"
            [value]="weekOrders()"
            [hint]="'日均 ' + dailyAverage() + ' 单 · 今日 ' + todayOrders() + ' 单'"
            [delta]="ordersDelta()"
            deltaLabel="较前 7 日"
            [spark]="counts()"
            icon="file-text"
            tone="primary"
          />
          <app-merchant-stat
            label="近 7 日成交额"
            [value]="weekSales() | spMoney"
            [hint]="'客单价 ' + (avgOrder() | spMoney) + ' · 含未发货订单'"
            [delta]="salesDelta()"
            deltaLabel="较前 7 日"
            [spark]="sales()"
            icon="credit-card"
            tone="accent"
          />
          <app-merchant-stat
            label="待发货订单"
            [value]="stats().pendingShipment"
            [hint]="pendingHint()"
            icon="truck"
            [tone]="stats().pendingShipment > 0 ? 'warning' : 'success'"
          />
          <app-merchant-stat
            label="在售商品"
            [value]="stats().onSale"
            [hint]="'共 ' + stats().productCount + ' 件 · 已下架 ' + stats().offSale + ' 件'"
            [meter]="onSalePct()"
            icon="package"
            tone="success"
          />
        }
      </div>

      <div class="main-grid">
        <section class="ops-card chart-card" aria-labelledby="trend-title">
          <header class="ops-card-head">
            <div>
              <h3 id="trend-title">近 7 日经营趋势</h3>
              <p>按订单创建时间聚合 · 今日以琥珀色柱标记</p>
            </div>
            <span class="ops-count">7 天</span>
          </header>

          @if (showSkeleton()) {
            <div class="sp-skeleton chart-sk"></div>
          } @else {
            <div class="chart-body">
              <app-trend-chart
                [labels]="labels"
                [counts]="counts()"
                [sales]="sales()"
                title="近 7 日经营趋势"
              />
            </div>
            <footer class="chart-foot">
              <div class="chart-total">
                <span class="foot-label">7 日合计</span>
                <strong class="sp-num">{{ weekOrders() }}</strong> 单
                <span class="sep" aria-hidden="true">·</span>
                <strong class="sp-num">{{ weekSales() | spMoney }}</strong>
              </div>
              <div class="chart-compare">
                订单量较前 7 日
                <b [class.up]="isUp(ordersDelta())" [class.down]="isDown(ordersDelta())">{{ pctText(ordersDelta()) }}</b>
              </div>
            </footer>
          }
        </section>

        <section class="ops-card todo-card" aria-labelledby="todo-title">
          <header class="ops-card-head">
            <div>
              <h3 id="todo-title">待办与提醒</h3>
              <p>按处理时效排序</p>
            </div>
            <span class="ops-count">{{ todos().length }} 项</span>
          </header>

          <ul class="todo-list">
            @for (todo of todos(); track todo.label) {
              <li>
                <a [routerLink]="todo.link" [queryParams]="todo.query" class="todo">
                  <span [class]="'todo-ico todo-ico--' + todo.tone">
                    <app-merchant-icon [name]="todo.icon" [size]="17" />
                  </span>
                  <span class="todo-text">
                    <strong>{{ todo.label }}</strong>
                    <small>{{ todo.hint }}</small>
                  </span>
                  <span class="todo-value sp-num">{{ todo.value }}<small>{{ todo.unit }}</small></span>
                  <app-merchant-icon name="chevron-right" [size]="15" class="todo-arrow" />
                </a>
              </li>
            }
          </ul>

          <div class="structure">
            <div class="structure-head">
              <span>订单结构</span>
              <span class="sp-num">{{ stats().orderCount }} 笔</span>
            </div>
            <div class="structure-bar" role="img" [attr.aria-label]="structureLabel()">
              @for (item of structure(); track item.label) {
                @if (item.count > 0) {
                  <span [style.width.%]="item.pct" [style.background]="item.color"></span>
                }
              }
            </div>
            <ul class="structure-legend">
              @for (item of structure(); track item.label) {
                <li>
                  <span class="dot" [style.background]="item.color" aria-hidden="true"></span>
                  {{ item.label }}
                  <b class="sp-num">{{ item.count }}</b>
                </li>
              }
            </ul>
          </div>

          <p class="todo-note">
            发货后订单状态自动变为「已发货」，买家可在订单详情查看物流单号。
          </p>
        </section>
      </div>

      <div class="lower-grid">
        <section class="ops-card feed-card" aria-labelledby="feed-title">
          <header class="ops-card-head">
            <div>
              <h3 id="feed-title">店铺动态</h3>
              <p>最近 6 条订单事件，按下单时间排序</p>
            </div>
            <a class="sp-link sp-text-13" routerLink="/merchant/orders">全部订单</a>
          </header>
          @if (showSkeleton()) {
            <div class="sp-skeleton feed-sk"></div>
          } @else if (feed().length === 0) {
            <p class="ops-empty-line">还没有订单动态，买家下单后会实时出现在这里。</p>
          } @else {
            <ul class="ops-feed">
              @for (item of feed(); track item.id) {
                <li>
                  <span [class]="'feed-ico feed-ico--' + item.tone">
                    <app-merchant-icon [name]="item.icon" [size]="16" />
                  </span>
                  <span class="feed-body">
                    <strong>{{ item.title }}</strong>
                    <p>{{ item.desc }}</p>
                  </span>
                  <span class="feed-side">
                    <b>{{ item.amount | spMoney }}</b>
                    {{ relative(item.time) }}
                  </span>
                </li>
              }
            </ul>
          }
        </section>

        <section class="ops-card quick-card" aria-labelledby="quick-title">
          <header class="ops-card-head">
            <div>
              <h3 id="quick-title">快捷入口</h3>
              <p>高频运营动作</p>
            </div>
          </header>
          <ul class="quick-list">
            @for (link of quickLinks; track link.label) {
              <li>
                <a class="quick" [routerLink]="link.link" [queryParams]="link.query">
                  <span class="quick-ico"><app-merchant-icon [name]="link.icon" [size]="18" /></span>
                  <span class="quick-text">
                    <strong>{{ link.label }}</strong>
                    <small>{{ link.desc }}</small>
                  </span>
                  <app-merchant-icon name="chevron-right" [size]="15" />
                </a>
              </li>
            }
          </ul>
          <p class="quick-note">演示数据每日重置，仅用于产品流程体验。</p>
        </section>
      </div>
    </section>
  `,
  styles: [OPS_CSS, `
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .metric-sk { height: 132px; border-radius: 10px; }

    .main-grid { display: grid; grid-template-columns: minmax(0, 1.62fr) minmax(310px, .88fr); gap: 16px; align-items: start; }
    .chart-body { padding: 14px 18px 6px; }
    .chart-sk { height: 268px; margin: 14px 18px; border-radius: 8px; }
    .chart-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 18px 14px; border-top: 1px solid var(--sp-border); font-size: 12px; color: var(--sp-text-secondary); }
    .chart-total { display: flex; align-items: baseline; gap: 4px; }
    .chart-total strong { font-size: 14px; color: var(--sp-text); }
    .foot-label { margin-right: 4px; color: var(--sp-text-muted); }
    .sep { margin: 0 4px; color: var(--sp-border-strong); }
    .chart-compare b { font-weight: 700; font-variant-numeric: tabular-nums; }
    .chart-compare .up { color: var(--sp-success); }
    .chart-compare .down { color: var(--sp-danger); }

    .todo-list { display: flex; flex-direction: column; }
    .todo-list li + li { border-top: 1px solid var(--sp-border); }
    .todo { display: flex; align-items: center; gap: 12px; padding: 11px 16px; min-height: 56px; color: var(--sp-text); }
    .todo:hover { background: #FBF8F3; color: var(--sp-text); }
    .todo-ico { width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--sp-info-soft); color: var(--sp-info-strong); }
    .todo-ico--warning { background: var(--sp-warning-soft); color: var(--sp-warning); }
    .todo-ico--danger { background: var(--sp-danger-soft); color: var(--sp-danger); }
    .todo-ico--accent { background: #FBF0DC; color: var(--sp-accent-text); }
    .todo-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
    .todo-text strong { font-size: 13px; }
    .todo-text small { font-size: 11px; color: var(--sp-text-muted); margin-top: 1px; }
    .todo-value { font-size: 18px; font-weight: 700; color: var(--sp-primary); white-space: nowrap; }
    .todo-value small { margin-left: 2px; font-size: 11px; font-weight: 500; color: var(--sp-text-muted); }
    .todo-arrow { color: var(--sp-text-muted); }
    .todo-note { padding: 10px 16px 12px; border-top: 1px solid var(--sp-border); font-size: 11px; line-height: 1.6; color: var(--sp-text-muted); }

    .structure { padding: 12px 16px 14px; border-top: 1px solid var(--sp-border); display: flex; flex-direction: column; gap: 8px; }
    .structure-head { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--sp-text-muted); }
    .structure-bar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; background: var(--sp-bg); }
    .structure-bar span { display: block; height: 100%; }
    .structure-bar span + span { box-shadow: inset 1px 0 0 rgba(255, 255, 255, .8); }
    .structure-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
    .structure-legend li { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--sp-text-secondary); }
    .structure-legend b { margin-left: auto; color: var(--sp-text); font-weight: 700; }
    .structure-legend .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }

    .lower-grid { display: grid; grid-template-columns: minmax(0, 1.62fr) minmax(310px, .88fr); gap: 16px; align-items: start; }
    .feed-sk { height: 220px; margin: 14px 18px; border-radius: 8px; }

    .quick-list { display: flex; flex-direction: column; }
    .quick-list li + li { border-top: 1px solid var(--sp-border); }
    .quick { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 9px 16px; color: var(--sp-text); }
    .quick:hover { background: #FBF8F3; color: var(--sp-text); }
    .quick-ico { width: 32px; height: 32px; border-radius: 8px; background: var(--sp-bg); color: var(--sp-primary); display: inline-flex; align-items: center; justify-content: center; flex: none; }
    .quick-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
    .quick-text strong { font-size: 13px; }
    .quick-text small { font-size: 11px; color: var(--sp-text-muted); margin-top: 1px; }
    .quick-note { padding: 10px 16px 12px; border-top: 1px solid var(--sp-border); font-size: 11px; color: var(--sp-text-muted); }

    @media (max-width: 1279px) {
      .main-grid, .lower-grid { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 767px) {
      .metrics { gap: 10px; }
      .chart-body { padding: 12px 12px 4px; }
      .chart-foot { padding: 10px 12px 12px; }
      .chart-total { flex-wrap: wrap; }
    }
  `],
})
export class MerchantDashboardPage implements OnDestroy {
  private readonly api = inject(MerchantApi);

  readonly orders = signal<MerchantOrder[]>([]);
  readonly products = signal<MerchantProduct[]>([]);
  readonly loading = signal(false);
  readonly showSkeleton = signal(false);
  readonly error = signal('');
  readonly requestId = signal<string | undefined>(undefined);
  readonly skeletonRows = [1, 2, 3, 4];
  readonly todayLabel = this.formatToday();

  readonly days = lastNDays(TREND_DAYS);
  readonly labels = this.days.map((day) => dayLabel(day));

  readonly daily = computed(() => {
    const buckets = new Map<string, { count: number; sales: number }>();
    for (const day of this.days) {
      buckets.set(dayKey(day), { count: 0, sales: 0 });
    }
    for (const order of this.orders()) {
      const bucket = buckets.get(dayKey(new Date(order.createdAt)));
      if (bucket) {
        bucket.count += 1;
        bucket.sales += Number(order.total) || 0;
      }
    }
    return this.days.map((day) => buckets.get(dayKey(day)) ?? { count: 0, sales: 0 });
  });

  readonly counts = computed(() => this.daily().map((item) => item.count));
  readonly sales = computed(() => this.daily().map((item) => item.sales));
  readonly weekOrders = computed(() => sum(this.counts()));
  readonly weekSales = computed(() => sum(this.sales()));

  readonly previous = computed(() => {
    const today = startOfDay(new Date()).getTime();
    const start = today - 13 * DAY_MS;
    const end = today - 6 * DAY_MS;
    let count = 0;
    let sales = 0;
    for (const order of this.orders()) {
      const time = new Date(order.createdAt).getTime();
      if (time >= start && time < end) {
        count += 1;
        sales += Number(order.total) || 0;
      }
    }
    return { count, sales };
  });

  readonly ordersDelta = computed(() => pctChange(this.weekOrders(), this.previous().count));
  readonly salesDelta = computed(() => pctChange(this.weekSales(), this.previous().sales));
  readonly avgOrder = computed(() => (this.weekOrders() > 0 ? this.weekSales() / this.weekOrders() : 0));
  readonly dailyAverage = computed(() => (Math.round((this.weekOrders() / TREND_DAYS) * 10) / 10).toFixed(1));

  readonly todayOrders = computed(() => {
    const key = dayKey(new Date());
    return this.orders().filter((order) => dayKey(new Date(order.createdAt)) === key).length;
  });
  readonly todaySales = computed(() => {
    const key = dayKey(new Date());
    return this.orders()
      .filter((order) => dayKey(new Date(order.createdAt)) === key)
      .reduce((total, order) => total + (Number(order.total) || 0), 0);
  });

  readonly stats = computed(() => {
    const orders = this.orders();
    const products = this.products();
    const onSale = products.filter((product) => product.status === 'on_sale').length;
    return {
      pendingShipment: orders.filter((order) => order.status === 'pending_shipment').length,
      pendingPayment: orders.filter((order) => order.status === 'pending_payment').length,
      shipped: orders.filter((order) => order.status === 'shipped').length,
      completed: orders.filter((order) => order.status === 'completed').length,
      cancelled: orders.filter((order) => order.status === 'cancelled').length,
      orderCount: orders.length,
      productCount: products.length,
      onSale,
      offSale: products.length - onSale,
    };
  });

  readonly onSalePct = computed(() => {
    const stats = this.stats();
    return stats.productCount > 0 ? Math.round((stats.onSale / stats.productCount) * 100) : 0;
  });

  readonly pendingHint = computed(() => {
    const pending = this.orders().filter((order) => order.status === 'pending_shipment');
    if (pending.length === 0) {
      return '暂无待发货订单，履约节奏正常';
    }
    const oldest = pending
      .map((order) => new Date(order.createdAt).getTime())
      .filter((time) => Number.isFinite(time))
      .sort((a, b) => a - b)[0];
    const days = oldest ? daysSince(new Date(oldest).toISOString()) : 0;
    return '最早一单已等待 ' + days + ' 天，建议今日出库';
  });

  readonly structure = computed<StructureItem[]>(() => {
    const stats = this.stats();
    const total = Math.max(1, stats.orderCount);
    const rows = [
      { label: '待付款', count: stats.pendingPayment, color: '#B77A15' },
      { label: '待发货', count: stats.pendingShipment, color: '#2D6CDF' },
      { label: '已发货', count: stats.shipped, color: '#E8A33D' },
      { label: '已完成', count: stats.completed, color: '#1F7A5C' },
      { label: '已取消', count: stats.cancelled, color: '#CFC6B8' },
    ];
    return rows.map((row) => ({ ...row, pct: (row.count / total) * 100 }));
  });

  readonly structureLabel = computed(() =>
    this.structure()
      .map((item) => item.label + ' ' + item.count + ' 笔')
      .join('，'),
  );

  readonly todos = computed<TodoItem[]>(() => {
    const stats = this.stats();
    return [
      {
        label: '待发货订单',
        value: stats.pendingShipment,
        unit: '单',
        hint: stats.pendingShipment > 0 ? this.pendingHint() : '暂无待发货，履约节奏正常',
        link: '/merchant/orders',
        query: { status: 'pending_shipment' },
        icon: 'truck',
        tone: stats.pendingShipment > 0 ? 'warning' : 'primary',
      },
      {
        label: '待付款订单',
        value: stats.pendingPayment,
        unit: '单',
        hint: '买家下单后未完成支付，可稍后跟进',
        link: '/merchant/orders',
        query: { status: 'pending_payment' },
        icon: 'clock',
        tone: 'primary',
      },
      {
        label: '已下架商品',
        value: stats.offSale,
        unit: '件',
        hint: stats.offSale > 0 ? '下架商品不会在前台展示' : '全部商品均在售',
        link: '/merchant/products',
        query: { status: 'off_sale' },
        icon: 'package',
        tone: stats.offSale > 0 ? 'danger' : 'primary',
      },
    ];
  });

  readonly feed = computed<FeedItem[]>(() =>
    [...this.orders()]
      .filter((order) => Number.isFinite(new Date(order.createdAt).getTime()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((order) => ({
        id: order.id,
        title: '订单 #' + order.id,
        desc:
          (order.buyerName || '匿名买家') +
          ' · ' +
          order.items.reduce((total, item) => total + item.quantity, 0) +
          ' 件 · ' +
          (order.statusText || order.status) +
          (order.trackingNo ? ' · ' + order.trackingNo : ''),
        amount: order.total,
        time: order.createdAt,
        icon: this.feedIcon(order.status),
        tone: this.feedTone(order.status),
      })),
  );

  readonly quickLinks = [
    { label: '新增商品', desc: '补充标题、价格与主图', link: '/merchant/products', query: { new: '1' }, icon: 'plus' },
    { label: '处理待发货', desc: '填写物流单号完成出库', link: '/merchant/orders', query: { status: 'pending_shipment' }, icon: 'truck' },
    { label: '商品管理', desc: '维护在售与已下架商品', link: '/merchant/products', query: undefined as Record<string, string> | undefined, icon: 'package' },
    { label: '返回商城', desc: '回到前台查看店铺商品', link: '/', query: undefined as Record<string, string> | undefined, icon: 'store' },
  ];

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

    forkJoin({
      orders: this.api.orders(),
      products: this.api.products(),
    }).subscribe({
      next: (result) => {
        if (seq !== this.seq) {
          return;
        }
        this.orders.set(result.orders ?? []);
        this.products.set(result.products ?? []);
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

  pctText(value: number | null): string {
    return formatPct(value);
  }

  isUp(value: number | null): boolean {
    return value !== null && value > 0;
  }

  isDown(value: number | null): boolean {
    return value !== null && value < 0;
  }

  relative(value: string): string {
    return relativeTime(value);
  }

  private feedIcon(status: string): string {
    if (status === 'pending_shipment') {
      return 'truck';
    }
    if (status === 'shipped') {
      return 'truck';
    }
    if (status === 'completed') {
      return 'check-circle';
    }
    if (status === 'cancelled') {
      return 'x-circle';
    }
    return 'clock';
  }

  private feedTone(status: string): string {
    if (status === 'completed') {
      return 'success';
    }
    if (status === 'shipped') {
      return 'accent';
    }
    if (status === 'cancelled') {
      return 'muted';
    }
    return 'warning';
  }

  private formatToday(): string {
    const now = new Date();
    const date = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    return date + ' · ' + weekdayLabel(now);
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
