import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-rating-stars',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (editable()) {
      <!-- Editable ratings stay a group of buttons so keyboard users can pick a score. -->
      <div class="stars" role="group" [attr.aria-label]="label()">
        @for (star of stars; track star) {
          <button type="button" class="star" [class.on]="star <= value()" (click)="pick(star)"
                  [attr.aria-label]="star + ' 星'" [attr.aria-pressed]="star === value()">
            <app-icon name="star" [size]="size()" />
          </button>
        }
      </div>
    } @else {
      <!-- Read-only ratings are a single image: role="img" makes aria-label valid. -->
      <div class="stars" role="img" [attr.aria-label]="label()">
        @for (star of stars; track star) {
          <span class="star" [class.on]="star <= value()"><app-icon name="star" [size]="size()" /></span>
        }
      </div>
    }
  `,
  styles: [`
    .stars { display: inline-flex; gap: 2px; color: #D0D5DD; }
    .star.on { color: #E8A33D; }
    .star { display: inline-flex; padding: 0; border: 0; background: none; color: inherit; }
    .editable .star { padding: 4px; min-width: 32px; min-height: 32px; }
    .editable .star:focus-visible { outline: 2px solid var(--sp-focus); border-radius: 4px; }
  `],
})
export class RatingStarsComponent {
  readonly value = input(0);
  readonly size = input(14);
  readonly editable = input(false);
  readonly rated = output<number>();
  readonly stars = [1, 2, 3, 4, 5];

  label(): string {
    return '评分 ' + this.value() + ' 分（满分 5 分）';
  }

  pick(star: number): void {
    this.rated.emit(star);
  }
}
