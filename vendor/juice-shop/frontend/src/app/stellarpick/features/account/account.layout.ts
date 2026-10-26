import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { BreadcrumbComponent, Crumb } from '../../shared/ui/breadcrumb/breadcrumb.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { normalizeAvatar } from './components/account-avatar';

interface AccountNavItem {
  label: string;
  link: string;
  icon: string;
  exact?: boolean;
}

@Component({
  selector: 'app-account-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BreadcrumbComponent, IconComponent],
  template: `
    <div class="sp-container account-page">
      <app-breadcrumb [items]="crumbs()" />

      <div class="shell">
        <aside class="side">
          <div class="member-card sp-on-dark">
            <div class="member-top">
              <img
                class="avatar"
                [src]="avatar()"
                [alt]="displayName() + '的头像'"
                width="56"
                height="56"
                loading="lazy"
              />
              <div class="who">
                <strong class="name sp-clamp-1">{{ displayName() }}</strong>
                <span class="member-tier">{{ level() }}</span>
              </div>
            </div>
            <p class="mail sp-clamp-1">{{ auth.user()?.email || '未绑定邮箱' }}</p>
            <div class="member-meta">
              <span>STELLAR MEMBER</span>
              <span class="sp-num">{{ memberNo() }}</span>
            </div>
          </div>

          <nav class="side-nav" aria-label="个人中心导航">
            @for (item of nav; track item.link) {
              <a
                [routerLink]="item.link"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                ariaCurrentWhenActive="page"
              >
                <app-icon [name]="item.icon" [size]="18" />
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>

          <div class="perk">
            <div class="perk-head">
              <p class="perk-title"><app-icon name="sparkles" [size]="15" /> 会员日</p>
              <span class="perk-date">每月 8 日</span>
            </div>
            <p class="perk-main">每满 300 减 40</p>
            <p class="perk-sub">全年包邮 · 专属客服 · 积分可抵现</p>
            <a class="perk-link" routerLink="/about" fragment="member">
              查看会员权益 <app-icon name="arrow-right" [size]="14" />
            </a>
          </div>

          <div class="service-card">
            <p class="service-title"><app-icon name="headset" [size]="15" /> 客服在线</p>
            <p class="service-time">9:00–21:00 · 400-000-0000</p>
            <a class="service-link" routerLink="/support/tickets">联系客服 <app-icon name="arrow-right" [size]="13" /></a>
          </div>
        </aside>

        <section class="panel" aria-label="个人中心内容">
          <router-outlet />
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .account-page { padding-bottom: 64px; }
      .shell {
        display: grid;
        grid-template-columns: 248px minmax(0, 1fr);
        gap: 32px;
        align-items: start;
        padding-top: 8px;
        min-width: 0;
      }

      .side {
        position: sticky;
        top: calc(var(--sp-header-h) + 12px);
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .member-card {
        position: relative;
        overflow: hidden;
        padding: 18px;
        border-radius: var(--sp-radius-md);
        background: var(--sp-primary);
        border: 1px solid var(--sp-primary-deep);
        box-shadow: var(--sp-shadow-md);
      }
      .member-card::after {
        content: '';
        position: absolute;
        right: -36px;
        bottom: -52px;
        width: 132px;
        height: 132px;
        border-radius: 50%;
        border: 1px solid rgba(232, 163, 61, .28);
        box-shadow: 0 0 0 18px rgba(232, 163, 61, .06);
        pointer-events: none;
      }
      .member-top { display: flex; align-items: center; gap: 12px; min-width: 0; position: relative; z-index: 1; }
      .avatar {
        width: 56px; height: 56px; border-radius: 50%;
        object-fit: cover; background: var(--sp-bg);
        border: 2px solid rgba(255, 255, 255, .28); flex: 0 0 auto;
      }
      .who { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1 1 120px; }
      .name { font-size: var(--sp-text-16); line-height: 1.3; color: #fff; }
      .member-tier {
        align-self: flex-start;
        padding: 1px 8px;
        border-radius: var(--sp-radius-pill);
        background: rgba(232, 163, 61, .16);
        border: 1px solid rgba(232, 163, 61, .38);
        color: var(--sp-accent-strong);
        font-size: 11px;
        font-weight: 600;
        line-height: 1.6;
      }
      .mail {
        position: relative;
        z-index: 1;
        margin-top: 12px;
        font-size: var(--sp-text-12);
        color: rgba(255, 255, 255, .74);
        max-width: 100%;
      }
      .member-meta {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, .16);
        font-size: 9.5px;
        letter-spacing: .14em;
        color: rgba(255, 255, 255, .7);
      }

      .side-nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        width: 100%;
        padding: 6px;
        border: 1px solid var(--sp-border);
        border-radius: var(--sp-radius-md);
        background: var(--sp-surface);
        box-shadow: var(--sp-shadow-sm);
      }
      .side-nav a {
        display: flex; align-items: center; gap: 10px;
        min-height: 44px; padding: 0 10px;
        border-radius: var(--sp-radius-sm);
        color: var(--sp-text-secondary);
        font-size: var(--sp-text-14);
        border: 1px solid transparent;
      }
      .side-nav a:hover { background: var(--sp-bg); color: var(--sp-primary); }
      .side-nav a.active {
        background: var(--sp-primary);
        border-color: var(--sp-primary);
        color: #fff;
        font-weight: 600;
      }
      .side-nav a.active app-icon { color: var(--sp-accent-strong); }

      .perk {
        border: 1px solid #F3E3C4;
        border-radius: var(--sp-radius-md);
        background: #FFFDF8;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .perk-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .perk-title {
        display: flex; align-items: center; gap: 6px;
        font-size: var(--sp-text-12); font-weight: 700;
        color: var(--sp-accent-text); letter-spacing: .02em;
      }
      .perk-date {
        padding: 0 6px;
        border-radius: 3px;
        background: #FBF0DC;
        color: var(--sp-accent-text);
        font-size: 10px;
        font-weight: 700;
        line-height: 1.7;
      }
      .perk-main { font-size: var(--sp-text-14); font-weight: 700; color: var(--sp-primary); }
      .perk-sub { font-size: var(--sp-text-12); color: var(--sp-text-muted); line-height: 1.5; }
      .perk-link {
        display: inline-flex; align-items: center; gap: 4px;
        margin-top: 6px; min-height: 44px; font-size: var(--sp-text-12);
        font-weight: 600; color: var(--sp-info);
      }
      .perk-link:hover { text-decoration: underline; }

      .service-card {
        border: 1px solid var(--sp-border);
        border-radius: var(--sp-radius-md);
        background: var(--sp-surface);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .service-title { display: flex; align-items: center; gap: 6px; font-size: var(--sp-text-12); font-weight: 700; color: var(--sp-sage); }
      .service-time { font-size: var(--sp-text-12); color: var(--sp-text-secondary); }
      .service-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; min-height: 44px; font-size: var(--sp-text-12); font-weight: 600; color: var(--sp-info); }
      .service-link:hover { text-decoration: underline; }

      .panel { min-width: 0; }

      @media (max-width: 1023px) {
        .shell { grid-template-columns: 208px minmax(0, 1fr); gap: 20px; }
        .member-card { padding: 14px; }
        .avatar { width: 46px; height: 46px; }
        .perk, .service-card { padding: 12px; }
      }

      @media (max-width: 767px) {
        .shell { grid-template-columns: 1fr; gap: 16px; }
        .side {
          position: static;
          gap: 10px;
          min-width: 0;
          overflow: hidden;
        }
        .member-card { padding: 14px 16px; }
        .member-top { align-items: center; }
        .avatar { width: 44px; height: 44px; }
        .who { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 4px 8px; flex: 1 1 auto; }
        .mail { margin-top: 8px; }
        .member-meta { margin-top: 10px; padding-top: 8px; }
        .side-nav {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          padding: 6px;
        }
        .side-nav a {
          min-height: 44px;
          padding: 0 6px;
          gap: 6px;
          justify-content: center;
          border: 1px solid var(--sp-border);
          border-radius: var(--sp-radius-sm);
          background: var(--sp-surface);
          font-size: var(--sp-text-12);
          white-space: nowrap;
        }
        .side-nav a app-icon { width: 16px; height: 16px; }
        .side-nav a.active { border-color: var(--sp-primary); }
        .perk { display: none; }
        .service-card { display: none; }
      }
    `,
  ],
})
export class AccountLayout {
  private readonly router = inject(Router);
  readonly auth = inject(AuthStore);

