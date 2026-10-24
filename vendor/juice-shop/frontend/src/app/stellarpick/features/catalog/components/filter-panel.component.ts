import { Component, input, output } from '@angular/core';
import { Category } from '../../../core/models';
import { CatalogQuery, PRICE_RANGES, PriceRange } from './catalog-query';

let instanceSeq = 0;

@Component({
  selector: 'app-filter-panel',
  standalone: true,
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss',
})
export class FilterPanelComponent {
  readonly categories = input<Category[]>([]);
  readonly query = input.required<CatalogQuery>();
  /** Category currently in effect (route category or the category filter). */
  readonly category = input<string | undefined>(undefined);
  readonly showCategory = input(true);
  /** The mobile drawer already has a title bar, so its copy hides this one. */
  readonly showHeader = input(true);

  readonly patch = output<Partial<CatalogQuery>>();
  readonly cleared = output<void>();

  readonly ranges = PRICE_RANGES;
  /** Radio groups are per-instance so the sidebar and the drawer never share state. */
  readonly groupName = 'fp-' + ++instanceSeq;

  isRatingChecked(): boolean {
    const rating = this.query().rating;
    return rating !== undefined && rating >= 4.5;
  }

  isPriceRange(range: PriceRange): boolean {
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

  toggleRating(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.patch.emit({ rating: checked ? 4.5 : undefined, page: 1 });
  }

  toggleStock(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.patch.emit({ inStock: checked ? true : undefined, page: 1 });
  }

  clear(): void {
    this.cleared.emit();
  }
}