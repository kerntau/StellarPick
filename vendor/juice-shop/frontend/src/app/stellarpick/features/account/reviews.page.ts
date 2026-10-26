import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { OrdersApi } from '../../core/api/orders.api';
import { ReviewsApi } from '../../core/api/reviews.api';
import { AuthStore } from '../../core/auth/auth.store';
import { Paged, Review, errorMessage, errorRequestId } from '../../core/models';
import { SpDatePipe } from '../../shared/pipes/date.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { RatingStarsComponent } from '../../shared/ui/rating-stars/rating-stars.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { CachedReview, readMyReviews, readReviewedProducts } from './components/review-cache';
import { ReviewModalComponent } from './components/review-modal.component';
import { normalizeAvatar } from './components/account-avatar';

interface PendingReview {
  orderId: number;
  productId: number;
  title: string;
  image: string;
  createdAt: string;
}

interface MyReviewView {
  key: string;
  productId: number;
  title: string;
  image: string;
  rating: number;
  createdAt: string;
  safeBody: SafeHtml;
}

interface ProductMeta {
  title: string;
  image: string;
}

interface ReviewRow extends Review {
  userId?: number;
}

const EMPTY_PAGE: Paged<Review> = { items: [], total: 0, page: 1, size: 50 };

@Component({
  selector: 'app-reviews-page',
  standalone: true,
  imports: [
    RouterLink,
    SpDatePipe,
    EmptyStateComponent,
    ErrorStateComponent,
    RatingStarsComponent,
    SkeletonComponent,
    IconComponent,
    ReviewModalComponent,
  ],
  template: `
    <div class="page-head">
      <div>
        <span class="sp-eyebrow">MY REVIEWS · 我的评价</span>
        <h1>我的评价</h1>
        <p class="sp-secondary">完成订单后可以为商品写评价，帮助其他会员做选择。</p>
      </div>
      <div class="review-stats">
        <span class="stat-chip"><strong class="sp-num">{{ pending().length }}</strong> 待评价</span>
        <span class="stat-chip stat-chip--done"><strong class="sp-num">{{ mine().length }}</strong> 已评价</span>
      </div>
    </div>

    @if (showSkeleton()) {
      <div class="skeleton-box">
        @for (row of skeletonRows; track row) {
          <div class="sp-card sp-card--pad"><app-skeleton variant="line" width="85%" /></div>
        }
      </div>
    } @else if (error()) {
      <app-error-state
        [message]="error() ?? '加载失败，请稍后重试'"
        [requestId]="requestId()"
        (retry)="load()"
      />
    } @else if (pending().length === 0 && mine().length === 0) {
      <app-empty-state
        image="orders"
        title="还没有可评价的订单"
        description="完成订单后，就可以在这里分享真实的使用感受。"
        actionLabel="去我的订单"
        actionLink="/account/orders"
      />
    } @else {
      <section class="block" aria-labelledby="pending-title">
        <div class="section-head">
          <h2 id="pending-title">待评价</h2>
          @if (pending().length > 0) {
            <span class="sp-badge sp-badge--accent">写评价得 20 积分</span>
          }
        </div>

        @if (pending().length === 0) {
          <div class="sp-card compact-empty">
            <p class="sp-secondary">没有待评价的商品，完成的订单都已评价过了。</p>
          </div>
        } @else {
          <div class="pending-list">
            @for (item of pending(); track item.orderId + '-' + item.productId) {
              <article class="sp-card pending-item">
                <img class="thumb" [src]="item.image" [alt]="item.title" width="64" height="64" loading="lazy" />
                <div class="pending-info">
                  <a class="title sp-clamp-2" [routerLink]="['/product', item.productId]">{{ item.title }}</a>
                  <p class="sp-text-12 sp-muted">
                    <span class="order-chip">订单 <span class="sp-num">#{{ item.orderId }}</span></span>
                    <span class="dot-sep">·</span>
                    完成于 <span class="sp-num">{{ item.createdAt | spDate }}</span>
                  </p>
                  <p class="pending-reward"><app-icon name="sparkles" [size]="12" /> 评价通过后获得 20 积分</p>
                </div>
                <button class="sp-btn sp-btn--primary sp-btn--sm" type="button" (click)="openReview(item)">
                  <app-icon name="edit" [size]="15" /> 写评价
                </button>
              </article>
            }
          </div>
        }
      </section>

      <section class="block" aria-labelledby="mine-title">
        <div class="section-head">
          <h2 id="mine-title">已评价</h2>
          @if (mine().length > 0) {
            <span class="sp-text-13 sp-muted">{{ mine().length }} 条</span>
          }
        </div>

        @if (mine().length === 0) {
          <div class="sp-card compact-empty">
            <p class="sp-secondary">你还没有发表过评价，去待评价列表写一条吧。</p>
          </div>
        } @else {
          <div class="review-list">
            @for (review of mine(); track review.key) {
              <article class="sp-card review-card">
                <div class="review-head">
                  <img class="thumb" [src]="review.image" [alt]="review.title" width="56" height="56" loading="lazy" />
                  <div class="review-meta">
                    <a class="title sp-clamp-1" [routerLink]="['/product', review.productId]">{{ review.title }}</a>
                    <div class="rating-row">
                      <app-rating-stars [value]="review.rating" [size]="14" />
                      <span class="sp-text-12 sp-muted sp-num">{{ review.rating }} 分</span>
                      <span class="sp-text-12 sp-muted sp-num">{{ review.createdAt | spDate }}</span>
                    </div>
                  </div>
                  <a class="detail-link" [routerLink]="['/product', review.productId]" fragment="reviews">
                    查看商品评价 <app-icon name="arrow-right" [size]="14" />
                  </a>
                </div>
                <div class="review-author">
                  <img class="author-avatar" [src]="myAvatar()" [alt]="displayName() + '的头像'" width="24" height="24" loading="lazy" />
                  <span class="author-name">{{ displayName() }}</span>
                  <span class="sp-badge sp-badge--success author-badge">已发布</span>
                  <span class="author-date sp-num">{{ review.createdAt | spDate }}</span>
                </div>
                <!-- V04: review body is rendered as raw HTML on purpose. -->
                <div class="review-body" [innerHTML]="review.safeBody"></div>
              </article>
            }
          </div>
        }
      </section>
    }

    <app-review-modal
      [open]="reviewOpen()"
      [productId]="reviewTarget()?.productId ?? null"
      [productTitle]="reviewTarget()?.title ?? ''"
      [productImage]="reviewTarget()?.image ?? ''"
      (closed)="reviewOpen.set(false)"
      (saved)="onSaved()"
    />
  `,
  styles: [
    `
      .page-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px 16px;
        padding-bottom: 20px;
        flex-wrap: wrap;
      }
      .page-head h1 { font-family: var(--sp-serif); font-size: 32px; letter-spacing: .02em; }
      .page-head p { margin-top: 4px; }
      .review-stats { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .stat-chip {
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        padding: 4px 10px;
        border: 1px solid var(--sp-border);
        border-radius: 999px;
        background: var(--sp-surface);
        font-size: 11px;
        color: var(--sp-text-muted);
      }
      .stat-chip strong { font-size: 15px; color: var(--sp-warning); }
      .stat-chip--done strong { color: var(--sp-sage); }

      .skeleton-box { display: flex; flex-direction: column; gap: 12px; }

      .block { margin-bottom: 32px; }
      .section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .section-head h2 { font-size: var(--sp-text-18); }

      .compact-empty { padding: 20px 24px; }

      .pending-list { display: flex; flex-direction: column; gap: 12px; }
      .pending-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 14px 20px;
        background: #FFFDF8;
      }
      .thumb {
        width: 64px;
        height: 64px;
        border-radius: var(--sp-radius-sm);
        object-fit: cover;
        background: var(--sp-bg);
        border: 1px solid var(--sp-border);
        flex: 0 0 auto;
      }
      .pending-info { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 4px; }
      .title { font-size: var(--sp-text-14); font-weight: 600; }
      .title:hover { color: var(--sp-accent-text); }
      .dot-sep { margin: 0 4px; color: var(--sp-text-muted); }
      .order-chip { padding: 0 5px; border-radius: 3px; background: var(--sp-bg); color: var(--sp-text-secondary); }
      .pending-reward { display: flex; align-items: center; gap: 3px; font-size: 10.5px; color: var(--sp-accent-text); }
      .pending-item .sp-btn { flex: 0 0 auto; min-height: 44px; }

      .review-list { display: flex; flex-direction: column; gap: 12px; }
      .review-card { padding: 18px 20px; }
      .review-head { display: flex; align-items: center; gap: 12px; }
      .review-head .thumb { width: 56px; height: 56px; }
      .review-meta { min-width: 0; display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; }
      .detail-link {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        flex: 0 0 auto;
        font-size: var(--sp-text-12);
        font-weight: 600;
        color: var(--sp-info);
      }
      .detail-link:hover { text-decoration: underline; }
      .rating-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .review-author { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
      .author-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; background: var(--sp-bg); border: 1px solid var(--sp-border); }
      .author-name { font-size: 11.5px; font-weight: 600; color: var(--sp-text-secondary); }
      .author-badge { font-size: 10px; padding: 0 6px; }
      .author-date { font-size: 10.5px; color: var(--sp-text-muted); margin-left: auto; }
      .review-body {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--sp-border);
        font-size: var(--sp-text-14);
        line-height: 1.75;
        color: var(--sp-text);
        word-break: break-word;
      }

      @media (max-width: 767px) {
        .page-head h1 { font-size: 28px; }
        .pending-item { flex-wrap: wrap; padding: 12px 16px; }
        .pending-item .sp-btn { width: 100%; min-height: 44px; justify-content: center; }
        .review-head { align-items: flex-start; flex-wrap: wrap; }
        .detail-link { margin-left: 68px; }
      }
    `,
  ],
})
export class ReviewsPage {
  private readonly ordersApi = inject(OrdersApi);
  private readonly reviewsApi = inject(ReviewsApi);
  private readonly auth = inject(AuthStore);
  private readonly sanitizer = inject(DomSanitizer);

