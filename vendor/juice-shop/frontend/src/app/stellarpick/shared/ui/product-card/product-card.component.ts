import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../core/cart.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { Product, errorMessage } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import { IconComponent } from '../icon/icon.component';
import { RatingStarsComponent } from '../rating-stars/rating-stars.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, MoneyPipe, IconComponent, RatingStarsComponent],
  template: `
    <article class="card">
      <a class="media" [routerLink]="['/product', product().id]">
        <!-- Above-the-fold cards opt into eager + high priority so the LCP image
             is not deferred; the rest stay lazy. -->
        <img
          [src]="product().image"
          [alt]="product().title"
          width="800"
          height="800"
          [attr.loading]="priority() ? 'eager' : 'lazy'"
          [attr.fetchpriority]="priority() ? 'high' : null" />
        @if (product().stock === 0) {
          <span class="soldout">已售罄</span>
        } @else if (product().stock <= 8) {
          <span class="low-stock">仅剩 {{ product().stock }} 件</span>
        }
        <span class="media-tag">包邮</span>
      </a>
      <div class="body">
        <a class="title sp-clamp-2" [routerLink]="['/product', product().id]">{{ product().title }}</a>
        <p class="sub sp-clamp-1">{{ product().subtitle }}</p>
        <div class="rating">
          <app-rating-stars [value]="product().rating" [size]="12" />
          <span class="score sp-num">{{ product().rating.toFixed(1) }}</span>
          <span class="sales">已售 {{ product().sales }}</span>
        </div>
        <div class="foot">
          <span class="price sp-num">{{ product().price | spMoney }}</span>
          <!-- The visible "加购" label reappears between 768px and 1023px, so the
               accessible name has to contain it. -->
          <button class="add" type="button" (click)="add()" [disabled]="product().stock === 0"
                  [attr.aria-label]="'加购：' + product().title">
            <app-icon name="cart" [size]="15" /><span>加购</span>
          </button>
        </div>
      </div>
    </article>
  `,
  styles: [`
    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--sp-surface);
      border: 1px solid var(--sp-border);
      border-radius: 10px;
      overflow: hidden;
      transition: box-shadow .2s ease, transform .2s ease, border-color .2s ease;
    }

    .card:hover {
      border-color: var(--sp-border-strong);
      box-shadow: var(--sp-shadow-lift);
      transform: translateY(-2px);
    }

    .media {
      position: relative;
      display: block;
      aspect-ratio: 1 / 1;
      background: var(--sp-image-bg);
      overflow: hidden;
    }

    .media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform .45s ease;
    }

    .card:hover .media img { transform: scale(1.035); }

    .media-tag {
      position: absolute;
      left: 8px;
      bottom: 8px;
      padding: 2px 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, .92);
      color: var(--sp-sage);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .08em;
    }

    .low-stock {
      position: absolute;
      top: 8px;
      left: 8px;
      padding: 2px 6px;
      border-radius: 3px;
      background: var(--sp-terracotta-soft);
      color: var(--sp-terracotta-ink);
      font-size: 10px;
      font-weight: 700;
    }

    .soldout {
      position: absolute;
      inset: auto 10px 10px 10px;
      padding: 4px 0;
      border-radius: 4px;
      background: rgba(23, 21, 18, .78);
      color: #fff;
      font-size: 11.5px;
      text-align: center;
    }

    .body {
      display: flex;
      flex-direction: column;
      gap: 5px;
      flex: 1;
      padding: 12px 13px 14px;
    }

    .title {
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1.45;
      min-height: 39px;
      color: var(--sp-text);
    }

    .title:hover { color: var(--sp-accent-text); }

    .sub { font-size: 11.5px; color: var(--sp-text-muted); }

    .rating {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11.5px;
      color: var(--sp-text-secondary);
    }

    .score { color: var(--sp-text); font-weight: 600; }

    .sales { margin-left: auto; color: var(--sp-text-muted); }

    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: auto;
      padding-top: 7px;
    }

    .price {
      color: var(--sp-accent-text);
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -.01em;
      white-space: nowrap;
    }

    .add {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 32px;
      padding: 0 10px;
      border-radius: 6px;
      border: 1px solid var(--sp-border-strong);
      background: var(--sp-surface);
      color: var(--sp-primary);
      font-size: 12px;
      font-weight: 600;
      opacity: 0;
      transition: opacity .15s ease, background-color .15s ease, color .15s ease;
    }

    .card:hover .add,
    .add:focus-visible { opacity: 1; }

    .add:hover:not(:disabled) {
      background: var(--sp-primary);
      color: #fff;
      border-color: var(--sp-primary);
    }

    .add:disabled { opacity: .4; cursor: not-allowed; }

    @media (max-width: 1023px) {
      .add { opacity: 1; }
    }

    @media (max-width: 767px) {
      .body { padding: 10px 10px 12px; gap: 4px; }
      .title { font-size: 13px; min-height: 37px; }
      .rating { gap: 3px; font-size: 11px; }
      .sales { display: none; }
      .price { font-size: 16px; }
      .add { height: 34px; padding: 0 8px; }
      .add span { display: none; }
      .media-tag { display: none; }
    }
  `],
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  /** True for the first screenful so its images load eagerly (LCP). */
  readonly priority = input(false);
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

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
