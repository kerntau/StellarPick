import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Order, Paged } from '../models';

const PRODUCT_IMAGE_BASE = '/assets/public/images/products/';
const FALLBACK_IMAGE = PRODUCT_IMAGE_BASE + 'sp-1001.svg';

/**
 * Lab orders store bare filenames ("sp-1003.svg") while the catalog stores
 * absolute asset URLs. Normalise both shapes so every thumbnail resolves.
 */
export function normalizeProductImage(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return FALLBACK_IMAGE;
  }
  if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }
  if (raw.startsWith('/assets/') || raw.startsWith('/uploads/')) {
    return raw;
  }
  const file = raw.split('/').pop() ?? raw;
  return PRODUCT_IMAGE_BASE + file;
}

function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeOrder(order: Order): Order {
  const items = (order.items ?? []).map((item) => ({
    ...item,
    image: normalizeProductImage(item.image),
    subtotal: item.subtotal ?? round2(Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0)),
  }));
  return { ...order, items };
}

export interface CreateOrderAddress {
  recipient: string;
  phone: string;
  region: string;
  detail: string;
}

export interface CreateOrderPayload {
  items: { productId: number; title?: string; image?: string; unitPrice: number; quantity: number }[];
  addressId?: number;
  address?: CreateOrderAddress;
  shipping?: string;
  invoice?: string;
}

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);

  create(payload: CreateOrderPayload): Observable<{ id: number; status: string; total: number }> {
    // V09: unitPrice comes straight from the client.
    return this.http.post<{ id: number; status: string; total: number }>('/api/checkout', {
      items: payload.items,
      addressId: payload.addressId,
      address: payload.address,
      shipping: payload.shipping,
      invoice: payload.invoice,
    });
  }

  list(status?: string, page = 1, size = 10): Observable<Paged<Order>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Paged<Order>>('/api/orders', { params }).pipe(
      map((res) => {
        // The lab endpoint returns every seeded order; filter and paginate here.
        const filtered = (res.items ?? [])
          .map((order) => normalizeOrder(order))
          .filter((order) => !status || order.status === status);
        const currentPage = Math.max(1, Number(page) || 1);
        const pageSize = Math.max(1, Number(size) || 10);
        const start = (currentPage - 1) * pageSize;
        return {
          items: filtered.slice(start, start + pageSize),
          total: filtered.length,
          page: currentPage,
          size: pageSize,
        } as Paged<Order>;
      }),
    );
  }

  get(id: number | string): Observable<Order> {
    // V05: no ownership check on the client or the server.
    return this.http.get<Order>('/api/orders/' + id).pipe(map((order) => normalizeOrder(order)));
  }

  pay(id: number): Observable<Order> {
    return this.http.post<Order>('/api/orders/' + id + '/pay', {}).pipe(map((order) => normalizeOrder(order)));
  }

  cancel(id: number): Observable<Order> {
    return this.http.post<Order>('/api/orders/' + id + '/cancel', {}).pipe(map((order) => normalizeOrder(order)));
  }

  confirm(id: number): Observable<Order> {
    return this.http.post<Order>('/api/orders/' + id + '/confirm', {}).pipe(map((order) => normalizeOrder(order)));
  }
}