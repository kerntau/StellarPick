import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

interface FaqItem {
  id: string;
  q: string;
  a: string;
}

interface FaqGroup {
  key: string;
  id: string;
  label: string;
  items: FaqItem[];
}

interface FaqTab {
  key: string;
  label: string;
}

const FAQ_GROUPS: FaqGroup[] = [
  {
    key: 'guide',
    id: 'guide',
    label: '购物指南',
    items: [
      {
        id: 'g-search',
        q: '怎么快速找到想要的商品？',
        a: '在页头搜索框输入关键词，例如「保温杯」「四件套」，回车即可进入搜索结果页；也可以用分类导航按厨房、家居、个护、数码、出行、食品浏览。',
      },
      {
        id: 'g-cart',
        q: '加入购物车后在哪里结算？',
        a: '页头右上角的购物车图标会显示当前件数。进入购物车确认数量与优惠券后点「去结算」，选择收货地址和配送方式即可提交订单。',
      },
      {
        id: 'g-order',
        q: '提交订单后多久能看到订单？',
        a: '提交成功后会跳转到订单详情，个人中心的「我的订单」也会同步出现。演示环境的订单状态由后台模拟推进，不会产生真实交易。',
      },
      {
        id: 'g-level',
        q: '会员等级怎么计算？',
        a: '会员等级根据累计消费与活跃度划分，分为普通会员、星澜银卡、星澜金卡与星澜合伙人。等级越高，会员日折扣与积分倍率越高。',
      },
    ],
  },
  {
    key: 'shipping',
    id: 'shipping',
    label: '配送',
    items: [
      {
        id: 's-area',
        q: '配送范围与时效是怎样的？',
        a: '目前支持中国大陆大部分地区。标准配送预计 2–4 个工作日送达，次日达仅限部分城市。演示环境不会产生真实物流，运单信息为模拟数据。',
      },
      {
        id: 's-fee',
        q: '运费怎么计算？',
        a: '会员订单全年包邮，不限金额；非会员单笔满 99 元包邮，未满收取 8 元运费。偏远地区运费以结算页展示为准。',
      },
      {
        id: 's-address',
        q: '下单后可以修改收货地址吗？',
        a: '待发货状态可以联系客服修改；已发货后无法更改，可在订单详情的物流信息中联系配送方协商。演示环境的地址修改仅更新页面数据。',
      },
      {
        id: 's-tracking',
        q: '在哪里查看物流信息？',
        a: '订单详情页的物流区块会显示运单号与最新节点。演示数据为静态模拟，仅用于展示页面结构。',
      },
    ],
  },
  {
    key: 'return',
    id: 'return',
    label: '退换货',
    items: [
      {
        id: 'r-seven',
        q: '7 天无理由怎么计算？',
        a: '自签收次日起 7 个自然日内，商品保持完好、不影响二次销售即可申请退货。食品、个护等密封类商品拆封后不支持无理由退货。',
      },
      {
        id: 'r-refund',
        q: '退款多久到账？',
        a: '退货签收并审核通过后，退款将在 1–3 个工作日内原路退回。演示环境不会产生真实退款，页面只展示流程状态。',
      },
      {
        id: 'r-exchange',
        q: '换货流程是什么？',
        a: '在订单详情提交售后申请，选择换货并填写原因；客服确认后按指引寄回，仓库收到并验收后寄出新品。',
      },
      {
        id: 'r-exclude',
        q: '哪些商品不支持退换？',
        a: '已拆封的食品与个护用品、定制类商品，以及商品页明确标注「不支持 7 天无理由」的商品。',
      },
    ],
  },
  {
    key: 'invoice',
    id: 'invoice',
    label: '发票',
    items: [
      {
        id: 'i-how',
        q: '怎么申请开发票？',
        a: '提交订单时在「发票」一栏选择电子普通发票并填写抬头；订单完成后也可以在订单详情申请补开。',
      },
      {
        id: 'i-type',
        q: '支持哪些发票类型？',
        a: '演示环境支持电子普通发票与增值税普通发票；专用发票需要联系客服提交资质材料，演示环境不实际开具。',
      },
      {
        id: 'i-title',
        q: '发票抬头填错了怎么办？',
        a: '未开票的订单可以在订单详情修改抬头；已开票的订单需要联系客服作废后重新开具。',
      },
      {
        id: 'i-download',
        q: '电子发票在哪里下载？',
        a: '开票完成后，订单详情会出现下载入口。演示环境的发票为示例文件，不具备任何报销或税务效力。',
      },
    ],
  },
  {
    key: 'account',
    id: 'account',
    label: '账户与安全',
    items: [
      {
        id: 'a-password',
        q: '怎么修改登录密码？',
        a: '登录后进入个人中心 → 安全设置，输入当前密码与新密码即可。建议使用 8 位以上、同时包含大小写字母与数字的密码。',
      },
      {
        id: 'a-forgot',
        q: '忘记密码怎么办？',
        a: '演示环境不会发送找回邮件，可以联系客服协助，或由管理员在后台重置密码。',
      },
      {
        id: 'a-email',
        q: '修改邮箱需要验证吗？',
        a: '在个人中心提交新邮箱后会立即生效（演示环境不发送验证邮件），请确认输入正确后再保存。',
      },
      {
        id: 'a-security',
        q: '账号安全有什么建议？',
        a: '请勿在演示环境使用真实密码或真实邮箱；在公共电脑上使用后请退出登录，并清除浏览器本地存储中的登录令牌。',
      },
    ],
  },
];

