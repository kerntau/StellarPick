import { Component, computed, input, output, signal } from '@angular/core';
import { Coupon } from '../../../core/models';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

@Component({
  selector: 'app-coupon-picker',
  standalone: true,
  imports: [MoneyPipe, IconComponent, SkeletonComponent],
  template: `
    <section class="sp-card coupon-box" aria-labelledby="cart-coupon-title">
      <div class="head">
        <div>
          <span class="eyebrow">COUPON WALLET</span>
          <h2 id="cart-coupon-title">优惠券</h2>
          <p class="sp-text-12 sp-muted">选择一张券，支付时自动抵扣；本页合计仍为商品金额。</p>
        </div>
        @if (!loading() && !error()) {
          <span class="sp-badge sp-badge--accent">{{ usableCount() }} 张可用</span>
        }
      </div>

      <div class="code-row">
        <label class="sp-sr-only" for="coupon-code">输入优惠券码</label>
        <div class="code-field">
          <app-icon name="ticket" [size]="17" />
          <input
            id="coupon-code"
            class="code-input"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="输入券码，如 SP0001"
            [value]="code()"
            [attr.aria-invalid]="codeError() ? 'true' : null"
            [attr.aria-describedby]="codeError() ? 'coupon-code-error' : 'coupon-code-hint'"
            (input)="onCode($event)"
            (keydown.enter)="applyCode($event)"
          />
          <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="applyCode($event)">使用</button>
        </div>
        @if (codeError()) {
          <p class="sp-error" id="coupon-code-error" role="alert">{{ codeError() }}</p>
        } @else {
          <p class="sp-hint" id="coupon-code-hint">券码可在券面查看，输入后立即校验本单是否可用。</p>
        }
      </div>

      @if (loading()) {
        <div class="loading" aria-busy="true">
          <app-skeleton variant="line" width="46%" />
          <div class="sp-mt-3"><app-skeleton variant="line" width="72%" /></div>
        </div>
      } @else if (error()) {
        <div class="sp-alert sp-alert--error load-error" role="alert">
          <app-icon name="alert-circle" [size]="18" />
          <span class="sp-grow">优惠券加载失败，请稍后重试。</span>
          <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="retry.emit()">重试</button>
        </div>
      } @else if (coupons().length === 0) {
        <div class="empty">
          <app-icon name="ticket" [size]="22" />
          <div>
            <strong>暂无可用优惠券</strong>
            <p class="sp-text-12 sp-muted">会员日和新品活动会发放优惠券，记得常来看看。</p>
          </div>
        </div>
      } @else {
        <ul class="coupon-list">
          @for (c of coupons(); track c.id) {
            <li>
              <label
                class="coupon"
                [class.is-off]="subtotal() < c.minSpend"
                [class.is-on]="selectedId() === c.id"
              >
                <input
                  type="radio"
                  name="cart-coupon"
                  [value]="c.id"
                  [checked]="selectedId() === c.id"
                  [disabled]="subtotal() < c.minSpend"
                  (change)="pick(c)"
                />
                <span class="ticket">
                  <span class="value sp-num" aria-hidden="true">
                    <span class="cur">¥</span>{{ c.amount }}
                  </span>
                  <span class="main">
                    <strong>{{ c.title }}</strong>
                    <small>
                      @if (c.minSpend > 0) {
                        满 {{ c.minSpend | spMoney }} 可用
                      } @else {
                        无门槛可用
                      }
                      <span class="code-chip">券码 {{ codeOf(c) }}</span>
                    </small>
                    @if (c.expiresAt) {
                      <small class="exp">有效期至 {{ expiry(c) }}</small>
                    }
                  </span>
                  <span class="state">
                    @if (selectedId() === c.id) {
                      <span class="sp-badge sp-badge--accent">已选</span>
                    } @else if (subtotal() >= c.minSpend) {
                      <span class="sp-badge sp-badge--success">本单可用</span>
                    } @else {
                      <span class="gap">还差 {{ c.minSpend - subtotal() | spMoney }}</span>
                    }
                  </span>
                  <span class="check" aria-hidden="true"><app-icon name="check" [size]="12" /></span>
                </span>
              </label>
            </li>
          }
        </ul>
        @if (selectedId() !== null) {
          <button class="clear-coupon" type="button" (click)="select.emit(null)">
            <app-icon name="x" [size]="14" /> 不使用优惠券
          </button>
        }
      }
    </section>
  `,
  styles: [`
    .coupon-box { padding: 20px; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .head > div { min-width: 0; }
    .eyebrow {
      display: block;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: .18em;
      color: var(--sp-text-muted);
      margin-bottom: 2px;
    }
    .head h2 { font-size: 18px; }
    .head p { margin-top: 2px; }
    .head .sp-badge { white-space: nowrap; flex: 0 0 auto; }

    .code-row { margin-bottom: 14px; }
    .code-field {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 4px 4px 12px;
      border: 1px dashed var(--sp-border-strong);
      border-radius: 8px;
      background: var(--sp-bg);
      color: var(--sp-text-muted);
    }
    .code-input {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 36px;
      border: 0;
      background: transparent;
      color: var(--sp-text);
      font-size: 13px;
      outline: none;
    }
    .code-input::placeholder { color: var(--sp-text-muted); }
    .code-field:focus-within { border-color: var(--sp-info); background: var(--sp-surface); box-shadow: 0 0 0 3px rgba(45, 108, 223, .12); }
    .code-field .sp-btn { min-height: 44px; flex: 0 0 auto; }
    .code-row .sp-error, .code-row .sp-hint { margin-top: 4px; }

    .loading { padding: 4px 0; }
    .load-error { align-items: center; }
    .load-error .sp-btn { min-height: 44px; flex: 0 0 auto; }
    .empty { display: flex; align-items: center; gap: 12px; padding: 12px 0 4px; color: var(--sp-text-secondary); }
    .empty app-icon { color: var(--sp-accent-text); }
    .empty strong { font-size: 14px; color: var(--sp-text); }

    .coupon-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .coupon-list li { min-width: 0; display: flex; }
    .coupon {
      position: relative;
      display: block;
      width: 100%;
      cursor: pointer;
      border-radius: 8px;
    }
    .coupon input { position: absolute; width: 1px; height: 1px; opacity: 0; margin: 0; }
    .coupon input:focus-visible + .ticket { outline: 2px solid var(--sp-focus); outline-offset: 2px; }
    .ticket {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 92px;
      padding: 12px 12px 12px 14px;
      border: 1px solid var(--sp-border);
      border-radius: 8px;
      background: linear-gradient(180deg, #FFFDF8 0%, var(--sp-surface) 70%);
      overflow: hidden;
    }
    .coupon:hover .ticket { border-color: var(--sp-border-strong); }
    .coupon.is-on .ticket { border-color: var(--sp-accent); box-shadow: 0 0 0 2px rgba(232, 163, 61, .18); }
    .coupon.is-off .ticket { background: var(--sp-bg); }
    .value {
      flex: 0 0 auto;
      min-width: 52px;
      font-size: 25px;
      font-weight: 800;
      line-height: 1.1;
      color: var(--sp-accent-text);
      letter-spacing: -.02em;
      padding-right: 10px;
      border-right: 1px dashed var(--sp-border-strong);
    }
    .value .cur { font-size: 13px; font-weight: 600; margin-right: 1px; }
    .coupon.is-off .value { color: var(--sp-text-muted); }
    .main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 1 auto; }
    .main strong { font-size: 13.5px; line-height: 1.35; }
    .main small { font-size: 11.5px; color: var(--sp-text-muted); line-height: 1.45; }
    .main .exp { color: var(--sp-text-muted); }
    .code-chip {
      display: inline-block;
      margin-left: 6px;
      padding: 0 4px;
      border-radius: 2px;
      background: var(--sp-bg);
      color: var(--sp-text-secondary);
      font-size: 10.5px;
      letter-spacing: .02em;
    }
    .state { flex: 0 0 auto; white-space: nowrap; display: flex; align-items: center; }
    .state .gap { font-size: 11.5px; color: var(--sp-warning); font-weight: 600; }
    .check {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--sp-accent);
      color: var(--sp-primary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
    }
    .coupon.is-on .check { opacity: 1; }
    .clear-coupon {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 44px;
      margin-top: 10px;
      padding: 0 6px;
      border: 0;
      background: transparent;
      color: var(--sp-text-secondary);
      font-size: 12px;
      font-weight: 600;
    }
    .clear-coupon:hover { color: var(--sp-danger); }

    @media (max-width: 767px) {
      .coupon-box { padding: 16px; }
      .coupon-list { grid-template-columns: 1fr; gap: 10px; }
      .ticket { gap: 10px; padding: 12px; min-height: 88px; }
      .value { min-width: 48px; font-size: 23px; }
    }
    @media (max-width: 380px) {
      .state .gap { display: none; }
    }
  `],
})
export class CouponPickerComponent {
  readonly coupons = input<Coupon[]>([]);
  readonly subtotal = input(0);
  readonly loading = input(false);
  readonly error = input(false);
  readonly selectedId = input<number | null>(null);
  readonly retry = output<void>();
  readonly select = output<number | null>();

