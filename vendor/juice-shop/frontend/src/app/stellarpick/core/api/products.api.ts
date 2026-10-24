import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CATEGORIES, enrichProduct } from '../catalog';
import { Category, Paged, Product, ProductQuery } from '../models';

interface SearchResponse {
  data?: any[];
}

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);

  /**
   * V01: the keyword is forwarded to the server verbatim - the endpoint
   * concatenates it into SQL, so it must not be filtered or sanitised here.
   */
  private search(keyword: string): Observable<Product[]> {
    return this.http.get<SearchResponse>('/rest/products/search?q=' + encodeURIComponent(keyword)).pipe(
      map((res) => (res.data ?? []).map((row) => enrichProduct(row))),
    );
  }

  private all(): Observable<Product[]> {
    return this.search('');
  }

  list(query: ProductQuery): Observable<Paged<Product>> {
    // Keyword matching is the server's job (V01); category / price / rating /
    // stock filters and pagination are still applied client-side.
    const source = query.q ? this.search(query.q) : this.all();
    return source.pipe(
      map((products) => {
        let items = products;
        if (query.category && query.category !== 'all') {
          items = items.filter((product) => product.categoryId === query.category);
        }
        if (query.minPrice != null) {
          items = items.filter((product) => product.price >= Number(query.minPrice));
        }
        if (query.maxPrice != null) {
          items = items.filter((product) => product.price <= Number(query.maxPrice));
        }
        if (query.rating != null) {
          items = items.filter((product) => product.rating >= Number(query.rating));
        }
        if (query.inStock) {
          items = items.filter((product) => product.stock > 0);
        }

        switch (query.sort) {
          case 'price_asc':
            items = [...items].sort((a, b) => a.price - b.price);
            break;
          case 'price_desc':
            items = [...items].sort((a, b) => b.price - a.price);
            break;
          case 'newest':
            items = [...items].sort((a, b) => b.id - a.id);
            break;
          case 'sales':
            items = [...items].sort((a, b) => b.sales - a.sales);
            break;
          default:
            items = [...items].sort((a, b) => b.rating - a.rating || b.sales - a.sales);
        }

        const total = items.length;
        const page = Math.max(1, Number(query.page ?? 1));
        const size = Math.max(1, Math.min(100, Number(query.size ?? 10)));
        const start = (page - 1) * size;
        return {
          items: items.slice(start, start + size),
          total,
          page,
          size,
        } as Paged<Product>;
      }),
    );
  }

  get(id: number | string): Observable<Product> {
    return this.all().pipe(
      map((products) => products.find((product) => product.id === Number(id))),
      map((product) => {
        if (!product) {
          throw Object.assign(new Error('商品不存在'), { status: 404 });
        }
        return product;
      }),
    );
  }

  categories(): Observable<Category[]> {
    return this.all().pipe(
      map((products) => {
        const counts = new Map<string, number>();
        for (const product of products) {
          counts.set(product.categoryId ?? 'all', (counts.get(product.categoryId ?? 'all') ?? 0) + 1);
        }
        return CATEGORIES.map((category) => ({
          ...category,
          count: category.slug === 'all' ? products.length : counts.get(category.slug) ?? 0,
        }));
      }),
    );
  }
}