const FAQ_TABS: FaqTab[] = [
  { key: 'all', label: '全部' },
  ...FAQ_GROUPS.map((group) => ({ key: group.key, label: group.label })),
];

@Component({
  selector: 'app-help-page',
  standalone: true,
  imports: [RouterLink, IconComponent, EmptyStateComponent],
  template: `
    <div class="sp-container help">
      <header class="head">
        <p class="sp-eyebrow">帮助中心</p>
        <h1>有什么可以帮你？</h1>
        <p class="sp-secondary">
          常见问题的答案都在这里。找不到时，随时提交工单，客服会在工作时间内回复。
        </p>
      </header>

      <div class="body">
      <div class="main">
      <form class="search" role="search" (submit)="$event.preventDefault()">
        <app-icon name="search" [size]="18" />
        <input id="faq-search" type="search" autocomplete="off" placeholder="搜索：运费、退款、发票、修改密码…"
               aria-label="搜索帮助内容" [value]="query()" (input)="onSearch($event)" />
        @if (query()) {
          <button class="clear" type="button" (click)="clear()" aria-label="清除搜索关键词">
            <app-icon name="x" [size]="16" />
          </button>
        }
      </form>

      <div class="sp-tabbar" role="tablist" aria-label="帮助分类">
        @for (tab of tabs; track tab.key; let i = $index) {
          <button type="button" role="tab" [id]="'tab-' + tab.key"
                  [attr.aria-selected]="active() === tab.key" aria-controls="faq-panel"
                  [tabindex]="active() === tab.key ? 0 : -1"
                  (click)="select(tab.key)" (keydown)="onTabKeydown($event, i)">{{ tab.label }}</button>
        }
      </div>

      <p class="count" role="status" aria-live="polite">{{ summary() }}</p>

      <div id="faq-panel" class="panel" role="tabpanel" [attr.aria-labelledby]="'tab-' + active()" tabindex="0">
        @if (total() === 0) {
          <app-empty-state title="没有找到相关帮助" image="search"
                           description="换个关键词试试，或直接联系客服，我们会尽快回复。"
                           actionLabel="清除搜索" (action)="clear()" />
          <p class="alt">也可以 <a class="sp-link" routerLink="/support/tickets">提交客服工单</a>。</p>
        } @else {
          @for (group of groups(); track group.key) {
            <section class="group" [id]="group.id" [attr.aria-labelledby]="group.id + '-title'">
              <h2 [id]="group.id + '-title'">{{ group.label }}</h2>
              <div class="faq-list">
                @for (item of group.items; track item.id) {
                  <div class="faq">
                    <h3>
                      <button type="button" [id]="'q-' + item.id" [attr.aria-expanded]="isOpen(item.id)"
                              [attr.aria-controls]="'a-' + item.id" (click)="toggle(item.id)">
                        <span>{{ item.q }}</span>
                        <app-icon [name]="isOpen(item.id) ? 'chevron-up' : 'chevron-down'" [size]="18" />
                      </button>
                    </h3>
                    <div class="answer" [id]="'a-' + item.id" role="region" [attr.aria-labelledby]="'q-' + item.id"
                         [hidden]="!isOpen(item.id)">
                      <p>{{ item.a }}</p>
                    </div>
                  </div>
                }
              </div>
            </section>
          }
        }
      </div>

      <section class="cta sp-card sp-card--pad" aria-labelledby="cta-title">
        <div>
          <h2 id="cta-title">还是没解决？</h2>
          <p>提交工单描述你的问题，客服会在工作时间内按顺序回复。</p>
        </div>
        <a class="sp-btn sp-btn--accent" routerLink="/support/tickets">联系客服</a>
      </section>
      </div>

      <aside class="rail" aria-label="常用入口">
        <section class="sp-card sp-card--pad" aria-labelledby="rail-links">
          <h2 id="rail-links">常用入口</h2>
          <ul class="rail-links">
            <li><a routerLink="/account/orders">订单与物流 <app-icon name="arrow-right" [size]="14" /></a></li>
            <li><a routerLink="/account/addresses">收货地址 <app-icon name="arrow-right" [size]="14" /></a></li>
            <li><a routerLink="/account/reviews">评价与晒单 <app-icon name="arrow-right" [size]="14" /></a></li>
            <li><a routerLink="/support/tickets">提交客服工单 <app-icon name="arrow-right" [size]="14" /></a></li>
          </ul>
        </section>
        <section class="sp-card sp-card--pad rail-note" aria-labelledby="rail-service">
          <h2 id="rail-service">客服时间</h2>
          <p>每日 9:00–21:00<br />工单通常在 24 小时内回复</p>
          <a class="sp-btn sp-btn--secondary sp-btn--block" href="tel:4000000000">400-000-0000</a>
        </section>
      </aside>
      </div>
    </div>
  `,
  styles: [`
    .help { padding-bottom: 64px; }
    .body { display: grid; grid-template-columns: minmax(0, 760px) 280px; gap: 48px; align-items: start; justify-content: space-between; }
    .main { min-width: 0; }
    .rail { position: sticky; top: calc(var(--sp-header-h) + 12px); display: flex; flex-direction: column; gap: 16px; }
    .rail h2 { font-size: 15px; margin-bottom: 8px; }
    .rail-links li + li { border-top: 1px solid var(--sp-border); }
    .rail-links a { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; font-size: 14px; color: var(--sp-text-secondary); }
    .rail-links a:hover { color: var(--sp-primary); }
    .rail-note p { font-size: 13px; line-height: 1.7; color: var(--sp-text-secondary); margin-bottom: 12px; }
    .head { padding: 32px 0 8px; max-width: 760px; }
    .head h1 { font-size: 32px; margin: 6px 0 10px; }
    .head p { font-size: 15px; line-height: 1.8; }

    .search {
      display: flex; align-items: center; gap: 8px; max-width: 640px; margin: 24px 0 12px;
      padding: 4px 6px 4px 14px; border: 1px solid var(--sp-border-strong); border-radius: 10px;
      background: var(--sp-surface); color: var(--sp-text-muted);
    }
    .search:focus-within { border-color: var(--sp-info); box-shadow: 0 0 0 1px var(--sp-info); }
    .search input {
      flex: 1; min-width: 0; height: 40px; border: 0; outline: 0;
      background: transparent; font-size: 15px; color: var(--sp-text);
    }
    .clear {
      width: 32px; height: 32px; flex: none; border: 0; border-radius: 50%;
      background: var(--sp-bg); color: var(--sp-text-secondary);
      display: inline-flex; align-items: center; justify-content: center;
    }
    .clear:hover { color: var(--sp-primary); }

    .sp-tabbar { margin-top: 8px; }
    .sp-tabbar button { font-size: 14px; }

    .count { margin: 16px 0 20px; font-size: 13px; color: var(--sp-text-secondary); }
    .panel:focus-visible { outline: 2px solid var(--sp-focus); outline-offset: 4px; border-radius: 8px; }

    .group { margin-bottom: 40px; scroll-margin-top: calc(var(--sp-header-h) + 16px); }
    .group h2 {
      font-size: 20px; margin-bottom: 14px; padding-bottom: 10px;
      border-bottom: 1px solid var(--sp-border);
    }
    .faq-list { display: flex; flex-direction: column; gap: 10px; }
    .faq {
      border: 1px solid var(--sp-border); border-radius: 8px;
      background: var(--sp-surface); overflow: hidden;
    }
    .faq h3 { margin: 0; font-size: 15px; }
    .faq button {
      width: 100%; min-height: 48px; display: flex; align-items: center; justify-content: space-between;
      gap: 16px; padding: 14px 18px; border: 0; background: transparent;
      text-align: left; font-size: 15px; font-weight: 600; color: var(--sp-text);
    }
    .faq button:hover { background: var(--sp-bg); }
    .faq button app-icon { flex: none; color: var(--sp-text-muted); }
    .answer { padding: 0 18px 16px; font-size: 15px; line-height: 1.8; color: var(--sp-text-secondary); }
    .answer[hidden] { display: none; }

    .alt { text-align: center; margin-top: -24px; margin-bottom: 32px; font-size: 14px; color: var(--sp-text-secondary); }

    .cta {
      display: flex; align-items: center; justify-content: space-between; gap: 24px;
      margin-top: 8px; background: var(--sp-primary); border-color: var(--sp-primary);
    }
    .cta h2 { color: #fff; font-size: 20px; margin-bottom: 6px; }
    .cta p { color: rgba(255, 255, 255, .75); font-size: 14px; }

    @media (max-width: 1023px) {
      .body { grid-template-columns: minmax(0, 1fr); gap: 24px; }
      .rail { position: static; }
    }
    @media (max-width: 767px) {
      .head h1 { font-size: 28px; }
      .cta { flex-direction: column; align-items: flex-start; }
      .cta .sp-btn { width: 100%; }
      .answer, .faq button { font-size: 14px; }
    }
  `],
})
export class HelpPage {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  readonly tabs = FAQ_TABS;
  readonly query = signal('');
  readonly active = signal('all');
  private readonly openIds = signal<ReadonlySet<string>>(new Set<string>());

