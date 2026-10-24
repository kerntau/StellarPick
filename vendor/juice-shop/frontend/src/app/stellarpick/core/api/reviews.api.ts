import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { Paged, Review } from '../models';

@Injectable({ providedIn: 'root' })
export class ReviewsApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);

  list(productId: number | string, page = 1, size = 5): Observable<Paged<Review>> {
    return this.http.get<{ data?: any[] }>('/rest/products/' + productId + '/reviews').pipe(
      map((res) => {
        const rows = res.data ?? [];
        const items = rows.map((row, index) => {
          const rating = Number(row.rating);
          return {
            id: Number(row.id ?? index + 1),
            productId: Number(productId),
            userName: String(row.author ?? '匿名用户'),
            // Seeded reviews carry no star rating; default to 5 so the list stays
            // readable, but never invent a timestamp the API does not return.
            rating: Number.isFinite(rating) && rating > 0 ? Math.min(5, rating) : 5,
            body: String(row.message ?? ''),
            createdAt: String(row.createdAt ?? row.updatedAt ?? ''),
          };
        }) as Review[];
        const start = (Math.max(1, page) - 1) * size;
        const average = Number((res as { avgRating?: unknown }).avgRating);
        return {
          items: items.slice(start, start + size),
          total: items.length,
          page,
          size,
          avgRating: Number.isFinite(average) && average > 0 ? average : undefined,
        } as Paged<Review>;
      }),
    );
  }

  create(productId: number, rating: number, body: string): Observable<Review> {
    // V04: the body is stored and rendered as raw HTML.
    const author = this.auth.user()?.email || '匿名用户';
    return this.http.put<{ data?: any }>('/rest/products/' + productId + '/reviews', { message: body, author }).pipe(
      map((res) => {
        const row = res.data ?? {};
        return {
          id: Number(row.id ?? Date.now()),
          productId,
          userName: String(row.author ?? author),
          rating,
          body: String(row.message ?? body),
          createdAt: String(row.createdAt ?? new Date().toISOString()),
        } as Review;
      }),
    );
  }
}