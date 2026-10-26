import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRODUCT_META } from '../../../core/catalog';
import { CartItem } from '../../../core/models';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { QuantityStepperComponent } from '../../../shared/ui/quantity-stepper/quantity-stepper.component';

const FALLBACK_IMAGE = '/assets/sp/img/products/1001.svg';

@Component({
  selector: 'app-cart-line',
  standalone: true,
  imports: [RouterLink, MoneyPipe, IconComponent, QuantityStepperComponent],
  template: `
    <article
      class="line"
      [class.is-busy]="busy()"
      [class.is-selected]="selected()"
      [attr.aria-busy]="busy()"
    >
      <label class="pick">
        <input
          class="pick-input"
          type="checkbox"
          [checked]="selected()"
          [disabled]="busy()"
          [attr.aria-label]="'选择 ' + item().title"
          (change)="onToggle($event)"
        />
        <span class="pick-box" aria-hidden="true"><app-icon name="check" [size]="12" /></span>
      </label>

      <a class="thumb" [routerLink]="['/product', item().productId]" tabindex="-1" aria-hidden="true">
        <img
          [src]="item().image"
          alt=""
          width="176"
          height="176"
          loading="lazy"
          (error)="onImageError($event)"
        />
      </a>

      <div class="info">
        <a class="title sp-clamp-2" [routerLink]="['/product', item().productId]">{{ item().title }}</a>

        @if (specPrimary() || specSecondary()) {
          <div class="chips">
            @if (specPrimary()) { <span class="chip">{{ specPrimary() }}</span> }
            @if (specSecondary()) { <span class="chip chip--quiet">{{ specSecondary() }}</span> }
          </div>
        }

        <p class="stock sp-text-12" [class.low]="item().stock > 0 && item().stock <= 5" [class.out]="item().stock <= 0">
          <span class="stock-dot" aria-hidden="true"></span>
          <span>{{ stockText() }}</span>
          @if (item().stock > 0) {
            <span class="stock-sep" aria-hidden="true">·</span>
            <span class="stock-extra">48 小时内发出</span>
          }
        </p>

        <p class="unit-mobile sp-text-12">
          <span class="mobile-tag">会员价</span>
          <span class="sp-num">{{ item().unitPrice | spMoney }}</span>
          @if (listPrice() > 0) {
            <span class="list-price sp-num">{{ listPrice() | spMoney }}</span>
          }
        </p>
      </div>

      <div class="unit">
        <span class="member-tag">会员价</span>
        <span class="price sp-num">{{ item().unitPrice | spMoney }}</span>
        @if (listPrice() > 0) {
          <span class="list-price sp-num">日常价 {{ listPrice() | spMoney }}</span>
        }
      </div>

      <div class="qty">
        <app-quantity-stepper
          [value]="item().quantity"
          [min]="1"
          [max]="maxQuantity()"
          (valueChange)="quantityChange.emit($event)"
        />
      </div>

      <div class="sub">
        <span class="sub-value sp-num">{{ subtotal() | spMoney }}</span>
        @if (saving() > 0) {
          <span class="sub-save">已省 {{ saving() | spMoney }}</span>
        }
      </div>

      <div class="actions">
        <button
          class="icon-btn fav"
          type="button"
          [class.is-on]="favorited()"
          [disabled]="busy()"
          [attr.aria-pressed]="favorited()"
          [attr.aria-label]="(favorited() ? '取消收藏 ' : '收藏 ') + item().title"
          (click)="favorite.emit()"
        >
          <app-icon name="heart" [size]="17" />
        </button>
        <button
          class="icon-btn del"
          type="button"
          [disabled]="busy()"
          [attr.aria-label]="'删除 ' + item().title"
          (click)="remove.emit()"
        >
          <app-icon name="trash" [size]="17" />
        </button>
      </div>
    </article>
  `,
  styles: [`
    .line {
      display: grid;
      grid-template-columns: 24px 84px minmax(0, 1fr) 96px 138px 100px 92px;
      grid-template-areas: 'pick thumb info unit qty sub actions';
      gap: 12px;
      align-items: center;
      padding: 18px 20px;
      border-bottom: 1px solid var(--sp-border);
      transition: background-color .15s ease, opacity .15s ease;
    }
    .line:last-child { border-bottom: 0; }
    .line:hover { background: #FCFAF6; }
    .line.is-busy { opacity: .6; }
    .line.is-selected { background: #FFFDF8; }
    .line.is-selected:hover { background: #FFFBF3; }

    .pick { grid-area: pick; position: relative; display: flex; align-items: center; justify-content: center; min-height: 44px; cursor: pointer; }
    .pick::before { content: ''; position: absolute; inset: -8px -8px; }
    .pick-input { position: absolute; width: 1px; height: 1px; opacity: 0; margin: 0; }
    .pick-box {
      width: 18px;
      height: 18px;
      border: 1.5px solid var(--sp-border-strong);
      border-radius: 4px;
      background: var(--sp-surface);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background-color .12s ease, border-color .12s ease;
    }
    .pick-box app-icon { opacity: 0; }
    .pick-input:checked + .pick-box { background: var(--sp-primary); border-color: var(--sp-primary); }
    .pick-input:checked + .pick-box app-icon { opacity: 1; }
    .pick-input:focus-visible + .pick-box { outline: 2px solid var(--sp-focus); outline-offset: 2px; }
    .pick-input:disabled + .pick-box { opacity: .4; }

    .thumb {
      grid-area: thumb;
      display: block;
      width: 84px;
      height: 84px;
      border-radius: 8px;
      overflow: hidden;
      background: #F1EEE8;
      border: 1px solid var(--sp-border);
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
    .thumb:hover img { transform: scale(1.04); }

    .info { grid-area: info; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .title { font-size: 14px; font-weight: 600; color: var(--sp-text); line-height: 1.45; }
    .title:hover { color: var(--sp-accent-text); }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 1px 7px;
      border-radius: 3px;
      border: 1px solid var(--sp-border);
      background: var(--sp-bg);
      color: var(--sp-text-secondary);
      font-size: 11.5px;
      line-height: 1.6;
      white-space: nowrap;
    }
    .chip--quiet { color: var(--sp-text-muted); }
    .stock { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; color: var(--sp-success); }
    .stock-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
    .stock.low { color: var(--sp-warning); }
    .stock.out { color: var(--sp-danger); }
    .stock-sep { color: var(--sp-border-strong); }
    .stock-extra { color: var(--sp-text-muted); }

    .unit { grid-area: unit; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .member-tag {
      align-self: flex-start;
      padding: 0 5px;
      border-radius: 2px;
      background: #FBF0DC;
      color: var(--sp-accent-text);
      font-size: 10.5px;
      font-weight: 700;
      line-height: 1.6;
      letter-spacing: .02em;
    }
    .price { font-size: 14px; font-weight: 700; color: var(--sp-text); }
    .list-price { font-size: 11px; color: var(--sp-text-muted); text-decoration: line-through; white-space: nowrap; }

    .qty { grid-area: qty; }
    .sub { grid-area: sub; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
    .sub-value { font-size: 15px; font-weight: 700; color: var(--sp-accent-text); }
    .sub-save { font-size: 11px; color: var(--sp-success); white-space: nowrap; }
    .unit-mobile { display: none; }

    .actions { grid-area: actions; display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
    .icon-btn {
      width: 44px;
      height: 44px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--sp-text-muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background-color .15s ease, color .15s ease, border-color .15s ease;
    }
    .icon-btn:hover:not(:disabled) { background: var(--sp-bg); color: var(--sp-primary); border-color: var(--sp-border); }
    .icon-btn.fav.is-on { color: var(--sp-terracotta); background: #FBEFE9; border-color: #EBC3B3; }
    .icon-btn.del:hover:not(:disabled) { background: var(--sp-danger-soft); color: var(--sp-danger); border-color: #F2C7C1; }
    .icon-btn:disabled { opacity: .4; cursor: not-allowed; }

    @media (max-width: 1023px) {
      .line {
        grid-template-columns: 24px 76px minmax(0, 1fr) 92px;
        grid-template-areas:
          'pick thumb info actions'
          '. qty qty sub';
        gap: 10px 12px;
        align-items: start;
        padding: 14px 16px;
      }
      .pick { align-items: flex-start; padding-top: 4px; min-height: 32px; }
      .thumb { width: 76px; height: 76px; }
      .unit { display: none; }
      .unit-mobile { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .unit-mobile .mobile-tag { color: var(--sp-accent-text); font-weight: 700; font-size: 11px; }
      .unit-mobile .sp-num { color: var(--sp-text); font-weight: 600; }
      .unit-mobile .list-price { color: var(--sp-text-muted); font-weight: 400; }
      .spec-extra, .stock-extra { display: none; }
      .qty { align-self: center; padding-top: 2px; }
      .sub { align-self: center; }
      .actions { align-self: start; }
      .info { gap: 4px; }
      .title { font-size: 13.5px; }
    }
    @media (max-width: 480px) {
      .line { grid-template-columns: 20px 64px minmax(0, 1fr) 92px; gap: 8px 10px; padding: 12px; }
      .thumb { width: 64px; height: 64px; }
      .chip:nth-child(2) { display: none; }
      .sub-value { font-size: 14px; }
    }
  `],
})
export class CartLineComponent {
  readonly item = input.required<CartItem>();
  readonly busy = input(false);
  readonly selected = input(true);
  readonly favorited = input(false);
  readonly quantityChange = output<number>();
  readonly remove = output<void>();
  readonly favorite = output<void>();
  readonly selectedChange = output<boolean>();