  readonly groups = computed<FaqGroup[]>(() => {
    const keyword = this.query().trim().toLowerCase();
    const active = this.active();
    return FAQ_GROUPS
      .filter((group) => active === 'all' || group.key === active)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          !keyword || item.q.toLowerCase().includes(keyword) || item.a.toLowerCase().includes(keyword)),
      }))
      .filter((group) => group.items.length > 0);
  });

  readonly total = computed(() => this.groups().reduce((sum, group) => sum + group.items.length, 0));

  readonly summary = computed(() => {
    const keyword = this.query().trim();
    const count = this.total();
    if (keyword) {
      return count === 0
        ? '没有找到与「' + keyword + '」相关的帮助'
        : '找到 ' + count + ' 条与「' + keyword + '」相关的帮助';
    }
    return '共 ' + count + ' 条常见问题';
  });

  constructor() {
    this.title.setTitle('帮助中心 · 星澜优选');
    // React to same-page footer links (/help#shipping etc.), not just the
    // fragment present when the component is first created.
    this.route.fragment
      .pipe(startWith(this.route.snapshot.fragment), takeUntilDestroyed(this.destroyRef))
      .subscribe((fragment) => this.scrollToFragment(fragment));
  }

  private scrollToFragment(fragment: string | null): void {
    if (!fragment) {
      return;
    }
    const matched = FAQ_GROUPS.find((group) => group.id === fragment);
    if (matched) {
      this.active.set(matched.key);
    }
    setTimeout(() => document.getElementById(fragment)?.scrollIntoView({ block: 'start' }), 0);
  }

  isOpen(id: string): boolean {
    return this.openIds().has(id);
  }

  toggle(id: string): void {
    this.openIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  select(key: string): void {
    this.active.set(key);
    const group = FAQ_GROUPS.find((item) => item.key === key);
    if (!group) {
      return;
    }
    setTimeout(() => {
      const target = document.getElementById(group.id);
      if (!target) {
        return;
      }
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }, 0);
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
    this.select(this.tabs[next].key);
    document.getElementById('tab-' + this.tabs[next].key)?.focus();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    if (value.trim()) {
      this.active.set('all');
    }
  }

  clear(): void {
    this.query.set('');
    this.active.set('all');
    document.getElementById('faq-search')?.focus();
  }
}
