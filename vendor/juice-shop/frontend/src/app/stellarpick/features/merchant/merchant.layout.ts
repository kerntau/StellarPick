import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { MerchantIconComponent } from './components/merchant-icon.component';

/** 商家中心外壳：店铺信息 + 左侧导航 + 返回商城。 */
@Component({
  selector: 'app-merchant-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MerchantIconComponent],
  template: `
    <div class="merchant-shell">
      <aside class="side">
        <div class="store">
          <img src="/assets/sp/brand/logo-light.svg" alt="" width="36" height="36" />
          <div class="store-text">
            <strong>星澜自营旗舰店</strong>
            <small>STELLARPICK 官方店铺</small>
          </div>
          <span class="verified">已认证</span>
        </div>

        <p class="nav-label">店铺运营</p>

        <nav class="side-nav" aria-label="商家中心导航">
          <a
            routerLink="/merchant"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            #homeLink="routerLinkActive"
            [attr.aria-current]="homeLink.isActive ? 'page' : null"
          >
            <app-merchant-icon name="home" [size]="18" />
            <span>工作台</span>
          </a>
          <a
            routerLink="/merchant/products"
            routerLinkActive="active"
            #productsLink="routerLinkActive"
            [attr.aria-current]="productsLink.isActive ? 'page' : null"
          >
            <app-merchant-icon name="package" [size]="18" />
            <span>商品管理</span>
          </a>
          <a
            routerLink="/merchant/orders"
            routerLinkActive="active"
            #ordersLink="routerLinkActive"
            [attr.aria-current]="ordersLink.isActive ? 'page' : null"
          >
            <app-merchant-icon name="file-text" [size]="18" />
            <span>订单管理</span>
          </a>
        </nav>

        <div class="side-note">
          <p>演示数据每日重置<br />仅用于产品流程体验</p>
        </div>

        <a class="back" routerLink="/" aria-label="返回商城">
          <app-merchant-icon name="arrow-left" [size]="16" />
          <span>返回商城</span>
        </a>
      </aside>

      <div class="work">
        <header class="topbar">
          <div class="topbar-inner">
            <div class="title">
              <p class="crumb">商家中心 / {{ section() }}</p>
              <h1>商家中心</h1>
            </div>
            <span class="today sp-num">{{ todayLabel }}</span>
            <span class="demo">Demo 演示环境</span>
            <span class="who">
              <app-merchant-icon name="user" [size]="16" />
              <span class="who-label">当前登录：</span>{{ auth.user()?.name || '未登录' }}
            </span>
          </div>
        </header>

        <div class="content">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .merchant-shell {
      position: relative;
      display: grid;
      grid-template-columns: 248px minmax(0, 1fr);
      min-height: calc(100vh - var(--sp-header-h));
      background: var(--sp-bg);
    }
    .merchant-shell::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 248px;
      background: var(--sp-surface);
      border-right: 1px solid var(--sp-border);
      z-index: 0;
    }

    .side {
      position: sticky;
      top: var(--sp-header-h);
      align-self: start;
      height: calc(100vh - var(--sp-header-h));
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 20px 16px;
      z-index: 1;
    }

    .store {
      display: flex; align-items: center; gap: 8px;
      padding: 10px; border-radius: var(--sp-radius-md);
      background: linear-gradient(135deg, var(--sp-primary) 0%, var(--sp-primary-soft) 100%);
      color: #fff;
    }
    .store img { border-radius: 9px; flex: none; }
    .store-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
    .store-text strong { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .store-text small { font-size: 10px; color: rgba(255, 255, 255, .6); margin-top: 3px; letter-spacing: .04em; }
    .verified {
      margin-left: auto; flex: none;
      padding: 2px 5px; border-radius: var(--sp-radius-pill);
      background: rgba(232, 163, 61, .18); color: var(--sp-accent-strong);
      font-size: 9px; font-weight: 700;
    }

    .nav-label { padding: 0 12px; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--sp-text-muted); }
    .side-nav { display: flex; flex-direction: column; gap: 4px; }
    .side-nav a {
      display: flex; align-items: center; gap: 10px;
      min-height: 44px; padding: 0 12px; border-radius: var(--sp-radius-md);
      font-size: var(--sp-text-14); color: var(--sp-text-secondary);
      transition: background-color .15s ease, color .15s ease;
    }
    .side-nav a:hover { background: var(--sp-bg); color: var(--sp-primary); }
    .side-nav a.active {
      background: var(--sp-info-soft);
      color: var(--sp-primary);
      font-weight: 600;
      box-shadow: inset 3px 0 0 var(--sp-accent);
    }

    .side-note { margin-top: auto; padding: 0 12px; }
    .side-note p { font-size: 11px; line-height: 1.6; color: var(--sp-text-muted); }

    .back {
      display: inline-flex; align-items: center; gap: 8px;
      min-height: 44px; padding: 0 12px; border-radius: var(--sp-radius-md);
      font-size: var(--sp-text-13); color: var(--sp-text-secondary);
    }
    .back:hover { background: var(--sp-bg); color: var(--sp-primary); }

    .work { min-width: 0; display: flex; flex-direction: column; z-index: 1; }
    /* 抽屉/弹窗打开时抬升内容层，避免站点头部（z-index 60）遮住弹层标题。 */
    .work:has(.overlay) { z-index: 200; }
    .topbar {
      position: sticky;
      top: var(--sp-header-h);
      z-index: 20;
      background: var(--sp-surface);
      border-bottom: 1px solid var(--sp-border);
    }
    .topbar-inner {
      display: flex;
      align-items: center;
      gap: 16px;
      width: 100%;
      max-width: 1360px;
      margin: 0 auto;
      padding: 14px 32px;
    }
    .crumb { font-size: var(--sp-text-12); color: var(--sp-text-muted); margin-bottom: 2px; }
    .title h1 { font-size: 22px; }
    .today { margin-left: auto; font-size: var(--sp-text-12); color: var(--sp-text-muted); white-space: nowrap; }
    .demo {
      display: inline-flex; align-items: center; margin-left: 0;
      padding: 3px 10px; border-radius: var(--sp-radius-pill);
      background: #FBF0DC; color: var(--sp-accent-text);
      font-size: var(--sp-text-12); font-weight: 700;
      flex: none;
    }
    .who {
      margin-left: 0;
      display: inline-flex; align-items: center; gap: 6px;
      font-size: var(--sp-text-13); color: var(--sp-text-secondary);
      white-space: nowrap; min-width: 0;
    }

    .content {
      width: 100%;
      max-width: 1360px;
      margin: 0 auto;
      padding: 24px 32px 48px;
    }

    @media (max-width: 1023px) {
      .merchant-shell { grid-template-columns: 1fr; }
      .merchant-shell::before { display: none; }
      .side {
        position: static;
        height: auto;
        overflow: visible;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        padding: 12px 16px;
        background: var(--sp-surface);
        border-bottom: 1px solid var(--sp-border);
      }
      .store { grid-column: 1; grid-row: 1; padding: 8px 10px; }
      .side-nav { grid-column: 1 / -1; grid-row: 2; flex-direction: row; width: 100%; overflow-x: auto; gap: 6px; padding-bottom: 2px; }
      .side-nav a { white-space: nowrap; padding: 0 12px; }
      .side-note { display: none; }
      .nav-label { display: none; }
      .back {
        grid-column: 2; grid-row: 1; margin: 0; align-self: center; justify-content: center;
        width: 44px; min-height: 44px; padding: 0; border: 1px solid var(--sp-border);
      }
      .back span { display: none; }
      .topbar { position: static; }
      .topbar-inner { flex-wrap: wrap; padding: 12px 16px; gap: 8px; }
      .content { padding: 16px 16px 40px; }
      .who { margin-left: 0; width: 100%; }
    }

    @media (max-width: 767px) {
      .title h1 { font-size: 18px; }
      .title .crumb { font-size: 11px; }
      .demo { margin-left: auto; font-size: 11px; padding: 2px 8px; }
      .today { display: none; }
      .who { display: none; }
      .store-text small { display: none; }
    }
  `],
})
export class MerchantLayout {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly section = signal('工作台');
  readonly todayLabel = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });

  private readonly sections = [
    { prefix: '/merchant/products', label: '商品管理' },
    { prefix: '/merchant/orders', label: '订单管理' },
  ];

  constructor() {
    this.sync(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.sync(event.urlAfterRedirects));
  }

  private sync(url: string): void {
    const path = url.split('?')[0].split('#')[0];
    const hit = this.sections.find((item) => path === item.prefix || path.startsWith(item.prefix + '/'));
    this.section.set(hit ? hit.label : '工作台');
  }
}
