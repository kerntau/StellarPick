import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CartApi } from './api/cart.api';
import { AuthStore } from './auth/auth.store';
import { memberPriceFor } from './catalog';
import { Cart, CartItem, Product } from './models';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(CartApi);
  private readonly auth = inject(AuthStore);

  readonly items = signal<CartItem[]>([]);
  readonly total = signal(0);
  readonly count = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));

  refresh(): Observable<Cart> {
    return this.api.get().pipe(tap((cart) => this.apply(cart)));
  }

  add(productId: number, quantity: number, unitPrice: number): Observable<Cart> {
    return this.api.add(productId, quantity, unitPrice).pipe(tap((cart) => this.apply(cart)));
  }

  addProduct(product: Product, quantity = 1): Observable<Cart> {
    return this.add(product.id, quantity, memberPriceFor(product));
  }

  update(itemId: number, quantity: number): Observable<Cart> {
    return this.api.update(itemId, quantity).pipe(tap((cart) => this.apply(cart)));
  }

  remove(itemId: number): Observable<void> {
    return this.api.remove(itemId).pipe(tap(() => this.items.update((list) => list.filter((i) => i.id !== itemId))));
  }

  clear(): void {
    this.items.set([]);
    this.total.set(0);
  }

  private apply(cart: Cart): void {
    this.items.set(cart.items ?? []);
    this.total.set(cart.total ?? 0);
  }
}