  readonly maxQuantity = computed(() => Math.max(1, Math.min(999, this.item().stock || 999)));
  readonly subtotal = computed(() => this.item().unitPrice * this.item().quantity);
  readonly specPrimary = computed(
    () => PRODUCT_META[this.item().productId]?.specs?.[0]?.value ?? '',
  );
  readonly specSecondary = computed(
    () => PRODUCT_META[this.item().productId]?.specs?.[1]?.value ?? '',
  );
  readonly stockText = computed(() => {
    const stock = this.item().stock;
    if (stock <= 0) {
      return '暂时缺货';
    }
    if (stock <= 5) {
      return '仅剩 ' + stock + ' 件';
    }
    return '现货';
  });
  /** Member price is the real unit price; the struck-through price is the list price. */
  readonly listPrice = computed(() => {
    const list = Number(this.item().listPrice ?? 0);
    const unit = Number(this.item().unitPrice ?? 0);
    if (!Number.isFinite(list) || list <= unit) {
      return 0;
    }
    return Math.round(list * 100) / 100;
  });
  readonly saving = computed(() => {
    const list = this.listPrice();
    return list > 0
      ? Math.round((list - this.item().unitPrice) * this.item().quantity * 100) / 100
      : 0;
  });

  onToggle(event: Event): void {
    this.selectedChange.emit((event.target as HTMLInputElement).checked);
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(FALLBACK_IMAGE)) {
      image.src = FALLBACK_IMAGE;
    }
  }
}
