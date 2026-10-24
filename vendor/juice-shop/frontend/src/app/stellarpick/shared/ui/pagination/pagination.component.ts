import { Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [IconComponent],
  template: `
    <nav class="pager" aria-label="分页">
      <p class="range sp-num">
        @if (total() > 0) {
          第 {{ from() }}–{{ to() }} 件 / 共 {{ total() }} 件
        } @else {
          暂无商品
        }
      </p>

      <div class="pages">
        <button class="pg" type="button" [disabled]="page() <= 1" (click)="go(page() - 1)" aria-label="上一页">
          <app-icon name="chevron-left" [size]="16" />
        </button>
        @for (item of tokens(); track $index) {
          @if (item === '...') {
            <span class="dots">…</span>
          } @else {
            <button class="pg" type="button" [class.on]="item === page()" [attr.aria-current]="item === page() ? 'page' : null"
                    (click)="go(+item)">{{ item }}</button>
          }
        }
        <button class="pg" type="button" [disabled]="page() >= totalPages()" (click)="go(page() + 1)" aria-label="下一页">
          <app-icon name="chevron-right" [size]="16" />
        </button>
      </div>

      <label class="size">
        每页
        <select class="sp-select" [value]="size()" (change)="changeSize($event)">
          @for (option of sizes; track option) { <option [value]="option">{{ option }}</option> }
        </select>
        条
      </label>
    </nav>
  `,
  styles: [`
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid var(--sp-border);
    }

    .range {
      font-size: 12px;
      color: var(--sp-text-muted);
      letter-spacing: .02em;
    }

    .pages { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }

    .pg {
      min-width: 40px;
      height: 40px;
      padding: 0 8px;
      border: 1px solid var(--sp-border);
      background: var(--sp-surface);
      border-radius: 8px;
      font-size: 13px;
      color: var(--sp-text-secondary);
      font-variant-numeric: tabular-nums;
      transition: border-color .15s ease, color .15s ease, background-color .15s ease;
    }

    .pg:hover:not(:disabled) { border-color: var(--sp-primary); color: var(--sp-primary); }

    .pg.on {
      background: var(--sp-primary);
      border-color: var(--sp-primary);
      color: #fff;
      font-weight: 700;
    }

    .pg:disabled { opacity: .38; cursor: not-allowed; }

    .dots { padding: 0 2px; color: var(--sp-text-muted); }

    .size {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--sp-text-secondary);
    }

    .size .sp-select {
      width: 66px;
      min-height: 36px;
      padding: 2px 6px;
      font-size: 12px;
    }

    @media (max-width: 767px) {
      .pager { justify-content: center; gap: 10px; }
      .range { width: 100%; text-align: center; }
      .pg { min-width: 44px; height: 44px; }
      .size { margin-left: 0; }
    }
  `],
})
export class PaginationComponent {
  readonly page = input(1);
  readonly size = input(10);
  readonly total = input(0);
  readonly pageChange = output<number>();
  readonly sizeChange = output<number>();
  readonly sizes = [10, 20, 50];
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));

  readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.size() + 1));
  readonly to = computed(() => Math.min(this.total(), this.page() * this.size()));

  readonly tokens = computed<(number | string)[]>(() => {
    const last = this.totalPages();
    const current = this.page();
    const set = new Set<number>([1, last, current, current - 1, current + 1]);
    const pages = [...set].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
    const out: (number | string)[] = [];
    pages.forEach((p, i) => {
      if (i > 0 && p - pages[i - 1] > 1) {
        out.push('...');
      }
      out.push(p);
    });
    return out;
  });

  go(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) {
      return;
    }
    this.pageChange.emit(page);
  }

  changeSize(event: Event): void {
    this.sizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
