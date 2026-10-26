import { Component, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ProductsApi } from '../../core/api/products.api';
import { Product, errorMessage, errorRequestId } from '../../core/models';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ProductCardComponent } from '../../shared/ui/product-card/product-card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

interface Shortcut {
  slug: string;
  name: string;
}

const SHORTCUTS: readonly Shortcut[] = [
  { slug: 'kitchen', name: '厨房' },
  { slug: 'home', name: '家居' },
  { slug: 'personal', name: '个护' },
  { slug: 'digital', name: '数码' },
  { slug: 'travel', name: '出行' },
  { slug: 'food', name: '食品' },
];

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink, IconComponent, ProductCardComponent, SkeletonComponent, ErrorStateComponent],
  template: `
    <div class="sp-container nf">
      <section class="hero" aria-labelledby="nf-title">
        <img class="art" src="/assets/sp/img/not-found.svg" alt="" width="360" height="280" />
        <p class="code sp-num">404</p>
        <h1 id="nf-title">页面走丢了，回首页看看吧</h1>
        <p class="desc sp-secondary">
          链接可能已经失效，或者地址输错了。你可以回首页继续逛逛，也可以直接搜索想要的东西。
        </p>
        @if (attempted()) {
          <p class="path sp-num" [title]="attempted()">{{ attempted() }}</p>
        }
        <div class="actions">
          <a class="sp-btn sp-btn--primary sp-btn--lg" routerLink="/">回首页</a>
          <a class="sp-btn sp-btn--secondary sp-btn--lg" routerLink="/category/all">全部商品</a>
        </div>
        <form class="search" role="search" (submit)="$event.preventDefault(); search()">
          <app-icon name="search" [size]="18" />
          <input type="search" autocomplete="off" placeholder="搜索商品，例如 保温杯" aria-label="搜索商品"
                 [value]="q()" (input)="onInput($event)" />
          <button class="sp-btn sp-btn--primary sp-btn--sm" type="submit" [disabled]="!q().trim()">搜索</button>
        </form>

        <nav class="shortcuts" aria-label="热门分类">
          <span class="shortcuts-label">热门分类</span>
          @for (item of shortcuts; track item.slug) {
            <a class="chip" [routerLink]="['/category', item.slug]">{{ item.name }}</a>
          }
        </nav>
      </section>

      <section class="rec" aria-labelledby="rec-title">
        <div class="sp-section-head">
          <div>
            <h2 id="rec-title">热销推荐</h2>
            <p>这几件最近卖得很好，也许你会喜欢</p>
          </div>
          <a class="sp-link" routerLink="/category/all">查看全部</a>
        </div>

        <div class="rec-body">
          @if (showSkeleton()) {
            <div class="sp-grid-products">
              @for (item of skeletons; track item) {
                <app-skeleton variant="card" />
              }
            </div>
          } @else if (error()) {
            <app-error-state [message]="error()" [requestId]="requestId()" (retry)="load()" />
          } @else if (loading()) {
            <div class="rec-placeholder"></div>
          } @else if (products().length === 0) {
            <p class="empty-rec sp-muted">推荐商品暂时不可用，你仍然可以回首页继续浏览。</p>
          } @else {
            <div class="sp-grid-products">
              @for (product of products(); track product.id) {
                <app-product-card [product]="product" />
              }
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .nf { padding-block: 24px 64px; }
    .hero { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 32px 0 8px; }
    .art { width: 360px; max-width: 100%; height: auto; }
    .code { margin-top: 4px; font-size: 13px; font-weight: 700; letter-spacing: .3em; color: var(--sp-text-muted); }
    .hero h1 { font-size: 32px; margin: 6px 0 12px; }
    .desc { max-width: 560px; font-size: 15px; line-height: 1.8; }
    .path {
      max-width: 100%; margin-top: 8px; padding: 2px 10px;
      border: 1px solid var(--sp-border); border-radius: var(--sp-radius-sm);
      background: var(--sp-surface); font-size: 12px; color: var(--sp-text-muted);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 24px; }
    .search {
      display: flex; align-items: center; gap: 8px; width: min(560px, 100%); margin-top: 20px;
      padding: 4px 6px 4px 14px; border: 1px solid var(--sp-border-strong); border-radius: 10px;
      background: var(--sp-surface); color: var(--sp-text-muted);
    }
    .search:focus-within { border-color: var(--sp-info); box-shadow: 0 0 0 1px var(--sp-info); }
    .search input {
      flex: 1; min-width: 0; height: 40px; border: 0; outline: 0;
      background: transparent; font-size: 15px; color: var(--sp-text);
    }
    .shortcuts {
      display: flex; align-items: center; flex-wrap: wrap; justify-content: center;
      gap: 8px; margin-top: 20px; font-size: 12px; color: var(--sp-text-muted);
    }
    .chip {
      display: inline-flex; align-items: center; min-height: 32px; padding: 0 12px;
      border: 1px solid var(--sp-border); border-radius: var(--sp-radius-pill);
      background: var(--sp-surface); color: var(--sp-text-secondary); font-size: 13px;
    }
    .chip:hover { border-color: var(--sp-primary); color: var(--sp-primary); }
    .rec { margin-top: 56px; }
    .rec-body { min-height: 320px; }
    .empty-rec { padding: 56px 0; text-align: center; }
    .rec-placeholder { min-height: 320px; }
    @media (max-width: 767px) {
      .hero { padding-top: 20px; }
      .hero h1 { font-size: 26px; }
      .desc { font-size: 14px; }
      .actions { width: 100%; }
      .actions .sp-btn { flex: 1 1 100%; }
      .chip { min-height: 40px; }
      .rec { margin-top: 40px; }
    }
  `],
})
export class NotFoundPage {
  private readonly api = inject(ProductsApi);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  readonly shortcuts = SHORTCUTS;
  readonly skeletons = [1, 2, 3, 4];
  readonly q = signal('');
  readonly attempted = signal(this.router.url === '/' ? '' : this.router.url);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly showSkeleton = signal(false);
  readonly error = signal('');
  readonly requestId = signal<string | undefined>(undefined);

  private timer?: ReturnType<typeof setTimeout>;
  private seq = 0;

  constructor() {
    this.title.setTitle('页面不存在 · 星澜优选');
    this.load();
  }

  load(): void {
    const seq = ++this.seq;
    this.error.set('');
    this.requestId.set(undefined);
    this.loading.set(true);
    this.showSkeleton.set(false);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.showSkeleton.set(true), 300);

    this.api.list({ size: 4 }).subscribe({
      next: (res) => {
        if (seq !== this.seq) {
          return;
        }
        clearTimeout(this.timer);
        this.products.set(res.items ?? []);
        this.loading.set(false);
        this.showSkeleton.set(false);
      },
      error: (err) => {
        if (seq !== this.seq) {
          return;
        }
        clearTimeout(this.timer);
        this.products.set([]);
        this.loading.set(false);
        this.showSkeleton.set(false);
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
      },
    });
  }

  onInput(event: Event): void {
    this.q.set((event.target as HTMLInputElement).value);
  }

  search(): void {
    const keyword = this.q().trim();
    if (!keyword) {
      return;
    }
    this.router.navigate(['/search'], { queryParams: { q: keyword } });
  }
}
