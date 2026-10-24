import { Component, output } from '@angular/core';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

export interface DemoAccount {
  role: string;
  username: string;
  password: string;
}

@Component({
  selector: 'app-demo-accounts',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="demo" aria-labelledby="demo-title">
      <div class="head">
        <h2 id="demo-title"><app-icon name="key" [size]="14" />演示账号</h2>
        <span class="hint">点击任意一行自动填入</span>
      </div>
      <ul class="rows">
        @for (account of accounts; track account.username) {
          <li>
            <button
              class="row"
              type="button"
              (click)="fill.emit(account)"
              [attr.aria-label]="'填入' + account.role + '账号 ' + account.username"
            >
              <span class="role">{{ account.role }}</span>
              <span class="cred">
                <span class="user sp-num">{{ account.username }}</span>
                <span class="pass sp-num">{{ account.password }}</span>
              </span>
              <span class="go"><span class="go-text">填入</span><app-icon name="arrow-right" [size]="12" /></span>
            </button>
          </li>
        }
      </ul>
      <p class="note">演示账号仅用于靶场演练，请勿填写真实个人信息。</p>
    </section>
  `,
  styles: [`
    .demo { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--sp-border); }
    .head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .head h2 {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 14px; color: var(--sp-text-secondary);
    }
    .head h2 app-icon { color: var(--sp-text-muted); }
    .hint { font-size: 12px; color: var(--sp-text-muted); }
    .rows { border: 1px solid var(--sp-border); border-radius: var(--sp-radius-md); overflow: hidden; background: var(--sp-surface); }
    .rows li + li { border-top: 1px solid var(--sp-border); }
    .row {
      display: grid; grid-template-columns: 48px minmax(0, 1fr) auto;
      align-items: center; gap: 10px; width: 100%;
      min-height: 48px; padding: 6px 12px;
      border: 0; background: transparent; text-align: left;
      transition: background-color .15s ease;
    }
    .row:hover { background: #F7F9FC; }
    .role { font-size: 11px; font-weight: 700; color: var(--sp-accent-text); letter-spacing: .04em; }
    .cred { display: flex; flex-direction: column; min-width: 0; }
    .user { font-size: 13px; font-weight: 600; color: var(--sp-text); line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pass { font-size: 11px; color: var(--sp-text-muted); line-height: 1.35; }
    .go { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; color: var(--sp-info); opacity: .75; }
    .row:hover .go, .row:focus-visible .go { opacity: 1; }
    .note { margin-top: 8px; font-size: 12px; color: var(--sp-text-muted); }

    @media (max-width: 420px) {
      .row { grid-template-columns: 40px minmax(0, 1fr) auto; padding: 6px 10px; }
      .user { font-size: 12px; }
      .go-text { display: none; }
    }
  `],
})
export class DemoAccountsComponent {
  readonly accounts: DemoAccount[] = [
    { role: '管理员', username: 'admin@stellarpick.example', password: 'admin123' },
    { role: '会员', username: 'alice@stellarpick.example', password: 'Alice@2026' },
    { role: '会员', username: 'bob@stellarpick.example', password: 'Bob@2026' },
    { role: '商家', username: 'merchant@stellarpick.example', password: 'Merchant@2026' },
    { role: '客服', username: 'support@stellarpick.example', password: 'Support@2026' },
  ];
  readonly fill = output<DemoAccount>();
}
