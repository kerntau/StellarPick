import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../core/cart.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { Product, errorMessage } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { RatingStarsComponent } from '../../../shared/ui/rating-stars/rating-stars.component';

/**
 * Denser list tile used by search results: badges, member price, sold count and
 * free-shipping copy sit above the fold like a real marketplace listing.
 */
@Component({
  selector: 'app-catalog-tile',
  standalone: true,
  imports: [RouterLink, MoneyPipe, IconComponent, RatingStarsComponent],
  template: `
    <article class="tile">
      <a class="media" [routerLink]="['/product', product().id]" tabindex="-1" aria-hidden="true">
        <img
          [src]="product().image"
          alt=""
          width="800"
          height="800"
          [attr.loading]="priority() ? 'eager' : 'lazy'"
          [attr.fetchpriority]="priority() ? 'high' : null" />
        <span class="flags">
          <span class="flag flag--member">会员价</span>
          @if (product().sales >= 1500) {
            <span class="flag flag--hot">热卖</span>
          }
          @if (product().stock === 0) {
            <span class="flag flag--out">已售罄</span>
          }
        </span>
      </a>

      <div class="body">
        <div class="topline">
          <span class="ship"><app-icon name="truck" [size]="12" /> 包邮</span>
          <span class="ship ship--sla">48h 发货</span>
          <span class="sales">已售 {{ product().sales }}</span>
        </div>

        <a class="title sp-clamp-2" [routerLink]="['/product', product().id]">{{ product().title }}</a>
        <p class="sub sp-clamp-1">{{ product().subtitle }}</p>

        <div class="rating">
          <app-rating-stars [value]="product().rating" [size]="12" />
          <span class="score sp-num">{{ product().rating.toFixed(1) }}</span>
          <span class="reviews">{{ reviewCount() }} 条评价</span>
        </div>

        <div class="price-row">
          <span class="price sp-num">{{ product().price | spMoney }}</span>
          <span class="member sp-num">会员 {{ memberPrice() | spMoney }}</span>
        </div>

        <div class="foot">
          <span class="delivery">{{ product().stock > 0 ? '今日 / 明日达' : '补货中' }}</span>
          <button
            class="add"
            type="button"
            [disabled]="product().stock === 0"
            [attr.aria-label]="'加购：' + product().title"
            (click)="add()">
            <app-icon name="cart" [size]="15" /><span>加购</span>
          </button>
        </div>
      </div>
    </article>
  `,
  styles: [`
    .tile { display: flex; flex-direction: column; background: var(--sp-surface); border: 1px solid var(--sp-border); border-radius: 4px; overflow: hidden; transition: box-shadow .18s ease, transform .18s ease, border-color .18s ease; }
    .tile:hover { border-color: var(--sp-border-strong); box-shadow: 0 8px 20px rgba(60, 42, 20, .09); transform: translateY(-2px); }
    .media { position: relative; display: block; aspect-ratio: 1 / 1; background: linear-gradient(160deg, #F4EDE1, #E7DCCB); overflow: hidden; }
    .media img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
    .tile:hover .media img { transform: scale(1.03); }
    .flags { position: absolute; left: 8px; top: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
    .flag { display: inline-flex; align-items: center; min-height: 20px; padding: 0 6px; border-radius: 2px; font-size: 10px; font-weight: 700; line-height: 1.6; }
    .flag--member { background: var(--sp-primary); color: #fff; }
    .flag--hot { background: #8C3D22; color: #fff; }
    .flag--out { background: rgba(23, 21, 18, .72); color: #fff; }
    .body { display: flex; flex-direction: column; gap: 6px; flex: 1; padding: 12px 14px 14px; }
    .topline { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--sp-text-muted); white-space: nowrap; overflow: hidden; }
    .ship { display: inline-flex; align-items: center; gap: 3px; color: var(--sp-sage); font-weight: 600; white-space: nowrap; }
    .sales { margin-left: auto; white-space: nowrap; }
    .title { font-size: 14px; font-weight: 600; line-height: 1.5; min-height: 42px; }
    .title:hover { color: var(--sp-accent-text); }
    .sub { font-size: 12px; color: var(--sp-text-muted); }
    .rating { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sp-text-secondary); }
    .score { color: var(--sp-text); font-weight: 600; }
    .reviews { color: var(--sp-text-muted); }
    .price-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 4px; }
    .price { color: var(--sp-accent-text); font-size: 19px; font-weight: 700; letter-spacing: -.01em; }
    .member { padding: 1px 6px; border-radius: 2px; background: #FBF0DC; color: var(--sp-accent-text); font-size: 11px; font-weight: 600; }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 8px; border-top: 1px solid var(--sp-border); }
    .delivery { font-size: 11px; color: var(--sp-text-secondary); }
    .add { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0 10px; border: 1px solid var(--sp-border-strong); border-radius: 3px; background: var(--sp-surface); color: var(--sp-primary); font-size: 12px; font-weight: 600; }
    .add:hover:not(:disabled) { background: var(--sp-primary); border-color: var(--sp-primary); color: #fff; }
    .add:disabled { opacity: .4; cursor: not-allowed; }
    @media (max-width: 767px) {
      .body { padding: 10px 12px 12px; gap: 5px; }
      .title { min-height: 0; font-size: 13px; }
      .reviews { display: none; }
      .ship--sla { display: none; }
      .add { min-height: 44px; padding: 0 12px; }
    }
  `],
})
export class CatalogTileComponent {
  readonly product = input.required<Product>();
  /** First screenful loads eagerly for LCP; the rest stay lazy. */
  readonly priority = input(false);

  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly memberPrice = computed(() => Math.round(this.product().price * 0.9 * 100) / 100);
  readonly reviewCount = computed(() => Math.max(1, Math.round(this.product().sales / 90)));

  add(): void {
    if (!this.auth.isLoggedIn()) {
      this.toast.show('登录后即可加入购物车', 'info');
      this.router.navigate(['/login'], { queryParams: { next: this.router.url } });
      return;
    }
    this.cart.addProduct(this.product(), 1).subscribe({
      next: (cart) => this.toast.show('已加入购物车 · 共 ' + cart.count + ' 件'),
      error: (err) => this.toast.show(errorMessage(err), 'error'),
    });
  }
}
