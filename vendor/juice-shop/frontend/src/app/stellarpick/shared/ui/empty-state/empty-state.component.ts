import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

const IMAGES: Record<string, string> = {
  search: '/assets/sp/img/empty-search.svg',
  cart: '/assets/sp/img/empty-cart.svg',
  orders: '/assets/sp/img/empty-orders.svg',
  error: '/assets/sp/img/error.svg',
  'not-found': '/assets/sp/img/not-found.svg',
};

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="empty">
      <span class="art">
        <img [src]="imageSrc()" alt="" width="240" height="187" />
      </span>
      <h2>{{ title() }}</h2>
      @if (description()) { <p>{{ description() }}</p> }
      @if (actionLabel()) {
        @if (actionLink()) {
          <a class="sp-btn sp-btn--primary" [routerLink]="actionLink()">{{ actionLabel() }}</a>
        } @else {
          <button class="sp-btn sp-btn--primary" type="button" (click)="action.emit()">{{ actionLabel() }}</button>
        }
      }
    </div>
  `,
  styles: [`
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 44px 20px 48px;
      text-align: center;
      background: var(--sp-surface);
      border: 1px solid var(--sp-border);
      border-radius: 14px;
    }

    .art {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 132px;
      height: 132px;
      margin-bottom: 6px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 30% 25%, #FFFFFF 0%, rgba(255, 255, 255, 0) 70%),
        var(--sp-paper-deep);
    }

    .art img { width: 92px; height: auto; }

    .empty h2 {
      font-family: var(--sp-serif);
      font-size: 20px;
      font-weight: 600;
      letter-spacing: .01em;
    }

    .empty p {
      max-width: 420px;
      font-size: 13px;
      line-height: 1.75;
      color: var(--sp-text-secondary);
    }

    .empty .sp-btn { margin-top: 14px; }

    @media (max-width: 767px) {
      .empty { padding: 32px 16px 36px; }
      .art { width: 108px; height: 108px; }
      .art img { width: 76px; }
    }
  `],
})
export class EmptyStateComponent {
  readonly title = input('这里什么都没有');
  readonly description = input('');
  readonly image = input('search');
  readonly actionLabel = input('');
  readonly actionLink = input<string | unknown[] | null>(null);
  readonly action = output<void>();
  readonly imageSrc = () => IMAGES[this.image()] ?? IMAGES['search'];
}
