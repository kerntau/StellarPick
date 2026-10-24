import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Cart, CartItem } from '../models';

/**
 * The cart endpoint stores the bare image file name (for example
 * "sp-1003.svg"). The storefront serves product artwork from
 * /assets/public/images/products, so the adapter resolves it once here and
 * every cart consumer receives a renderable URL.
 */
function resolveImage(value: string): string {
  const image = String(value ?? '').trim();
  if (!image) {
    return '/assets/public/images/products/sp-1001.svg';
  }
  if (image.startsWith('/') || /^https?:\/\//i.test(image)) {
    return image;
  }
  return '/assets/public/images/products/' + image;
}

function normalizeCart(cart: Cart): Cart {
  const items: CartItem[] = (cart?.items ?? []).map((item) => ({
    ...item,
    image: resolveImage(item.image),
  }));
  return {
    items,
    total: Number(cart?.total ?? 0),
    count: Number(cart?.count ?? 0),
  };
}

@Injectable({ providedIn: 'root' })
export class CartApi {
  private readonly http = inject(HttpClient);

  get(): Observable<Cart> {
    return this.http.get<Cart>('/api/cart').pipe(map((cart) => normalizeCart(cart)));
  }

  add(productId: number, quantity: number, unitPrice: number): Observable<Cart> {
    return this.http
      .post<Cart>('/api/cart/items', { productId, quantity, unitPrice })
      .pipe(map((cart) => normalizeCart(cart)));
  }

  update(itemId: number, quantity: number): Observable<Cart> {
    return this.http
      .patch<Cart>('/api/cart/items/' + itemId, { quantity })
      .pipe(map((cart) => normalizeCart(cart)));
  }

  remove(itemId: number): Observable<void> {
    return this.http.delete<void>('/api/cart/items/' + itemId);
  }
}
