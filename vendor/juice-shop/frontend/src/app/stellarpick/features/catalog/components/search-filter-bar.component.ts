import { Component, input, output } from '@angular/core';
import { Category } from '../../../core/models';
import { CatalogQuery, PRICE_RANGES, PriceRange } from './catalog-query';

/**
 * Horizontal quick-filter bar used by the search results page. It exposes the
 * same four filters as the catalog sidebar (category / price / rating / stock)
 * as chips, which is how real search result pages present them.
 */
@Component({
  selector: 'app-search-filter-bar',
  standalone: true,
  template: `
    <div class="bar">
      <div class="row" role="group" aria-label="按分类筛选">
        <span class="label">分类</span>
        <div class="chips">
          <button class="chip" type="button" [class.on]="!query().category" [attr.aria-pressed]="!query().category" (click)="pickCategory(undefined)">全部</button>
          @for (item of categories(); track item.slug) {
            <button class="chip" type="button" [class.on]="query().category === item.slug" [attr.aria-pressed]="query().category === item.slug" (click)="pickCategory(item.slug)">
              {{ item.name }}
              @if (item.count > 0) { <span class="count sp-num">{{ item.count }}</span> }
            </button>
          }
        </div>
      </div>

      <div class="row" role="group" aria-label="按价格筛选">
        <span class="label">价格</span>
        <div class="chips">
          <button class="chip" type="button" [class.on]="query().minPrice === undefined && query().maxPrice === undefined" [attr.aria-pressed]="query().minPrice === undefined && query().maxPrice === undefined" (click)="pickPrice(null)">全部</button>
          @for (range of ranges; track range.key) {
            <button class="chip" type="button" [class.on]="isPrice(range)" [attr.aria-pressed]="isPrice(range)" (click)="pickPrice(range)">{{ range.label }}</button>
          }
        </div>
      </div>

      <div class="row" role="group" aria-label="按评分与库存筛选">
        <span class="label">筛选</span>
        <div class="chips">
          <button class="chip" type="button" [class.on]="query().rating !== undefined" [attr.aria-pressed]="query().rating !== undefined" (click)="toggleRating()">4.5 分及以上</button>
          <button class="chip" type="button" [class.on]="query().inStock === true" [attr.aria-pressed]="query().inStock === true" (click)="toggleStock()">仅看有货</button>
          <button class="chip chip--ghost" type="button" (click)="clear()">清除筛选</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bar { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; background: var(--sp-surface); border: 1px solid var(--sp-border); border-radius: 4px; }
    .row { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
    .label { flex: 0 0 32px; padding-top: 7px; font-size: 12px; color: var(--sp-text-muted); white-space: nowrap; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
    .chip { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0 11px; border: 1px solid transparent; border-radius: 3px; background: transparent; color: var(--sp-text-secondary); font-size: 12px; white-space: nowrap; }
    .chip:hover { background: #F4F0E8; color: var(--sp-primary); }
    .chip.on { border-color: var(--sp-primary); background: #F4F0E8; color: var(--sp-primary); font-weight: 600; }
    .chip--ghost { margin-left: auto; color: var(--sp-text-muted); text-decoration: underline; text-underline-offset: 3px; }
    .count { color: var(--sp-text-muted); font-weight: 400; }
    @media (max-width: 1023px) {
      .row { flex-direction: column; gap: 2px; }
      .label { padding-top: 0; }
      .chips { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; width: 100%; padding-bottom: 2px; }
      .chips::-webkit-scrollbar { display: none; }
      .chip { min-height: 44px; }
      .chip--ghost { margin-left: 0; }
    }
    /* Phones: one horizontally scrolling rail instead of three stacked rows. */
    @media (max-width: 767px) {
      .bar { flex-direction: row; align-items: center; gap: 8px; padding: 8px 10px; overflow-x: auto; scrollbar-width: none; }
      .bar::-webkit-scrollbar { display: none; }
      .row { flex-direction: row; align-items: center; flex: 0 0 auto; gap: 6px; }
      .row + .row { padding-left: 8px; border-left: 1px solid var(--sp-border); }
      .label { flex: 0 0 auto; }
      .chips { flex-wrap: nowrap; overflow: visible; width: auto; padding-bottom: 0; }
      .chip { min-height: 44px; }
    }
  `],
})
export class SearchFilterBarComponent {
  readonly categories = input<Category[]>([]);
  readonly query = input.required<CatalogQuery>();
  readonly patch = output<Partial<CatalogQuery>>();

  readonly ranges = PRICE_RANGES;

  isPrice(range: PriceRange): boolean {
    const query = this.query();
    return query.minPrice === range.min && query.maxPrice === range.max;
  }

  pickCategory(slug: string | undefined): void {
    this.patch.emit({ category: slug, page: 1 });
  }

  pickPrice(range: PriceRange | null): void {
    if (range === null) {
      this.patch.emit({ minPrice: undefined, maxPrice: undefined, page: 1 });
      return;
    }
    this.patch.emit({ minPrice: range.min, maxPrice: range.max, page: 1 });
  }

  toggleRating(): void {
    const active = this.query().rating !== undefined;
    this.patch.emit({ rating: active ? undefined : 4.5, page: 1 });
  }

  toggleStock(): void {
    const active = this.query().inStock === true;
    this.patch.emit({ inStock: active ? undefined : true, page: 1 });
  }

  clear(): void {
    this.patch.emit({
      page: 1,
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      rating: undefined,
      inStock: undefined,
    });
  }
}