  readonly nav: AccountNavItem[] = [
    { label: '个人中心', link: '/account', icon: 'user', exact: true },
    { label: '账户资料', link: '/account/profile', icon: 'user-check' },
    { label: '收货地址', link: '/account/addresses', icon: 'map-pin' },
    { label: '我的订单', link: '/account/orders', icon: 'package' },
    { label: '我的评价', link: '/account/reviews', icon: 'star' },
    { label: '客服工单', link: '/support/tickets', icon: 'headset' },
  ];

  private readonly path = signal(this.currentPath());
  readonly displayName = computed(() => this.auth.user()?.name || '星澜会员');
  readonly level = computed(() => this.auth.user()?.level || '星澜会员');
  readonly avatar = computed(() => normalizeAvatar(this.auth.user()?.avatar));
  readonly memberNo = computed(() => 'SP-' + String(this.auth.user()?.id ?? 0).padStart(6, '0'));

  readonly crumbs = computed<Crumb[]>(() => {
    const path = this.path();
    const current = this.crumbLabel(path);
    if (current === '个人中心') {
      return [
        { label: '首页', link: '/' },
        { label: '个人中心' },
      ];
    }
    return [
      { label: '首页', link: '/' },
      { label: '个人中心', link: '/account' },
      { label: current },
    ];
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.path.set(this.currentPath()));

    // /rest/user/whoami answers {} for Bearer sessions, so it must not be used
    // here: it would overwrite the token identity with empty fields. Repair the
    // doubled profileImage prefix instead so the header and sidebar agree.
    const current = this.auth.user();
    const avatar = normalizeAvatar(current?.avatar);
    if (current && current.avatar !== avatar) {
      this.auth.merge({ avatar });
    }
  }

  private currentPath(): string {
    return this.router.url.split('?')[0].split('#')[0];
  }

  private crumbLabel(path: string): string {
    if (path.startsWith('/account/orders/')) {
      return '订单详情';
    }
    switch (path) {
      case '/account/addresses':
        return '收货地址';
      case '/account/orders':
        return '我的订单';
      case '/account/reviews':
        return '我的评价';
      case '/account/profile':
        return '账户资料';
      default:
        return '个人中心';
    }
  }
}
