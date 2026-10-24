import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { AdminIconComponent } from './components/admin-icon.component';

/**
 * 平台后台外壳：深色左侧导航 + 顶部标题「平台管理」+ Demo 徽标 + 内容区。
 * V06：这里不做任何角色判断/拦截，/admin 路由只有 authGuard；会员直接输入地址即可进入。
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AdminIconComponent],
  template: `
    <div class="admin-shell">
      <aside class="side">
        <!-- The brand text below is the accessible name; an aria-label would drop it. -->
        <a class="brand" routerLink="/">
          <img src="/assets/sp/brand/logo-light.svg" alt="" width="32" height="32" />
          <span class="brand-text">
            <strong>星澜优选</strong>
            <small>平台管理控制台</small>
          </span>
        </a>

        <p class="nav-label">平台管理</p>

        <nav class="side-nav" aria-label="平台后台导航">
          <a
            routerLink="/admin"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            #homeLink="routerLinkActive"
            [attr.aria-current]="homeLink.isActive ? 'page' : null"
          >
            <app-admin-icon name="home" [size]="18" />
            <span>后台首页</span>
          </a>
          <a
            routerLink="/admin/users"
            routerLinkActive="active"
            #usersLink="routerLinkActive"
            [attr.aria-current]="usersLink.isActive ? 'page' : null"
          >
            <app-admin-icon name="users" [size]="18" />
            <span>用户管理</span>
          </a>
          <a
            routerLink="/admin/merchants"
            routerLinkActive="active"
            #merchantsLink="routerLinkActive"
            [attr.aria-current]="merchantsLink.isActive ? 'page' : null"
          >
            <app-admin-icon name="store" [size]="18" />
            <span>商家审核</span>
          </a>
        </nav>

        <div class="side-foot">
          <p class="side-note">演示数据每日重置<br />仅用于产品流程体验</p>
          <a class="back" routerLink="/">
            <app-admin-icon name="arrow-right" [size]="16" />
            <span>返回商城</span>
          </a>
        </div>
      </aside>

      <div class="work">
        <header class="topbar">
          <div class="topbar-inner">
            <div class="title">
              <p class="crumb">平台管理 / {{ section() }}</p>
              <h1>平台管理</h1>
            </div>
            <span class="today sp-num">{{ todayLabel }}</span>
            <span class="demo">Demo 演示环境</span>
            <span class="who">
              <app-admin-icon name="shield-check" [size]="16" />
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
    .admin-shell {
      position: relative;
      display: grid;
      grid-template-columns: 240px minmax(0, 1fr);
      min-height: calc(100vh - var(--sp-header-h));
      background: var(--sp-bg);
    }
    .admin-shell::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 240px;
      background: linear-gradient(180deg, var(--sp-primary) 0%, var(--sp-primary-deep) 100%);
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
      gap: 24px;
      padding: 24px 16px;
      color: #fff;
      z-index: 1;
    }
    .brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px; color: #fff; }
    .brand img { border-radius: 9px; flex: none; }
    .brand-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
    .brand-text strong { font-size: 16px; letter-spacing: .02em; }
    .brand-text small { font-size: 11px; color: rgba(255, 255, 255, .6); margin-top: 3px; }

    .nav-label { padding: 0 12px; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(255, 255, 255, .5); }
    .side-nav { display: flex; flex-direction: column; gap: 4px; }
    .side-nav a {
      display: flex; align-items: center; gap: 10px;
      min-height: 44px; padding: 0 12px; border-radius: var(--sp-radius-md);
      font-size: var(--sp-text-14); color: rgba(255, 255, 255, .74);
      transition: background-color .15s ease, color .15s ease;
    }
    .side-nav a:hover { background: rgba(255, 255, 255, .08); color: #fff; }
    .side-nav a.active {
      background: rgba(232, 163, 61, .16);
      color: #fff;
      font-weight: 600;
      box-shadow: inset 3px 0 0 var(--sp-accent);
    }

    .side-foot { margin-top: auto; display: flex; flex-direction: column; gap: 12px; padding: 0 8px; }
    .side-note { font-size: 11px; line-height: 1.6; color: rgba(255, 255, 255, .45); }
    .back {
      display: inline-flex; align-items: center; gap: 6px; min-height: 44px;
      font-size: 13px; color: rgba(255, 255, 255, .78);
    }
    .back:hover { color: var(--sp-accent-strong); }

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
      padding: 16px 32px;
    }
    .title h1 { font-size: 22px; }
    .crumb { margin-bottom: 2px; font-size: var(--sp-text-12); color: var(--sp-text-muted); }
    .today { margin-left: auto; font-size: var(--sp-text-12); color: var(--sp-text-muted); white-space: nowrap; }
    .demo {
      display: inline-flex; align-items: center;
      padding: 3px 10px; border-radius: var(--sp-radius-pill);
      background: #FBF0DC; color: var(--sp-accent-text);
      font-size: var(--sp-text-12); font-weight: 700; letter-spacing: .02em;
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
      .admin-shell { grid-template-columns: 1fr; }
      .admin-shell::before { display: none; }
      .side {
        position: static;
        height: auto;
        overflow: visible;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: linear-gradient(180deg, var(--sp-primary) 0%, var(--sp-primary-deep) 100%);
      }
      .brand { padding: 4px; }
      .brand-text small { display: none; }
      .side-nav { grid-column: 1 / -1; flex-direction: row; overflow-x: auto; width: 100%; gap: 6px; padding-bottom: 2px; }
      .side-nav a { white-space: nowrap; padding: 0 12px; }
      .side-foot { display: none; }
      .nav-label { display: none; }
      .back { display: inline-flex; }
      .topbar { position: static; }
      .topbar-inner { flex-wrap: wrap; padding: 14px 16px; gap: 10px; }
      .content { padding: 16px 16px 40px; }
      .who { margin-left: 0; width: 100%; }
    }

    @media (max-width: 767px) {
      .title h1 { font-size: 18px; }
      .title p { font-size: 11px; }
      .demo { margin-left: auto; font-size: 11px; padding: 2px 8px; }
      .today { display: none; }
      .who { display: none; }
    }
  `],
})
export class AdminLayout {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly section = signal('后台首页');
  readonly todayLabel = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });

  private readonly sections = [
    { prefix: '/admin/users', label: '用户管理' },
    { prefix: '/admin/merchants', label: '商家审核' },
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
    this.section.set(hit ? hit.label : '后台首页');
  }
}
