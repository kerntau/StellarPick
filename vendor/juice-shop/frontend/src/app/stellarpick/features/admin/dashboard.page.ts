import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminApi } from '../../core/api/admin.api';
import { AdminUser, Merchant, errorMessage, errorRequestId } from '../../core/models';
import { SpDatePipe } from '../../shared/pipes/date.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { AdminIconComponent } from './components/admin-icon.component';
import { AdminStatComponent } from './components/admin-stat.component';
import { AdminTrendComponent } from './components/admin-trend.component';
import { OPS_CSS } from './ops-ui';
import {
  dayKey,
  daysSince,
  formatPct,
  lastNMonths,
  monthKey,
  monthLabel,
  pctChange,
  relativeTime,
  sum,
} from './ops-utils';

interface QuickLink {
  label: string;
  desc: string;
  link: string;
  query?: Record<string, string>;
  icon: string;
}

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

interface RoleSlice {
  label: string;
  count: number;
  pct: number;
  color: string;
}

interface FeedItem {
  key: string;
  title: string;
  desc: string;
  time: string;
  icon: string;
  tone: string;
  badge?: string;
}

/** 平台后台首页：指标 + 7 日注册趋势 + 待办 + 最近注册 + 审核队列 + 平台动态。 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    AdminIconComponent,
    AdminStatComponent,
    AdminTrendComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
    SpDatePipe,
  ],
  template: `
    <section class="ops-page">
      <header class="ops-head">
        <div>
          <p class="ops-eyebrow">Platform operations · 星澜优选</p>
          <h2>后台首页</h2>
          <p class="ops-sub">平台账号与商家入驻的整体情况，数据来自演示数据库。</p>
          <div class="ops-meta">
            <span>{{ todayLabel }}</span>
            <span>账号 <b class="sp-num">{{ users().length }}</b> 个</span>
            <span>商家 <b class="sp-num">{{ merchants().length }}</b> 家</span>
            <span>待审 <b class="sp-num">{{ stats().pendingMerchants }}</b> 家</span>
          </div>
        </div>
        <div class="ops-actions">
          <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="load()" [disabled]="loading()">
            <app-admin-icon name="refresh" [size]="16" />
            {{ loading() ? '刷新中…' : '刷新数据' }}
          </button>
          <a class="sp-btn sp-btn--primary sp-btn--sm" routerLink="/admin/merchants">
            <app-admin-icon name="shield" [size]="16" />
            去审核
          </a>
        </div>
      </header>

      @if (error()) {
        <app-error-state [message]="error()" [requestId]="requestId()" (retry)="load()" />
      }

      <div class="metrics" aria-label="平台核心指标">
        @if (showSkeleton()) {
          @for (row of skeletonRows; track row) {
            <div class="sp-skeleton metric-sk"></div>
          }
        } @else {
          <app-admin-stat
            label="用户总数"
            [value]="stats().totalUsers"
            [hint]="'近 6 个月新增 ' + stats().newUsers + ' 个 · 管理员 ' + stats().admins + ' 个'"
            [delta]="usersDelta()"
            deltaLabel="新增较前 6 个月"
            [spark]="registrations()"
            icon="users"
            tone="primary"
          />
          <app-admin-stat
            label="商家总数"
            [value]="stats().totalMerchants"
            [hint]="'已通过 ' + stats().approvedMerchants + ' · 待审 ' + stats().pendingMerchants + ' · 已驳回 ' + stats().rejectedMerchants"
            [meter]="approvedPct()"
            icon="store"
            tone="success"
          />
          <app-admin-stat
            label="待审商家"
            [value]="stats().pendingMerchants"
            [hint]="pendingHint()"
            icon="shield"
            [tone]="stats().pendingMerchants > 0 ? 'warning' : 'primary'"
          />
          <app-admin-stat
            label="已禁用账号"
            [value]="stats().disabledUsers"
            [hint]="'占全部账号 ' + disabledPct() + '% · 可复核后恢复'"
            icon="ban"
            tone="accent"
          />
        }
      </div>

      <div class="main-grid">
        <section class="ops-card" aria-labelledby="trend-title">
          <header class="ops-card-head">
            <div>
              <h3 id="trend-title">近 12 个月账号增长</h3>
              <p>按账号注册月份聚合 · 当前月以琥珀色柱标记</p>
            </div>
            <span class="ops-count">12 个月</span>
          </header>
          @if (showSkeleton()) {
            <div class="sp-skeleton chart-sk"></div>
          } @else {
            <div class="chart-body">
              <app-admin-trend [labels]="labels" [values]="registrations()" title="近 12 个月账号增长" />
            </div>
            <footer class="chart-foot">
              <div class="chart-total">
                <span class="foot-label">12 个月合计</span>
                <strong class="sp-num">{{ totalMonths() }}</strong> 个
                <span class="sep" aria-hidden="true">·</span>
                今日 <strong class="sp-num">{{ todayUsers() }}</strong> 个
              </div>
              <div class="chart-compare">
                新增较前 6 个月
                <b [class.up]="isUp(usersDelta())" [class.down]="isDown(usersDelta())">{{ pctText(usersDelta()) }}</b>
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
                    <app-admin-icon [name]="todo.icon" [size]="17" />
                  </span>
                  <span class="todo-text">
                    <strong>{{ todo.label }}</strong>
                    <small>{{ todo.hint }}</small>
                  </span>
                  <span class="todo-value sp-num">{{ todo.value }}<small>{{ todo.unit }}</small></span>
                  <app-admin-icon name="chevron-right" [size]="15" class="todo-arrow" />
                </a>
              </li>
            }
          </ul>

          <div class="structure">
            <div class="structure-head">
              <span>账号角色结构</span>
              <span class="sp-num">{{ stats().totalUsers }} 个</span>
            </div>
            <div class="structure-bar" role="img" [attr.aria-label]="roleLabel()">
              @for (item of roles(); track item.label) {
                @if (item.count > 0) {
                  <span [style.width.%]="item.pct" [style.background]="item.color"></span>
                }
              }
            </div>
            <ul class="structure-legend">
              @for (item of roles(); track item.label) {
                <li>
                  <span class="dot" [style.background]="item.color" aria-hidden="true"></span>
                  {{ item.label }}
                  <b class="sp-num">{{ item.count }}</b>
                </li>
              }
            </ul>
          </div>

          <p class="todo-note">处理结果会即时同步到商城与商家中心。</p>
        </section>
      </div>

      <div class="lower-grid">
        <section class="ops-card" aria-labelledby="recent-title">
          <header class="ops-card-head">
            <div>
              <h3 id="recent-title">最近注册用户</h3>
              <p>按注册时间倒序，最多 6 条</p>
            </div>
            <a class="sp-link sp-text-13" routerLink="/admin/users">查看全部用户</a>
          </header>

          @if (showSkeleton()) {
            <div class="skeleton-rows" aria-hidden="true">
              @for (row of skeletonRows; track row) {
                <div class="sp-skeleton ops-skeleton-row"></div>
              }
            </div>
          } @else if (recentUsers().length === 0) {
            <app-empty-state
              image="search"
              title="暂无注册用户"
              description="新注册的账号会出现在这里，稍后刷新即可。"
              actionLabel="刷新列表"
              (action)="load()"
            />
          } @else {
            <div class="table-wrap" tabindex="0" role="region" aria-label="最近注册用户列表，可横向滚动">
              <table class="ops-table user-table">
                <caption>最近注册的 {{ recentUsers().length }} 个账号</caption>
                <thead>
                  <tr>
                    <th scope="col">账号</th>
                    <th scope="col" class="col-email">邮箱</th>
                    <th scope="col">角色</th>
                    <th scope="col">状态</th>
                    <th scope="col" class="num col-date">注册时间</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of recentUsers(); track user.id) {
                    <tr>
                      <td>
                        <div class="ops-cell-main">
                          <span class="ops-avatar" aria-hidden="true">{{ initial(user.username) }}</span>
                          <span class="ops-cell-text">
                            <strong>{{ user.username }}</strong>
                            <small>{{ user.name }}</small>
                          </span>
                        </div>
                      </td>
                      <td class="email col-email">{{ user.email }}</td>
                      <td><app-status-badge [status]="user.role" /></td>
                      <td><app-status-badge [status]="user.status" /></td>
                      <td class="num date col-date">{{ user.createdAt | spDate }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="ops-card" aria-labelledby="pending-title">
          <header class="ops-card-head">
            <div>
              <h3 id="pending-title">入驻审核队列</h3>
              <p>按申请时间排序</p>
            </div>
            <a class="sp-link sp-text-13" routerLink="/admin/merchants">去审核</a>
          </header>

          @if (showSkeleton()) {
            <div class="skeleton-rows" aria-hidden="true">
              @for (row of skeletonRows; track row) {
                <div class="sp-skeleton ops-skeleton-row"></div>
              }
            </div>
          } @else if (pendingList().length === 0) {
            <p class="ops-empty-line">
              <app-admin-icon name="check-circle" [size]="16" />
              所有入驻申请都已处理，暂无待审商家。
            </p>
          } @else {
            <ul class="queue">
              @for (merchant of pendingList(); track merchant.id) {
                <li>
                  <span class="queue-mark" aria-hidden="true">{{ initial(merchant.name) }}</span>
                  <span class="queue-text">
                    <strong>{{ merchant.name }}</strong>
                    <small>{{ merchant.category || '未填类目' }} · {{ merchant.contact || '未填联系人' }}</small>
                    <small class="sp-num">申请于 {{ merchant.appliedAt | spDate }} · 等待 {{ waitingDays(merchant.appliedAt) }} 天</small>
                  </span>
                  <a class="sp-btn sp-btn--secondary sp-btn--sm" routerLink="/admin/merchants">审核</a>
                </li>
              }
            </ul>
          }
        </section>
      </div>

      <div class="lower-grid">
        <section class="ops-card feed-card" aria-labelledby="feed-title">
          <header class="ops-card-head">
            <div>
              <h3 id="feed-title">平台动态</h3>
              <p>账号注册与入驻申请按时间聚合</p>
            </div>
            <span class="ops-count">{{ feed().length }} 条</span>
          </header>
          @if (showSkeleton()) {
            <div class="sp-skeleton feed-sk"></div>
          } @else if (feed().length === 0) {
            <p class="ops-empty-line">暂无平台动态。</p>
          } @else {
            <ul class="ops-feed">
              @for (item of feed(); track item.key) {
                <li>
                  <span [class]="'feed-ico feed-ico--' + item.tone">
                    <app-admin-icon [name]="item.icon" [size]="16" />
                  </span>
                  <span class="feed-body">
                    <strong>{{ item.title }}</strong>
                    <p>{{ item.desc }}</p>
                  </span>
                  <span class="feed-side">
                    @if (item.badge) {
                      <b class="feed-badge">{{ item.badge }}</b>
                    }
                    {{ relative(item.time) }}
                  </span>
                </li>
              }
            </ul>
          }
        </section>

        <section class="ops-card" aria-labelledby="quick-title">
          <header class="ops-card-head">
            <div>
              <h3 id="quick-title">快捷入口</h3>
              <p>常用平台操作</p>
            </div>
          </header>
          <ul class="quick-list">
            @for (item of quickLinks; track item.label) {
              <li>
                <a [routerLink]="item.link" [queryParams]="item.query" class="quick">
                  <span class="quick-ico"><app-admin-icon [name]="item.icon" [size]="18" /></span>
                  <span class="quick-text">
                    <strong>{{ item.label }}</strong>
                    <small>{{ item.desc }}</small>
                  </span>
                  <app-admin-icon name="chevron-right" [size]="15" />
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

    .main-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(320px, .95fr); gap: 16px; align-items: start; }
    .chart-body { padding: 14px 18px 6px; }
    .chart-sk { height: 248px; margin: 14px 18px; border-radius: 8px; }
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
    .todo-note { padding: 10px 16px 12px; border-top: 1px solid var(--sp-border); font-size: 11px; color: var(--sp-text-muted); }

    .structure { padding: 12px 16px 14px; border-top: 1px solid var(--sp-border); display: flex; flex-direction: column; gap: 8px; }
    .structure-head { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--sp-text-muted); }
    .structure-bar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; background: var(--sp-bg); }
    .structure-bar span { display: block; height: 100%; }
    .structure-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
    .structure-legend li { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--sp-text-secondary); }
    .structure-legend b { margin-left: auto; color: var(--sp-text); font-weight: 700; }
    .structure-legend .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }

    .lower-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(320px, .95fr); gap: 16px; align-items: start; }
    .skeleton-rows { padding: 6px 0; }
    .email { color: var(--sp-text-secondary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .date { white-space: nowrap; color: var(--sp-text-secondary); }

    .queue { display: flex; flex-direction: column; }
    .queue li { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--sp-border); }
    .queue li:last-child { border-bottom: 0; }
    .queue-mark { width: 34px; height: 34px; border-radius: 8px; background: var(--sp-info-soft); color: var(--sp-primary); font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none; }
    .queue-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
    .queue-text strong { font-size: 13px; }
    .queue-text small { font-size: 11px; color: var(--sp-text-muted); margin-top: 1px; }

    .feed-sk { height: 220px; margin: 14px 18px; border-radius: 8px; }
    .feed-badge { display: inline-flex; padding: 0 6px; border-radius: 999px; background: var(--sp-bg); color: var(--sp-text-secondary); font-size: 10px; font-weight: 700; }

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
      .email { max-width: 120px; }
      .col-email, .col-date { display: none; }
      .table-wrap { overflow: visible; }
    }
  `],
})
export class AdminDashboardPage implements OnDestroy {
  private readonly api = inject(AdminApi);

  readonly users = signal<AdminUser[]>([]);
  readonly merchants = signal<Merchant[]>([]);
  readonly loading = signal(false);
  readonly showSkeleton = signal(false);
  readonly error = signal('');
  readonly requestId = signal<string | undefined>(undefined);
  readonly skeletonRows = [1, 2, 3, 4];
  readonly todayLabel = this.formatToday();

  readonly months = lastNMonths(12);
  readonly labels = this.months.map((month) => monthLabel(month));

  readonly quickLinks: QuickLink[] = [
    { label: '用户管理', desc: '查看账号、调整角色与状态', link: '/admin/users', icon: 'users' },
    { label: '商家审核', desc: '处理入驻申请与资质信息', link: '/admin/merchants', icon: 'store' },
    { label: '禁用账号', desc: '复核已禁用账号并恢复权限', link: '/admin/users', query: { status: 'disabled' }, icon: 'ban' },
    { label: '返回商城', desc: '查看前台商品与下单流程', link: '/', icon: 'arrow-right' },
  ];

  readonly stats = computed(() => {
    const users = this.users();
    const merchants = this.merchants();
    const now = new Date();
    const sixMonthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
    return {
      totalUsers: users.length,
      newUsers: users.filter((user) => new Date(user.createdAt).getTime() >= sixMonthStart).length,
      admins: users.filter((user) => user.role === 'admin').length,
      disabledUsers: users.filter((user) => user.status !== 'active').length,
      totalMerchants: merchants.length,
      pendingMerchants: merchants.filter((merchant) => merchant.status === 'pending').length,
      approvedMerchants: merchants.filter((merchant) => merchant.status === 'approved').length,
      rejectedMerchants: merchants.filter((merchant) => merchant.status === 'rejected').length,
    };
  });

  readonly registrations = computed(() => {
    const buckets = new Map<string, number>();
    for (const month of this.months) {
      buckets.set(monthKey(month), 0);
    }
    for (const user of this.users()) {
      const key = monthKey(new Date(user.createdAt));
      const value = buckets.get(key);
      if (value !== undefined) {
        buckets.set(key, value + 1);
      }
    }
    return this.months.map((month) => buckets.get(monthKey(month)) ?? 0);
  });
  readonly totalMonths = computed(() => sum(this.registrations()));

  readonly todayUsers = computed(() => {
    const key = dayKey(new Date());
    return this.users().filter((user) => dayKey(new Date(user.createdAt)) === key).length;
  });

  readonly previousUsers = computed(() => {
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 11, 1).getTime();
    return this.users().filter((user) => {
      const time = new Date(user.createdAt).getTime();
      return time >= previousStart && time < currentStart;
    }).length;
  });

  readonly usersDelta = computed(() => pctChange(this.stats().newUsers, this.previousUsers()));
  readonly approvedPct = computed(() => {
    const stats = this.stats();
    return stats.totalMerchants > 0 ? Math.round((stats.approvedMerchants / stats.totalMerchants) * 100) : 0;
  });
  readonly disabledPct = computed(() => {
    const stats = this.stats();
    return stats.totalUsers > 0 ? Math.round((stats.disabledUsers / stats.totalUsers) * 100) : 0;
  });

  readonly pendingHint = computed(() => {
    const pending = this.merchants().filter((merchant) => merchant.status === 'pending');
    if (pending.length === 0) {
      return '入驻申请已全部处理';
    }
    const oldest = pending
      .map((merchant) => new Date(merchant.appliedAt).getTime())
      .filter((time) => Number.isFinite(time))
      .sort((a, b) => a - b)[0];
    return '最早申请已等待 ' + (oldest ? daysSince(new Date(oldest).toISOString()) : 0) + ' 天';
  });

  readonly roles = computed<RoleSlice[]>(() => {
    const users = this.users();
    const total = Math.max(1, users.length);
    const rows = [
      { label: '会员', role: 'member', color: '#2D6CDF' },
      { label: '商家', role: 'merchant', color: '#E8A33D' },
      { label: '客服', role: 'support', color: '#5C6B5A' },
      { label: '管理员', role: 'admin', color: '#0B2545' },
    ];
    return rows.map((row) => {
      const count = users.filter((user) => user.role === row.role).length;
      return { label: row.label, count, pct: (count / total) * 100, color: row.color };
    });
  });

  readonly roleLabel = computed(() =>
    this.roles()
      .map((item) => item.label + ' ' + item.count + ' 个')
      .join('，'),
  );

  readonly recentUsers = computed(() =>
    [...this.users()]
      .filter((user) => Number.isFinite(new Date(user.createdAt).getTime()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
  );

  readonly pendingList = computed(() =>
    this.merchants()
      .filter((merchant) => merchant.status === 'pending')
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()),
  );

  readonly todos = computed<TodoItem[]>(() => {
    const stats = this.stats();
    return [
      {
        label: '待审核商家',
        value: stats.pendingMerchants,
        unit: '家',
        hint: stats.pendingMerchants > 0 ? this.pendingHint() : '入驻申请已全部处理',
        link: '/admin/merchants',
        icon: 'shield',
        tone: stats.pendingMerchants > 0 ? 'warning' : 'primary',
      },
      {
        label: '已禁用账号',
        value: stats.disabledUsers,
        unit: '个',
        hint: '复核后可恢复登录权限',
        link: '/admin/users',
        query: { status: 'disabled' },
        icon: 'ban',
        tone: stats.disabledUsers > 0 ? 'danger' : 'primary',
      },
      {
        label: '管理员账号',
        value: stats.admins,
        unit: '个',
        hint: '拥有平台全部管理权限',
        link: '/admin/users',
        query: { role: 'admin' },
        icon: 'user-check',
        tone: 'accent',
      },
    ];
  });

  readonly feed = computed<FeedItem[]>(() => {
    const entries: FeedItem[] = [];
    for (const user of this.users()) {
      entries.push({
        key: 'u' + user.id,
        title: '新账号注册 · ' + user.username,
        desc: user.name + ' · ' + user.email,
        time: user.createdAt,
        icon: 'user-check',
        tone: 'primary',
      });
    }
    for (const merchant of this.merchants()) {
      entries.push({
        key: 'm' + merchant.id,
        title: '入驻申请 · ' + merchant.name,
        desc: (merchant.category || '未填类目') + ' · ' + (merchant.contact || '未填联系人'),
        time: merchant.appliedAt,
        icon: 'store',
        tone: merchant.status === 'pending' ? 'accent' : merchant.status === 'approved' ? 'success' : 'muted',
        badge: merchant.status === 'pending' ? '待审核' : merchant.status === 'approved' ? '已通过' : '已驳回',
      });
    }
    return entries
      .filter((item) => Number.isFinite(new Date(item.time).getTime()))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 7);
  });

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
      users: this.api.users(),
      merchants: this.api.merchants(),
    }).subscribe({
      next: (result) => {
        if (seq !== this.seq) {
          return;
        }
        this.users.set(result.users ?? []);
        this.merchants.set(result.merchants ?? []);
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

  initial(value: string): string {
    return String(value || '?').trim().slice(0, 1).toUpperCase() || '?';
  }

  waitingDays(value: string): number {
    return daysSince(value);
  }

  relative(value: string): string {
    return relativeTime(value);
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

  private formatToday(): string {
    return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
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