  readonly code = signal('');
  readonly codeError = signal<string | null>(null);
  readonly usableCount = computed(
    () => this.coupons().filter((coupon) => !coupon.used && this.subtotal() >= coupon.minSpend).length,
  );

  codeOf(coupon: Coupon): string {
    return 'SP' + String(coupon.id).padStart(4, '0');
  }

  expiry(coupon: Coupon): string {
    return (coupon.expiresAt || '').slice(0, 10);
  }

  onCode(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value.toUpperCase());
    this.codeError.set(null);
  }

  applyCode(event?: Event): void {
    event?.preventDefault();
    const value = this.code().trim().toUpperCase();
    if (!value) {
      this.codeError.set('请输入优惠券码，例如 SP0001。');
      return;
    }
    const hit = this.coupons().find((coupon) => this.codeOf(coupon) === value);
    if (!hit) {
      this.codeError.set('优惠券码无效，请核对后重试。');
      return;
    }
    if (this.subtotal() < hit.minSpend) {
      this.codeError.set('本单金额未达到该券的使用门槛。');
      return;
    }
    this.codeError.set(null);
    this.code.set(this.codeOf(hit));
    this.select.emit(hit.id);
  }

  pick(coupon: Coupon): void {
    if (this.subtotal() < coupon.minSpend) {
      return;
    }
    this.codeError.set(null);
    this.select.emit(coupon.id);
  }
}
