import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

export type PaymentMethod = 'wechat' | 'alipay' | 'card';

interface PaymentOption {
  key: PaymentMethod;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-payment-icons',
  standalone: true,
  imports: [NgTemplateOutlet, IconComponent],
  template: `
    <ul class="pay-list" [class.pay-list--compact]="compact()" aria-label="支持的支付方式">
      @for (method of methods; track method.key) {
        <li class="pay-item">
          @if (selectable()) {
            <button
              class="pay"
              type="button"
              [class.is-on]="selected() === method.key"
              [attr.aria-pressed]="selected() === method.key"
              (click)="select.emit(method.key)"
            >
              <span class="pay-icon" aria-hidden="true">
                <ng-container *ngTemplateOutlet="glyph; context: { $implicit: method.key }"></ng-container>
              </span>
              <span class="pay-text">
                <strong>{{ method.label }}</strong>
                @if (!compact()) { <small>{{ method.hint }}</small> }
              </span>
              <span class="pay-check" aria-hidden="true"><app-icon name="check" [size]="12" /></span>
            </button>
          } @else {
            <span class="pay">
              <span class="pay-icon" aria-hidden="true">
                <ng-container *ngTemplateOutlet="glyph; context: { $implicit: method.key }"></ng-container>
              </span>
              <span class="pay-text">
                <strong>{{ method.label }}</strong>
                @if (!compact()) { <small>{{ method.hint }}</small> }
              </span>
            </span>
          }
        </li>
      }
    </ul>

    <ng-template #glyph let-key>
      @switch (key) {
        @case ('wechat') {
          <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <rect width="32" height="32" rx="8" fill="#178A18" />
            <path d="M13.4 7.6c-4.2 0-7.6 2.8-7.6 6.3 0 2 1.2 3.8 3.1 4.9l-.8 2.4 2.9-1.4c.7.2 1.5.3 2.4.3 4.2 0 7.6-2.8 7.6-6.3s-3.4-6.2-7.6-6.2Z" fill="#fff" />
            <circle cx="10.7" cy="13.4" r="1" fill="#178A18" />
            <circle cx="16" cy="13.4" r="1" fill="#178A18" />
            <path d="M21.2 14.2c-3.4 0-6.1 2.3-6.1 5.2 0 1.7 1 3.2 2.6 4.1l-.6 1.9 2.3-1.1c.6.1 1.2.2 1.8.2 3.4 0 6.1-2.3 6.1-5.1s-2.7-5.2-6.1-5.2Z" fill="#fff" opacity=".92" />
            <circle cx="19.2" cy="19.2" r=".8" fill="#178A18" />
            <circle cx="23.4" cy="19.2" r=".8" fill="#178A18" />
          </svg>
        }
        @case ('alipay') {
          <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <rect width="32" height="32" rx="8" fill="#1677FF" />
            <text x="16" y="22.4" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="17" font-weight="700" fill="#fff">支</text>
            <path d="M8 25.6c4.2-1.5 8.1-2.9 11.7-4.3" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7" fill="none" />
          </svg>
        }
        @case ('card') {
          <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <rect width="32" height="32" rx="8" fill="#0B2545" />
            <rect x="5.5" y="9" width="21" height="14" rx="2.2" fill="#fff" />
            <rect x="5.5" y="12" width="21" height="3.4" fill="#B4653F" />
            <rect x="8.5" y="18.4" width="7" height="2" rx="1" fill="#0B2545" opacity=".55" />
            <rect x="19" y="18.4" width="4.5" height="2" rx="1" fill="#E8A33D" />
          </svg>
        }
      }
    </ng-template>
  `,
  styles: [`
    .pay-list {
      display: flex;
      align-items: stretch;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .pay-item { flex: 1 1 132px; min-width: 0; display: flex; }
    .pay {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-height: 48px;
      padding: 7px 9px;
      border: 1px solid var(--sp-border);
      border-radius: 8px;
      background: var(--sp-surface);
      color: var(--sp-text);
      text-align: left;
      font: inherit;
      transition: border-color .15s ease, background-color .15s ease, box-shadow .15s ease;
    }
    button.pay:hover { border-color: var(--sp-border-strong); background: #FCFAF6; }
    .pay.is-on {
      border-color: var(--sp-primary);
      background: #FFFDF8;
      box-shadow: 0 0 0 2px rgba(180, 101, 63, .12);
    }
    .pay-icon { width: 30px; height: 30px; flex: 0 0 auto; display: inline-flex; }
    .pay-icon svg { width: 30px; height: 30px; display: block; }
    .pay-text { display: flex; flex-direction: column; gap: 0; min-width: 0; line-height: 1.25; }
    .pay-text strong { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
    .pay-text small { font-size: 11px; color: var(--sp-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pay-check {
      margin-left: auto;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--sp-primary);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      flex: 0 0 auto;
    }
    .pay.is-on .pay-check { opacity: 1; }

    .pay-list--compact { gap: 2px; }
    .pay-list--compact .pay-item { flex: 0 0 auto; }
    .pay-list--compact .pay {
      min-height: 36px;
      padding: 4px 6px;
      border-color: transparent;
      background: transparent;
      gap: 6px;
    }
    .pay-list--compact .pay-icon,
    .pay-list--compact .pay-icon svg { width: 24px; height: 24px; }
    .pay-list--compact .pay-text strong { font-size: 11.5px; color: var(--sp-text-secondary); font-weight: 600; }
    .pay-list--compact button.pay:hover { background: var(--sp-bg); border-color: transparent; }

    @media (max-width: 520px) {
      .pay-item { flex: 1 1 100%; }
      .pay-text small { white-space: normal; }
    }
  `],
})
export class PaymentIconsComponent {
  readonly selected = input<string>('wechat');
  readonly selectable = input(false);
  readonly compact = input(false);
  readonly select = output<string>();

  readonly methods: PaymentOption[] = [
    { key: 'wechat', label: '微信支付', hint: '扫码即付' },
    { key: 'alipay', label: '支付宝', hint: '花呗分期' },
    { key: 'card', label: '银行卡', hint: '储蓄卡 / 信用卡' },
  ];
}
