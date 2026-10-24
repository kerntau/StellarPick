import { ParamMap, Params } from '@angular/router';
import { Category, ProductQuery } from '../../../core/models';

/** Sort tokens accepted by GET /api/products (backend: app/routes/products.js). */
export type SortKey = 'default' | 'sales' | 'price_asc' | 'price_desc' | 'newest';

export interface SortOption {
  key: SortKey;
  label: string;
}

export const SORT_OPTIONS: readonly SortOption[] = [
  { key: 'default', label: '综合' },
  { key: 'sales', label: '销量' },
  { key: 'price_asc', label: '价格从低到高' },
  { key: 'price_desc', label: '价格从高到低' },
  { key: 'newest', label: '新品' },
];

/** The shared pagination component only offers 10 / 20 / 50. */
/** Suggestions used by the search landing / no-result state (改词入口). */
export const HOT_KEYWORDS: readonly string[] = ['保温杯', '四件套', '充电器', '香薰', '登机箱', '坚果'];

export const PAGE_SIZES: readonly number[] = [10, 20, 50];
export const DEFAULT_SIZE = 10;
/** Upper bound accepted from a hand-written URL (V01 demo needs size=100). */
export const MAX_SIZE = 100;

export interface PriceRange {
  key: string;
  label: string;
  min?: number;
  max?: number;
}

export const PRICE_RANGES: readonly PriceRange[] = [
  { key: 'lt-100', label: '¥99 及以下', max: 99 },
  { key: '100-299', label: '¥100 – 299', min: 100, max: 299 },
  { key: '300-599', label: '¥300 – 599', min: 300, max: 599 },
  { key: 'gte-600', label: '¥600 及以上', min: 600 },
];

export interface CatalogQuery {
  page: number;
  size: number;
  sort: SortKey;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  inStock?: boolean;
}

/** Fixed context of a results view: the search keyword or the route category. */
export interface CatalogContext {
  q?: string;
  category?: string;
}

export interface CatalogState {
  loading: boolean;
  total: number;
  error: string | null;
  requestId?: string;
}

export const DEFAULT_QUERY: CatalogQuery = { page: 1, size: DEFAULT_SIZE, sort: 'default' };

export const CATEGORY_FALLBACK: readonly Category[] = [
  { slug: 'kitchen', name: '厨房', icon: 'utensils', count: 0, description: '锅具、餐具与咖啡器具，让下厨更顺手' },
  { slug: 'home', name: '家居', icon: 'sofa', count: 0, description: '床品、香薰与收纳，把家安顿得舒服一点' },
  { slug: 'personal', name: '个护', icon: 'droplet', count: 0, description: '洁面、护手与口腔护理，日常更从容' },
  { slug: 'digital', name: '数码', icon: 'smartphone', count: 0, description: '充电、音频与桌面配件，效率与质感兼得' },
  { slug: 'travel', name: '出行', icon: 'briefcase', count: 0, description: '登机箱、晴雨伞与颈枕，路上也自在' },
  { slug: 'food', name: '食品', icon: 'apple', count: 0, description: '咖啡与坚果礼盒，随时补给好状态' },
];

export function fallbackCategory(slug: string): Category | undefined {
  return CATEGORY_FALLBACK.find((item) => item.slug === slug);
}

export function categoryIcon(slug: string): string {
  return fallbackCategory(slug)?.icon ?? 'tag';
}

export function categoryDescription(slug: string): string {
  return fallbackCategory(slug)?.description ?? '精选日常好物，值得长期使用';
}

function isSortKey(value: string): value is SortKey {
  return SORT_OPTIONS.some((option) => option.key === value);
}

/**
 * Read one value from either a router ParamMap (what ActivatedRoute emits) or a
 * plain Params object. ParamMap has no index signature, so params['x'] would
 * silently be undefined for queryParamMap - hence this helper.
 */
function readParam(source: Params | ParamMap, key: string): string | null {
  const getter = (source as ParamMap).get;
  if (typeof getter === 'function') {
    return getter.call(source, key);
  }
  const value = (source as Params)[key];
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : null;
  }
  return value === undefined || value === null ? null : String(value);
}

