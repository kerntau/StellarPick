import { Component, input, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-rating-stars',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (editable()) {
      <!-- Radiogroup with roving tabindex: one tab stop, arrows move the
           highlighted score, Enter/Space commits it. -->
      <div class="stars editable" role="radiogroup" [attr.aria-label]="label()"
           (keydown)="onKeydown($event)">
        @for (star of stars; track star; let i = $index) {
          <button type="button" class="star" [class.on]="star <= value()"
                  role="radio" [attr.aria-checked]="star === value()"
                  [attr.aria-label]="star + ' 星'"
                  [tabindex]="i === focusIndex() ? 0 : -1"
                  (click)="pick(star)" (focus)="focusIndex.set(i)">
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
  readonly focusIndex = signal(0);

  label(): string {
    return '评分 ' + this.value() + ' 分（满分 5 分）';
  }

  pick(star: number): void {
    this.focusIndex.set(star - 1);
    this.rated.emit(star);
  }

  onKeydown(event: KeyboardEvent): void {
    const current = this.focusIndex();
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(this.stars.length - 1, current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = this.stars.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.focusIndex.set(next);
    (event.currentTarget as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.star')[next]
      ?.focus();
  }
}
