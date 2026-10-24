import { Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { CatalogQuery, priceFilterLabel } from './catalog-query';

export type ActiveFilterKey = 'category' | 'price' | 'rating' | 'inStock';

export interface ActiveFilter {
  key: ActiveFilterKey;
  label: string;
}

@Component({
  selector: 'app-active-filters',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (filters().length > 0) {
      <div class="active">
        <span class="label">已选条件</span>
        <div class="chips">
          @for (item of filters(); track item.key) {
            <button class="chip" type="button" [attr.aria-label]="'移除筛选：' + item.label" (click)="remove.emit(item.key)">
              <span>{{ item.label }}</span>
              <span class="x" aria-hidden="true"><app-icon name="x" [size]="11" /></span>
            </button>
          }
        </div>
        <button class="clear" type="button" (click)="clear.emit()">清除全部</button>
      </div>
    }
  `,
  styles: [`
    .active {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }

    .label {
      font-size: 11.5px;
      letter-spacing: .06em;
      color: var(--sp-text-muted);
    }

    .chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 30px;
      padding: 0 7px 0 12px;
      border: 1px solid var(--sp-border-strong);
      border-radius: var(--sp-radius-pill);
      background: var(--sp-surface);
      color: var(--sp-text);
      font-size: 12px;
      transition: border-color .15s ease, color .15s ease;
    }

    .chip:hover { border-color: var(--sp-primary); color: var(--sp-primary); }

    .x {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--sp-bg);
      color: var(--sp-text-muted);
    }

    .chip:hover .x { background: var(--sp-primary); color: #fff; }

    .clear {
      border: 0;
      background: transparent;
      color: var(--sp-text-secondary);
      font-size: 12px;
      padding: 6px 4px;
      min-height: 30px;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .clear:hover { color: var(--sp-accent-text); }

    @media (max-width: 767px) {
      .chip { min-height: 34px; }
      .clear { min-height: 34px; }
    }
  `],
})
export class ActiveFiltersComponent {
  readonly query = input.required<CatalogQuery>();
  readonly categoryName = input<string | undefined>(undefined);
  readonly remove = output<ActiveFilterKey>();
  readonly clear = output<void>();

  readonly filters = computed<ActiveFilter[]>(() => {
    const query = this.query();
    const list: ActiveFilter[] = [];
    const categoryName = this.categoryName();
    if (categoryName) {
      list.push({ key: 'category', label: '分类：' + categoryName });
    }
    const price = priceFilterLabel(query);
    if (price) {
      list.push({ key: 'price', label: '价格：' + price });
    }
    if (query.rating !== undefined) {
      list.push({ key: 'rating', label: '评分 ' + query.rating + ' 分及以上' });
    }
    if (query.inStock) {
      list.push({ key: 'inStock', label: '仅看有货' });
    }
    return list;
  });
}
