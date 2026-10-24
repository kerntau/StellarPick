import { Component, effect, inject, input, output, signal } from '@angular/core';
import { Review, errorMessage } from '../../../core/models';
import { ReviewsApi } from '../../../core/api/reviews.api';
import { AuthStore } from '../../../core/auth/auth.store';
import { ToastService } from '../../../core/toast.service';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { RatingStarsComponent } from '../../../shared/ui/rating-stars/rating-stars.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { markReviewed } from './review-cache';

@Component({
  selector: 'app-review-modal',
  standalone: true,
  imports: [ModalComponent, RatingStarsComponent, IconComponent],
  template: `
    <app-modal [open]="open()" title="写评价" (closed)="close()">
      @if (error()) {
        <div class="sp-alert sp-alert--error" role="alert">{{ error() }}</div>
      }

      <div class="product">
        @if (productImage()) {
          <img [src]="productImage()" alt="" width="56" height="56" loading="lazy" />
        }
        <div>
          <p class="sp-text-13 sp-muted">正在评价</p>
          <p class="name">{{ productTitle() || '商品' }}</p>
        </div>
      </div>

      <div class="sp-field">
        <span class="sp-label" id="rv-rating-label">评分</span>
        <div class="rating-row">
          <app-rating-stars [value]="rating()" [editable]="true" [size]="22" (rated)="rating.set($event)" />
          <span class="sp-text-13 sp-muted" aria-live="polite">{{ rating() }} 分</span>
        </div>
      </div>

      <div class="sp-field">
        <label class="sp-label" for="rv-body">评价内容<span class="sp-req">*</span></label>
        <textarea
          id="rv-body"
          class="sp-textarea"
          rows="5"
          [value]="body()"
          (input)="onBody($event)"
          placeholder="说说使用感受，例如材质、做工、使用场景…"
          aria-describedby="rv-body-hint"
        ></textarea>
        <p class="sp-hint" id="rv-body-hint">评价内容会按原文展示，支持换行与 HTML 片段。</p>
      </div>

      <div class="actions">
        <button class="sp-btn sp-btn--secondary" type="button" (click)="close()">取消</button>
        <button class="sp-btn sp-btn--primary" type="button" [disabled]="submitting()" (click)="submit()">
          @if (submitting()) {
            <app-icon name="refresh" [size]="16" /> 发布中…
          } @else {
            发布评价
          }
        </button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .product { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--sp-bg); border-radius: var(--sp-radius-md); margin-bottom: 20px; }
      .product img { width: 56px; height: 56px; border-radius: var(--sp-radius-sm); object-fit: cover; background: #fff; }
      .product .name { font-weight: 600; font-size: var(--sp-text-14); }
      .rating-row { display: flex; align-items: center; gap: 12px; }
      .sp-alert { margin-bottom: 16px; }
      .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
      @media (max-width: 480px) {
        .actions { flex-direction: column-reverse; }
        .actions .sp-btn { width: 100%; }
      }
    `,
  ],
})
export class ReviewModalComponent {
  private readonly api = inject(ReviewsApi);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly productId = input<number | null>(null);
  readonly productTitle = input('');
  readonly productImage = input('');

  readonly closed = output<void>();
  readonly saved = output<Review>();

  readonly rating = signal(5);
  readonly body = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.rating.set(5);
        this.body.set('');
        this.error.set(null);
        this.submitting.set(false);
      }
    });
  }

  onBody(event: Event): void {
    this.body.set((event.target as HTMLTextAreaElement).value);
  }

  close(): void {
    if (this.submitting()) {
      return;
    }
    this.closed.emit();
  }

  submit(): void {
    const productId = this.productId();
    if (productId === null) {
      this.error.set('缺少商品信息，请刷新后重试。');
      return;
    }
    // V04: the body is submitted verbatim — no escaping, no trimming of markup.
    if (this.body().trim().length === 0) {
      this.error.set('写点使用感受再发布吧。');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.create(productId, this.rating(), this.body()).subscribe({
      next: (review) => {
        this.submitting.set(false);
        markReviewed(productId, {
          id: review?.id ?? Date.now(),
          productId,
          rating: this.rating(),
          body: this.body(),
          createdAt: review?.createdAt ?? new Date().toISOString(),
          productTitle: this.productTitle(),
          productImage: this.productImage(),
        }, this.auth.user()?.id);
        this.toast.show('评价已发布');
        this.saved.emit(review);
        this.closed.emit();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}