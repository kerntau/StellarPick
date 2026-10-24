import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

interface Benefit {
  icon: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-auth-brand-panel',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <aside class="brand sp-on-dark" aria-label="星澜优选会员权益">
      <!-- Wordmark text is the accessible name; aria-label here would hide it. -->
      <a class="logo" routerLink="/">
        <img src="/assets/sp/brand/logo-light.svg" alt="" width="40" height="40" />
        <span class="wordmark">
          <strong>星澜优选</strong>
          <small>STELLARPICK</small>
        </span>
      </a>

      <div class="brand-main">
        <p class="eyebrow">MEMBERSHIP</p>
        <p class="slogan">把日常，<br />选得更好</p>
        <p class="lead">会员制生活电商，精选厨房、家居、个护与出行好物。</p>

        <ul class="benefits">
          @for (benefit of benefits; track benefit.title) {
            <li>
              <span class="ico"><app-icon [name]="benefit.icon" [size]="18" /></span>
              <span class="text">
                <strong>{{ benefit.title }}</strong>
                <small>{{ benefit.desc }}</small>
              </span>
            </li>
          }
        </ul>
      </div>

      <p class="demo-note">
        <app-icon name="info" [size]="14" />
        <span>演示环境：账号、订单与优惠均为虚构数据，仅用于安全演练。</span>
      </p>
    </aside>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-width: 0; }
    .brand {
      position: relative;
      overflow: hidden;
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 32px;
      padding: 40px;
      background: var(--sp-primary);
      color: #fff;
      min-width: 0;
    }
    .brand::before,
    .brand::after {
      content: '';
      position: absolute;
      border: 1px solid rgba(255, 255, 255, .08);
      border-radius: 50%;
      pointer-events: none;
    }
    .brand::before { width: 320px; height: 320px; right: -120px; top: -100px; }
    .brand::after { width: 220px; height: 220px; left: -110px; bottom: -80px; }
    .logo { position: relative; display: inline-flex; align-items: center; gap: 12px; width: fit-content; }
    .logo img { flex: 0 0 auto; }
    .wordmark { display: flex; flex-direction: column; line-height: 1.2; }
    .wordmark strong { font-size: 18px; letter-spacing: .04em; color: #fff; }
    .wordmark small { font-size: 10px; letter-spacing: .22em; color: rgba(255, 255, 255, .6); }
    .brand-main { position: relative; display: flex; flex-direction: column; gap: 16px; margin: auto 0; }
    .eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .2em;
      color: var(--sp-accent-strong);
    }
    .slogan {
      font-size: clamp(28px, 3vw, 36px);
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -.02em;
      color: #fff;
    }
    .lead { color: rgba(255, 255, 255, .72); max-width: 360px; font-size: 14px; }
    .benefits { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
    .benefits li { display: flex; align-items: flex-start; gap: 12px; }
    .ico {
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      border-radius: 50%;
      background: rgba(232, 163, 61, .16);
      color: var(--sp-accent-strong);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .text strong { font-size: 14px; color: #fff; }
    .text small { font-size: 12px; line-height: 1.5; color: rgba(255, 255, 255, .64); }
    .demo-note {
      position: relative;
      margin-top: 0;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, .16);
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 12px;
      line-height: 1.5;
      color: rgba(255, 255, 255, .62);
    }
    .demo-note app-icon { flex: 0 0 auto; margin-top: 2px; color: var(--sp-accent-strong); }

    @media (max-width: 900px) {
      .brand { padding: 24px; gap: 16px; }
      .brand-main { margin: 0; gap: 10px; }
      .slogan { font-size: 24px; }
      .benefits { gap: 12px; }
    }
    /* 移动端品牌区排在表单之后，收成一块品牌卡片，不再抢占首屏。 */
    @media (max-width: 767px) {
      .brand { padding: 20px; gap: 12px; }
      .brand::before, .brand::after { display: none; }
      .lead, .benefits { display: none; }
      .slogan { font-size: 22px; }
      .demo-note { margin-top: 4px; padding-top: 12px; }
    }
  `],
})
export class AuthBrandPanelComponent {
  readonly benefits: Benefit[] = [
    { icon: 'tag', title: '会员专享价', desc: '每周三上新，会员价与积分同步累计' },
    { icon: 'truck', title: '满 99 元包邮', desc: '7 天无理由退换，售后有保障' },
    { icon: 'headset', title: '专属客服', desc: '工单直达，问题有人跟进' },
  ];
}