  readonly displayName = computed(() => this.auth.user()?.name || '星澜会员');
  readonly myAvatar = computed(() => normalizeAvatar(this.auth.user()?.avatar));
  readonly pending = signal<PendingReview[]>([]);
  readonly mine = signal<MyReviewView[]>([]);
  readonly showSkeleton = signal(false);
  readonly error = signal<string | null>(null);
  readonly requestId = signal<string | undefined>(undefined);
  readonly reviewOpen = signal(false);
  readonly reviewTarget = signal<PendingReview | null>(null);

  readonly skeletonRows = [1, 2, 3];

  private seq = 0;

  constructor() {
    this.load();
  }

  load(): void {
    const seq = ++this.seq;
    this.error.set(null);
    this.requestId.set(undefined);
    this.showSkeleton.set(false);
    const timer = setTimeout(() => {
      if (seq === this.seq) {
        this.showSkeleton.set(true);
      }
    }, 300);

    this.ordersApi.list('completed', 1, 50).subscribe({
      next: (result) => {
        clearTimeout(timer);
        if (seq !== this.seq) {
          return;
        }
        const orders = result.items ?? [];
        const products = new Map<number, ProductMeta>();
        const candidates: PendingReview[] = [];
        for (const order of orders) {
          for (const item of order.items ?? []) {
            if (!products.has(item.productId)) {
              products.set(item.productId, { title: item.title, image: item.image });
            }
            candidates.push({
              orderId: order.id,
              productId: item.productId,
              title: item.title,
              image: item.image,
              createdAt: order.createdAt,
            });
          }
        }

        const productIds = [...products.keys()];
        if (productIds.length === 0) {
          this.showSkeleton.set(false);
          this.apply(candidates, [], products);
          return;
        }

        forkJoin(
          productIds.map((productId) =>
            this.reviewsApi.list(productId, 1, 50).pipe(catchError(() => of(EMPTY_PAGE))),
          ),
        ).subscribe({
          next: (pages) => {
            if (seq !== this.seq) {
              return;
            }
            this.showSkeleton.set(false);
            const reviews = pages.reduce<Review[]>((all, page) => all.concat(page.items ?? []), []);
            this.apply(candidates, reviews, products);
          },
          error: (err) => {
            if (seq !== this.seq) {
              return;
            }
            this.showSkeleton.set(false);
            this.error.set(errorMessage(err));
            this.requestId.set(errorRequestId(err));
          },
        });
      },
      error: (err) => {
        clearTimeout(timer);
        if (seq !== this.seq) {
          return;
        }
        this.showSkeleton.set(false);
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
      },
    });
  }