function numberParam(value: string | null): number | undefined {
  if (value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * URL -> state. Unknown / malformed values fall back to defaults so a shared
 * link can never crash the page.
 */
export function parseCatalogQuery(source: Params | ParamMap): CatalogQuery {
  const pageRaw = numberParam(readParam(source, 'page'));
  const page = pageRaw !== undefined && Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  // Any 1..100 size is honoured so crafted URLs (e.g. V01 demo ?size=100) work;
  // the pagination select itself only offers 10 / 20 / 50.
  const sizeRaw = numberParam(readParam(source, 'size'));
  const size =
    sizeRaw !== undefined && Number.isInteger(sizeRaw) && sizeRaw >= 1 && sizeRaw <= MAX_SIZE
      ? sizeRaw
      : DEFAULT_SIZE;

  const sortRaw = readParam(source, 'sort') ?? '';
  const categoryRaw = readParam(source, 'category');
  const category = categoryRaw !== null && categoryRaw !== '' ? categoryRaw : undefined;

  const minPrice = numberParam(readParam(source, 'minPrice'));
  const maxPrice = numberParam(readParam(source, 'maxPrice'));
  const rating = numberParam(readParam(source, 'rating'));
  const inStockRaw = readParam(source, 'inStock');
  const inStock = inStockRaw === '1' || inStockRaw === 'true';

  const query: CatalogQuery = {
    page,
    size,
    sort: isSortKey(sortRaw) ? sortRaw : 'default',
  };
  if (category !== undefined) {
    query.category = category;
  }
  if (minPrice !== undefined) {
    query.minPrice = minPrice;
  }
  if (maxPrice !== undefined) {
    query.maxPrice = maxPrice;
  }
  if (rating !== undefined) {
    query.rating = rating;
  }
  if (inStock) {
    query.inStock = true;
  }
  return query;
}

/** state -> URL. Defaults are omitted so links stay short and shareable. */
export function catalogQueryParams(query: CatalogQuery): Params {
  const params: Params = {};
  if (query.page > 1) {
    params['page'] = query.page;
  }
  if (query.size !== DEFAULT_SIZE) {
    params['size'] = query.size;
  }
  if (query.sort !== 'default') {
    params['sort'] = query.sort;
  }
  if (query.category) {
    params['category'] = query.category;
  }
  if (query.minPrice !== undefined) {
    params['minPrice'] = query.minPrice;
  }
  if (query.maxPrice !== undefined) {
    params['maxPrice'] = query.maxPrice;
  }
  if (query.rating !== undefined) {
    params['rating'] = query.rating;
  }
  if (query.inStock) {
    params['inStock'] = '1';
  }
  return params;
}

/** Merge a patch; any change that is not an explicit page jump goes back to page 1. */
export function mergeQuery(query: CatalogQuery, patch: Partial<CatalogQuery>): CatalogQuery {
  const next: CatalogQuery = { ...query, ...patch };
  for (const key of Object.keys(patch)) {
    if ((patch as Record<string, unknown>)[key] === undefined) {
      delete (next as unknown as Record<string, unknown>)[key];
    }
  }
  if (patch.page === undefined) {
    next.page = 1;
  }
  return next;
}

/** Combine the fixed context with the user filters into the API query. */
export function toProductQuery(context: CatalogContext, query: CatalogQuery): ProductQuery {
  const category = context.category ?? query.category;
  const productQuery: ProductQuery = {
    sort: query.sort,
    page: query.page,
    size: query.size,
  };
  if (context.q !== undefined) {
    productQuery.q = context.q;
  }
  if (category) {
    productQuery.category = category;
  }
  if (query.minPrice !== undefined) {
    productQuery.minPrice = query.minPrice;
  }
  if (query.maxPrice !== undefined) {
    productQuery.maxPrice = query.maxPrice;
  }
  if (query.rating !== undefined) {
    productQuery.rating = query.rating;
  }
  if (query.inStock) {
    productQuery.inStock = true;
  }
  return productQuery;
}

export function priceFilterLabel(query: CatalogQuery): string {
  const { minPrice, maxPrice } = query;
  if (minPrice !== undefined && maxPrice !== undefined) {
    return '¥' + minPrice + ' – ' + maxPrice;
  }
  if (minPrice !== undefined) {
    return '¥' + minPrice + ' 及以上';
  }
  if (maxPrice !== undefined) {
    return '¥' + maxPrice + ' 及以下';
  }
  return '';
}

/**
 * /api/categories currently answers with { items } while the contract says a
 * plain array; accept both and fill icon/description from the local fallback.
 */
export function normalizeCategories(input: unknown): Category[] {
  const container = input as { items?: unknown } | null;
  let raw: unknown[] = [];
  if (Array.isArray(input)) {
    raw = input;
  } else if (container && Array.isArray(container.items)) {
    raw = container.items;
  }

  const list: Category[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const item = entry as Record<string, unknown>;
    const slug = typeof item['slug'] === 'string' ? item['slug'] : '';
    if (!slug) {
      continue;
    }
    const fallback = fallbackCategory(slug);
    const name = typeof item['name'] === 'string' && item['name'] !== '' ? item['name'] : (fallback?.name ?? slug);
    const icon = typeof item['icon'] === 'string' && item['icon'] !== '' ? item['icon'] : (fallback?.icon ?? 'tag');
    const description =
      typeof item['description'] === 'string' && item['description'] !== ''
        ? item['description']
        : fallback?.description;
    const countRaw = Number(item['count']);
    list.push({
      slug,
      name,
      icon,
      count: Number.isFinite(countRaw) ? countRaw : 0,
      description,
    });
  }
  return list;
}