import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../ui/icon/icon.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <footer class="footer sp-on-dark">
      <div class="sp-container">
        <section class="letter" id="newsletter" aria-labelledby="letter-title">
          <div class="letter-copy">
            <p class="letter-kicker">选品信 · 每周四</p>
            <h2 id="letter-title">把这一周的好物，写成一封信</h2>
            <p>新品试用记录、补货提醒与会员日清单，只在你需要的时候出现。</p>
          </div>
          <div class="letter-side">
            <form class="letter-form" (submit)="subscribe($event)" novalidate>
              <label class="sp-sr-only" for="footer-email">邮箱地址</label>
              <input
                id="footer-email"
                type="email"
                name="email"
                autocomplete="email"
                [value]="email()"
                (input)="onEmail($event)"
                placeholder="you@example.com" />
              <button class="sp-btn sp-btn--accent" type="submit">订阅</button>
            </form>
            @if (subscribed()) {
              <p class="letter-note is-done" role="status">已订阅，下一封信周四见。</p>
            } @else {
              <p class="letter-note">订阅即表示同意隐私政策，随时可退订。</p>
            }
          </div>
        </section>

        <div class="cols">
          <div class="brand">
            <a class="logo" routerLink="/">
              <img src="/assets/sp/brand/logo-light.svg" alt="" width="36" height="36" />
              <span>星澜优选</span>
            </a>
            <p class="slogan">把日常，选得更好</p>
            <p class="desc">面向年轻家庭的精选生活好物平台。每一件商品都经过选品团队实测，可溯源、不过度包装。</p>
            <div class="contact">
              <span><app-icon name="phone" [size]="14" /> 客服 400-000-0000 · 每日 9:00–21:00</span>
              <span><app-icon name="mail" [size]="14" /> service@stellarpick.example</span>
              <span><app-icon name="map-pin" [size]="14" /> 上海市徐汇区星澜路 88 号 · 门店 10:00–22:00</span>
            </div>
          </div>
          <nav aria-label="关于星澜优选">
            <h2>关于</h2>
            <a routerLink="/about">品牌故事</a>
            <a routerLink="/about" fragment="member">会员权益</a>
            <a routerLink="/about" fragment="service">服务保障</a>
            <a routerLink="/help">帮助中心</a>
          </nav>
          <nav aria-label="购物帮助">
            <h2>帮助</h2>
            <a routerLink="/help" fragment="shipping">配送说明</a>
            <a routerLink="/help" fragment="return">退换货政策</a>
            <a routerLink="/help" fragment="invoice">发票与报销</a>
            <a routerLink="/support/tickets">联系客服</a>
          </nav>
          <nav aria-label="条款与合规">
            <h2>条款</h2>
            <a routerLink="/terms">服务条款</a>
            <a routerLink="/privacy">隐私政策</a>
            <a routerLink="/about">资质与备案</a>
            <a routerLink="/about" fragment="contact">联系我们</a>
          </nav>
        </div>

        <ul class="trust" aria-label="服务承诺">
          <li><app-icon name="shield" [size]="16" /> 正品保障 · 品牌直供</li>
          <li><app-icon name="refresh" [size]="16" /> 7 天无理由退换</li>
          <li><app-icon name="truck" [size]="16" /> 满 99 元包邮 · 次日达</li>
          <li><app-icon name="lock" [size]="16" /> 支付与隐私加密</li>
        </ul>

        <div class="pay">
          <span class="pay-label">支持支付</span>
          <ul class="pay-list">
            <li><app-icon name="credit-card" [size]="14" /> 银行卡</li>
            <li><app-icon name="smartphone" [size]="14" /> 移动支付</li>
            <li><app-icon name="package" [size]="14" /> 货到付款</li>
            <li><app-icon name="store" [size]="14" /> 企业转账</li>
          </ul>
          <span class="pay-note">演示环境，不会产生真实扣款</span>
        </div>

        <div class="bottom">
          <p>星澜优选 Demo · 演示备案号 XLP-DEMO-2026 · 客服 400-000-0000 · 上海市徐汇区星澜路 88 号</p>
          <span class="demo">Demo 演示环境 · 全部品牌与数据均为虚构</span>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer {
      background: #071A33;
      color: rgba(255, 255, 255, 0.76);
      padding: 0 0 28px;
      margin-top: 48px;
    }

    /* ---------- subscribe band ---------- */
    .letter {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      gap: 32px;
      align-items: center;
      padding: 36px 0 32px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }

    .letter-kicker {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: var(--sp-accent);
    }

    .letter h2 {
      margin-top: 8px;
      color: #fff;
      font-family: var(--sp-serif);
      font-weight: 600;
      font-size: 24px;
      line-height: 1.35;
      letter-spacing: .01em;
    }

    .letter-copy p:last-child {
      margin-top: 8px;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.72);
      max-width: 44ch;
    }

    .letter-side { display: flex; flex-direction: column; gap: 8px; }

    .letter-form {
      display: flex;
      gap: 8px;
      padding: 5px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: var(--sp-radius-pill);
      background: rgba(255, 255, 255, 0.06);
    }

    .letter-form:focus-within {
      border-color: var(--sp-accent);
      box-shadow: 0 0 0 3px rgba(232, 163, 61, 0.22);
    }

    .letter-form input {
      flex: 1 1 auto;
      min-width: 0;
      height: 40px;
      padding: 0 14px;
      border: 0;
      border-radius: var(--sp-radius-pill);
      background: transparent;
      color: #fff;
      font-size: 14px;
    }

    .letter-form input::placeholder { color: rgba(255, 255, 255, 0.55); }

    .letter-form .sp-btn {
      flex: 0 0 auto;
      border-radius: var(--sp-radius-pill);
      min-height: 40px;
    }

    .letter-note {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.62);
    }

    .letter-note.is-done { color: var(--sp-accent); }

    /* ---------- link columns ---------- */
    .cols {
      display: grid;
      grid-template-columns: 1.6fr 1fr 1fr 1fr;
      gap: 40px;
      padding: 40px 0 32px;
    }

    .logo {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #fff;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: .04em;
    }

    .slogan {
      color: var(--sp-accent);
      font-size: 12px;
      letter-spacing: .16em;
      margin-top: 12px;
    }

    .desc {
      font-size: 12.5px;
      line-height: 1.75;
      margin-top: 8px;
      max-width: 330px;
      color: rgba(255, 255, 255, 0.72);
    }

    .contact {
      display: flex;
      flex-direction: column;
      gap: 7px;
      margin-top: 16px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.72);
    }

    .contact span { display: inline-flex; align-items: flex-start; gap: 6px; }
    .contact app-icon { color: var(--sp-accent); flex: 0 0 auto; margin-top: 1px; }

    nav { display: flex; flex-direction: column; gap: 9px; font-size: 13px; }

    /* h2 keeps the document outline sequential; the visual size stays 13px. */
    nav h2 {
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      line-height: var(--sp-lh-title);
      letter-spacing: .06em;
      margin-bottom: 5px;
    }

    nav a { color: rgba(255, 255, 255, 0.72); min-height: 22px; }
    nav a:hover { color: var(--sp-accent); }

    /* ---------- trust / payment ---------- */
    .trust {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 28px;
      padding: 18px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.76);
    }

    .trust li { display: inline-flex; align-items: center; gap: 7px; }
    .trust app-icon { color: var(--sp-accent); }

    .pay {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      padding: 14px 0 18px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 12px;
    }

    .pay-label { color: rgba(255, 255, 255, 0.6); letter-spacing: .08em; }

    .pay-list { display: flex; flex-wrap: wrap; gap: 8px; }

    .pay-list li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 28px;
      padding: 0 12px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.82);
    }

    .pay-note { margin-left: auto; color: rgba(255, 255, 255, 0.52); }

    .bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      padding-top: 18px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
    }

    .demo {
      border: 1px solid rgba(232, 163, 61, 0.5);
      color: var(--sp-accent);
      border-radius: 999px;
      padding: 2px 10px;
    }

    @media (max-width: 1023px) {
      .letter { grid-template-columns: minmax(0, 1fr); gap: 18px; padding: 28px 0 26px; }
      .letter h2 { font-size: 21px; }
      .cols { grid-template-columns: 1fr 1fr; gap: 28px; padding: 32px 0 24px; }
      .brand { grid-column: 1 / -1; }
      .pay-note { margin-left: 0; }
    }

    @media (max-width: 767px) {
      .footer { padding-bottom: 24px; margin-top: 32px; }
      .cols { grid-template-columns: 1fr; gap: 24px; }
      .letter-form { flex-direction: column; border-radius: var(--sp-radius-md); padding: 8px; }
      .letter-form input { border-radius: var(--sp-radius-sm); background: rgba(255, 255, 255, 0.04); }
      .letter-form .sp-btn { width: 100%; }
      .trust { gap: 10px 18px; }
    }
  `],
})
export class FooterComponent {
  readonly email = signal('');
  readonly subscribed = signal(false);

  onEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.subscribed.set(false);
  }

  /** Demo only: there is no mailing backend, so the form acknowledges locally. */
  subscribe(event: Event): void {
    event.preventDefault();
    const value = this.email().trim();
    if (!value || !value.includes('@')) {
      this.subscribed.set(false);
      return;
    }
    this.subscribed.set(true);
    this.email.set('');
  }
}
