import { Component, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BreadcrumbComponent, Crumb } from '../../shared/ui/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { CatalogCategoriesStore } from './components/catalog-categories.store';
import { CatalogResultsComponent } from './components/catalog-results.component';
import {
  CATEGORY_FALLBACK,
  CatalogQuery,
  CatalogState,
  catalogQueryParams,
  categoryDescription,
  categoryIcon,
  parseCatalogQuery,
} from './components/catalog-query';

interface CategoryLink {
  slug: string;
  name: string;
  count: number;
}

@Component({
  selector: 'app-category-page',
  standalone: true,
  imports: [BreadcrumbComponent, CatalogResultsComponent, EmptyStateComponent, RouterLink],
  templateUrl: './category.page.html',
  styleUrl: './category.page.scss',
})
export class CategoryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly categoriesStore = inject(CatalogCategoriesStore);

  readonly slug = signal(this.route.snapshot.paramMap.get('slug') ?? 'all');
  readonly query = signal<CatalogQuery>(parseCatalogQuery(this.route.snapshot.queryParamMap));

  readonly categories = this.categoriesStore.categories;
  readonly ready = this.categoriesStore.ready;
  readonly category = computed(() => this.categories().find((item) => item.slug === this.slug()) ?? null);
  readonly notFound = computed(() => this.ready() && this.slug() !== 'all' && this.category() === null);

  readonly name = computed(() => {
    if (this.slug() === 'all') {
      return '全部商品';
    }
    return (
      this.category()?.name ??
      CATEGORY_FALLBACK.find((item) => item.slug === this.slug())?.name ??
      this.slug()
    );
  });

  readonly description = computed(() => {
    if (this.slug() === 'all') {
      return '六大类目精选好物，按销量与价格慢慢挑。';
    }
    return this.category()?.description ?? categoryDescription(this.slug());
  });

  readonly icon = computed(() => this.category()?.icon ?? categoryIcon(this.slug()));

  /** Illustrations that failed to load fall back to a paper tile. */
  readonly imageFailed = signal<ReadonlySet<string>>(new Set());

  /** 4:3 category illustration; /category/all borrows the living-room scene. */
  readonly bannerImage = computed(() =>
    this.slug() === 'all'
      ? '/assets/sp/img/scenes/living.svg'
      : '/assets/sp/img/categories/' + this.slug() + '.svg',
  );

  tileImage(slug: string): string {
    return '/assets/sp/img/categories/' + slug + '.svg';
  }

  onImageError(key: string): void {
    const next = new Set(this.imageFailed());
    next.add(key);
    this.imageFailed.set(next);
  }

  /** Real product count of the category (the /api/categories list carries no 'all' bucket). */
  readonly count = computed<number | null>(() => {
    if (!this.ready() || this.categoriesStore.failed()) {
      return null;
    }
    const list = this.categories();
    if (this.slug() === 'all') {
      const all = list.find((item) => item.slug === 'all');
      if (all) {
        return all.count;
      }
      return list.reduce((total, item) => total + (item.count || 0), 0);
    }
    const current = this.category();
    // A real category with 0 visible products still shows "0 件商品".
    return current ? current.count : null;
  });

  /** Category switcher: 全部 + the six real categories, never the pseudo "all" bucket twice. */
  readonly navCategories = computed<CategoryLink[]>(() => {
    const list = this.categories();
    const all = list.find((item) => item.slug === 'all');
    const rest = list
      .filter((item) => item.slug !== 'all')
      .map((item) => ({ slug: item.slug, name: item.name, count: item.count || 0 }));
    const total = all ? all.count : rest.reduce((sum, item) => sum + item.count, 0);
    return [{ slug: 'all', name: '全部商品', count: total }, ...rest];
  });

  /** Total of the current filter combination, reported by the shared catalog body. */
  readonly resultTotal = signal<number | null>(null);
  readonly filtersActive = computed(() => {
    const query = this.query();
    return (
      query.category !== undefined ||
      query.minPrice !== undefined ||
      query.maxPrice !== undefined ||
      query.rating !== undefined ||
      query.inStock === true
    );
  });

  readonly context = computed(() => ({
    category: this.slug() !== 'all' ? this.slug() : undefined,
  }));

  readonly crumbs = computed<Crumb[]>(() => [
    { label: '首页', link: '/' },
    { label: '分类', link: '/category/all' },
    { label: this.notFound() ? '分类不存在' : this.name() },
  ]);

  constructor() {
    this.categoriesStore.ensureLoaded();

    effect(() => {
      const name = this.notFound() ? '分类不存在' : this.name();
      this.title.setTitle(name + ' · 星澜优选');
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.slug.set(params.get('slug') ?? 'all');
      this.resultTotal.set(null);
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.query.set(parseCatalogQuery(params));
    });
  }

  onStateChange(state: CatalogState): void {
    this.resultTotal.set(state.total);
  }

  onQueryChange(next: CatalogQuery): void {
    const base = this.slug() === 'all' ? undefined : this.slug();
    const params = catalogQueryParams({ ...next, category: undefined });

    // Picking another category from /category/all switches the route instead of
    // stacking a ?category= filter on top of the page.
    if (next.category && next.category !== base) {
      this.router.navigate(['/category', next.category], { queryParams: params });
      return;
    }

    this.router.navigate([], { relativeTo: this.route, queryParams: params });
  }
}
