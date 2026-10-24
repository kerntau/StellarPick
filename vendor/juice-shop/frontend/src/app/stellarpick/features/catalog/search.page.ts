import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BreadcrumbComponent, Crumb } from '../../shared/ui/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { CatalogCategoriesStore } from './components/catalog-categories.store';
import { CatalogResultsComponent } from './components/catalog-results.component';
import {
  CatalogQuery,
  CatalogState,
  HOT_KEYWORDS,
  catalogQueryParams,
  mergeQuery,
  parseCatalogQuery,
} from './components/catalog-query';
import { SearchFilterBarComponent } from './components/search-filter-bar.component';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [
    BreadcrumbComponent,
    CatalogResultsComponent,
    EmptyStateComponent,
    IconComponent,
    RouterLink,
    SearchFilterBarComponent,
  ],
  templateUrl: './search.page.html',
  styleUrl: './search.page.scss',
})
export class SearchPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly categoriesStore = inject(CatalogCategoriesStore);

  readonly q = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  readonly draft = signal(this.q());
  readonly query = signal<CatalogQuery>(parseCatalogQuery(this.route.snapshot.queryParamMap));
  readonly total = signal(0);
  readonly hotKeywords = HOT_KEYWORDS;
  readonly categories = this.categoriesStore.categories;

  /** Blank keywords never trigger a request (任务书 §2 搜索). */
  readonly hasQuery = computed(() => this.q().trim().length > 0);
  readonly context = computed(() => ({ q: this.q() }));

  /** Related keywords shown under the results and inside the empty state. */
  readonly relatedSearches = computed<string[]>(() => {
    const keyword = this.q().trim();
    if (!keyword) {
      return [];
    }
    const list: string[] = [];
    // Keyword variants only make sense when the search actually returned rows.
    if (this.total() > 0) {
      for (const suffix of ['礼盒', '套装', '推荐', '大容量', '平价']) {
        list.push(keyword + ' ' + suffix);
      }
    }
    for (const hot of HOT_KEYWORDS) {
      if (hot !== keyword && !list.includes(hot)) {
        list.push(hot);
      }
    }
    return list.slice(0, 8);
  });

  readonly crumbs: Crumb[] = [
    { label: '首页', link: '/' },
    { label: '搜索' },
  ];

  /**
   * V03: the keyword is rendered verbatim through bypassSecurityTrustHtml.
   * Do NOT escape it, do NOT use textContent, do NOT add DOMPurify.
   */
  readonly headline = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml('关于「' + this.q() + '」的 ' + this.total() + ' 件商品'),
  );

  constructor() {
    this.categoriesStore.ensureLoaded();
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const keyword = params.get('q') ?? '';
      const previous = this.q();
      this.q.set(keyword);
      this.draft.set(keyword);
      this.query.set(parseCatalogQuery(params));
      if (keyword !== previous) {
        this.total.set(0);
      }
    });
  }

  onDraftInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  clearInput(): void {
    this.draft.set('');
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    const keyword = this.draft().trim();
    if (!keyword) {
      this.router.navigate(['/search']);
      return;
    }
    this.router.navigate(['/search'], { queryParams: { q: keyword } });
  }

  goAllProducts(): void {
    this.router.navigate(['/category', 'all']);
  }

  onState(state: CatalogState): void {
    this.total.set(state.total);
  }

  onFilterPatch(patch: Partial<CatalogQuery>): void {
    this.onQueryChange(mergeQuery(this.query(), patch));
  }

  onQueryChange(next: CatalogQuery): void {
    const params = {
      ...(this.q() ? { q: this.q() } : {}),
      ...catalogQueryParams(next),
    };
    this.router.navigate([], { relativeTo: this.route, queryParams: params });
  }
}