  openReview(item: PendingReview): void {
    this.reviewTarget.set(item);
    this.reviewOpen.set(true);
  }

  onSaved(): void {
    this.reviewOpen.set(false);
    this.load();
  }

  private apply(
    candidates: PendingReview[],
    reviews: Review[],
    products: Map<number, ProductMeta>,
  ): void {
    const myName = this.auth.user()?.name ?? '';
    const myEmail = this.auth.user()?.email ?? '';
    const userId = this.auth.user()?.id;
    const reviewedIds = new Set<number>(readReviewedProducts(userId));
    const cached = readMyReviews(userId);
    const cachedByProduct = new Map(cached.map((item) => [item.productId, item]));
    const mine: MyReviewView[] = [];
    const seen = new Set<string>();

    for (const review of reviews as ReviewRow[]) {
      // Server reviews store the author as the account email; cached reviews use
      // the display name. Accept either so submitted reviews survive a reload.
      const isMine =
        userId !== undefined && typeof review.userId === 'number'
          ? review.userId === userId
          : (myEmail !== '' && review.userName === myEmail) || (myName !== '' && review.userName === myName);
      if (!isMine) {
        continue;
      }
      reviewedIds.add(review.productId);
      const key = review.productId + ':' + review.id;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const product = products.get(review.productId);
      mine.push({
        key,
        productId: review.productId,
        title: product ? product.title : '商品 ' + review.productId,
        image: product ? product.image : '',
        rating: cachedByProduct.get(review.productId)?.rating ?? review.rating,
        createdAt: review.createdAt,
        safeBody: this.sanitizer.bypassSecurityTrustHtml(review.body ?? ''),
      });
    }

    for (const item of cached) {
      reviewedIds.add(item.productId);
      if (mine.some((entry) => entry.productId === item.productId)) {
        continue;
      }
      const key = item.productId + ':' + item.id;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      mine.push(this.fromCache(item, products));
    }

    mine.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const pending: PendingReview[] = [];
    const seenProducts = new Set<number>();
    for (const candidate of candidates) {
      if (reviewedIds.has(candidate.productId) || seenProducts.has(candidate.productId)) {
        continue;
      }
      seenProducts.add(candidate.productId);
      pending.push(candidate);
    }

    this.pending.set(pending);
    this.mine.set(mine);
  }

  private fromCache(cached: CachedReview, products: Map<number, ProductMeta>): MyReviewView {
    const product = products.get(cached.productId);
    return {
      key: cached.productId + ':' + cached.id,
      productId: cached.productId,
      title: cached.productTitle || (product ? product.title : '商品 ' + cached.productId),
      image: cached.productImage || (product ? product.image : ''),
      rating: cached.rating,
      createdAt: cached.createdAt,
      safeBody: this.sanitizer.bypassSecurityTrustHtml(cached.body ?? ''),
    };
  }
}