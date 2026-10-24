import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    @switch (variant()) {
      @case ('card') {
        <div class="sk-card">
          <div class="sp-skeleton sk-media"></div>
          <div class="sp-skeleton sk-line" style="width: 86%"></div>
          <div class="sp-skeleton sk-line" style="width: 62%"></div>
          <div class="sk-foot">
            <div class="sp-skeleton sk-price"></div>
            <div class="sp-skeleton sk-btn"></div>
          </div>
        </div>
      }
      @case ('detail') {
        <div class="sk-detail">
          <div class="sp-skeleton sk-media"></div>
          <div class="sk-col">
            <div class="sp-skeleton sk-line" style="width: 70%; height: 28px"></div>
            <div class="sp-skeleton sk-line" style="width: 45%"></div>
            <div class="sp-skeleton sk-line" style="width: 30%; height: 32px"></div>
            <div class="sp-skeleton sk-line" style="width: 100%"></div>
            <div class="sp-skeleton sk-line" style="width: 92%"></div>
            <div class="sp-skeleton sk-line" style="width: 60%"></div>
          </div>
        </div>
      }
      @case ('table') {
        <div class="sk-table">
          @for (row of rows; track row) {
            <div class="sp-skeleton sk-row"></div>
          }
        </div>
      }
      @default {
        <div class="sp-skeleton sk-line" [style.width]="width()"></div>
      }
    }
  `,
  styles: [`
    .sk-card {
      display: flex;
      flex-direction: column;
      gap: 9px;
      padding: 0 0 14px;
      background: var(--sp-surface);
      border: 1px solid var(--sp-border);
      border-radius: 10px;
      overflow: hidden;
    }

    .sk-media { aspect-ratio: 1 / 1; width: 100%; border-radius: 0; }
    .sk-line { height: 12px; border-radius: 4px; margin: 0 13px; }
    .sk-foot { display: flex; align-items: center; justify-content: space-between; margin: 4px 13px 0; }
    .sk-price { width: 62px; height: 18px; border-radius: 4px; }
    .sk-btn { width: 52px; height: 30px; border-radius: 6px; }
    .sk-detail { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; }
    .sk-col { display: flex; flex-direction: column; gap: 16px; }
    .sk-table { display: flex; flex-direction: column; gap: 8px; }
    .sk-row { height: 48px; }
    @media (max-width: 767px) { .sk-detail { grid-template-columns: 1fr; } }
  `],
})
export class SkeletonComponent {
  readonly variant = input<'card' | 'detail' | 'table' | 'line'>('line');
  readonly width = input('100%');
  readonly rows = [1, 2, 3, 4, 5, 6];
}
