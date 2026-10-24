import { Injectable, inject, signal } from '@angular/core';
import { ProductsApi } from '../../../core/api/products.api';
import { Category } from '../../../core/models';
import { CATEGORY_FALLBACK, normalizeCategories } from './catalog-query';

/**
 * One shared /api/categories request for the catalog pages and the filter panel.
 * Falls back to the local six-category list when the API is unavailable.
 */
@Injectable({ providedIn: 'root' })
export class CatalogCategoriesStore {
  private readonly api = inject(ProductsApi);
  private readonly _categories = signal<Category[]>([]);
  private readonly _ready = signal(false);
  private readonly _failed = signal(false);
  private started = false;

  readonly categories = this._categories.asReadonly();
  readonly ready = this._ready.asReadonly();
  readonly failed = this._failed.asReadonly();

  ensureLoaded(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.api.categories().subscribe({
      next: (res) => {
        // "all" is a synthetic aggregate, not a filterable category: keeping it
        // duplicated the "全部分类" radio and double-counted the category page badge.
        const list = normalizeCategories(res).filter((item) => item.slug !== 'all');
        this._categories.set(list.length > 0 ? list : [...CATEGORY_FALLBACK]);
        this._ready.set(true);
      },
      error: () => {
        this._categories.set([...CATEGORY_FALLBACK]);
        this._failed.set(true);
        this._ready.set(true);
      },
    });
  }
}