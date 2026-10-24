import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductsApi } from '../../../core/api/products.api';
import { Product, errorMessage, errorRequestId } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { PaginationComponent } from '../../../shared/ui/pagination/pagination.component';
import { ActiveFiltersComponent, ActiveFilterKey } from './active-filters.component';
import { CatalogCategoriesStore } from './catalog-categories.store';
import { CatalogContext, CatalogQuery, CatalogState, mergeQuery, toProductQuery } from './catalog-query';
import { FilterPanelComponent } from './filter-panel.component';
import { ProductGridComponent } from './product-grid.component';
import { SortBarComponent } from './sort-bar.component';

/**
 * Shared catalog body: filters (sidebar + mobile drawer), sort bar, product
 * grid, pagination and the loading / empty / error states. The page owns the
 * URL, this component owns the request.
 */
@Component({
  selector: 'app-catalog-results',
  standalone: true,
  imports: [
    ActiveFiltersComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    FilterPanelComponent,
    IconComponent,
    ModalComponent,
    PaginationComponent,
    ProductGridComponent,
    RouterLink,
    SortBarComponent,
  ],
  templateUrl: './catalog-results.component.html',
  styleUrl: './catalog-results.component.scss',
})
export class CatalogResultsComponent {
  readonly context = input.required<CatalogContext>();
  readonly query = input.required<CatalogQuery>();
  readonly showCategoryFilter = input(true);
  /** Search results hide the sidebar and render a horizontal filter bar instead. */
  readonly showSidebar = input(true);
  /** 'tile' swaps the shared card for the denser marketplace listing. */
  readonly variant = input<'card' | 'tile'>('card');
  /** Optional "related searches" chips (search page only). */
  readonly relatedSearches = input<string[]>([]);
  readonly emptyTitle = input('没有找到相关商品');
  readonly emptyDescription = input('换个关键词，或清除筛选看看全部商品');
  readonly skeletonCount = input(8);

  readonly queryChange = output<CatalogQuery>();
  readonly stateChange = output<CatalogState>();

  private readonly api = inject(ProductsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly categoriesStore = inject(CatalogCategoriesStore);

  readonly categories = this.categoriesStore.categories;
  readonly products = signal<Product[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly showSkeleton = signal(false);
  readonly error = signal<string | null>(null);
  readonly requestId = signal<string | undefined>(undefined);
  readonly drawerOpen = signal(false);

  /** Search context exposes the keyword for the no-result copy (V03 stays in the page head). */
  readonly keyword = computed(() => this.context().q ?? '');
  readonly isSearch = computed(() => this.context().q !== undefined);
  /** A hand-written ?page=99 has a total but no rows on this page. */
  readonly pageEmpty = computed(() => !this.loading() && this.total() > 0 && this.products().length === 0);

  readonly effectiveCategory = computed(() => this.context().category ?? this.query().category);
  readonly activeCategoryName = computed(() => {
    const slug = this.query().category;
    if (!slug) {
      return undefined;
    }
    return this.categories().find((item) => item.slug === slug)?.name ?? slug;
  });
  readonly activeCount = computed(() => {
    const query = this.query();
    let count = 0;
    if (query.category) {
      count += 1;
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      count += 1;
    }
    if (query.rating !== undefined) {
      count += 1;
    }
    if (query.inStock) {
      count += 1;
    }
    return count;
  });

  private request?: Subscription;
  private skeletonTimer?: ReturnType<typeof setTimeout>;
  private lastKey = '';

  constructor() {
    this.categoriesStore.ensureLoaded();
    effect(() => {
      const context = this.context();
      const query = this.query();
      this.load(context, query);
    });
    this.destroyRef.onDestroy(() => {
      this.request?.unsubscribe();
      if (this.skeletonTimer) {
        clearTimeout(this.skeletonTimer);
      }
    });
  }

  apply(patch: Partial<CatalogQuery>): void {
    // Page jumps should bring the new rows into view instead of leaving the
    // reader at the pager at the bottom of the old page.
    if (patch.page !== undefined && patch.page !== this.query().page) {
      setTimeout(() => {
        document.getElementById('catalog-results')?.scrollIntoView({ block: 'start' });
      }, 0);
    }
    this.queryChange.emit(mergeQuery(this.query(), patch));
  }

  clearFilters(): void {
    this.apply({
      page: 1,
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      rating: undefined,
      inStock: undefined,
    });
  }

  removeFilter(key: ActiveFilterKey): void {
    switch (key) {
      case 'category':
        this.apply({ category: undefined });
        break;
      case 'price':
        this.apply({ minPrice: undefined, maxPrice: undefined });
        break;
      case 'rating':
        this.apply({ rating: undefined });
        break;
      case 'inStock':
        this.apply({ inStock: undefined });
        break;
    }
  }

  retry(): void {
    this.lastKey = '';
    this.load(this.context(), this.query());
  }

  private load(context: CatalogContext, query: CatalogQuery): void {
    const key = JSON.stringify([context, query]);
    if (key === this.lastKey) {
      return;
    }
    this.lastKey = key;

    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.requestId.set(undefined);
    this.showSkeleton.set(false);
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
    }
    this.skeletonTimer = setTimeout(() => {
      if (this.loading()) {
        this.showSkeleton.set(true);
      }
    }, 300);

    this.request = this.api.list(toProductQuery(context, query)).subscribe({
      next: (res) => {
        this.products.set(res.items ?? []);
        this.total.set(res.total ?? 0);
        this.finish();
      },
      error: (err) => {
        this.products.set([]);
        this.total.set(0);
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
        this.finish();
      },
    });
  }

  private finish(): void {
    this.loading.set(false);
    this.showSkeleton.set(false);
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
      this.skeletonTimer = undefined;
    }
    this.stateChange.emit({
      loading: this.loading(),
      total: this.total(),
      error: this.error(),
      requestId: this.requestId(),
    });
  }
}