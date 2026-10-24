import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PRODUCT_META } from '../catalog';
import { MerchantOrder, MerchantProduct } from '../models';

/**
 * Merchant adapter for the lab backend (routes/stellarpick.ts).
 *
 * Contract notes (confirmed against the running server):
 * - GET /api/merchant/products returns { items } with { id, name, price, stock, image, status }
 *   where image is a bare file name ("sp-1001.svg"). No title/sales/category/total fields.
 * - GET /api/merchant/orders returns every order and ignores status/page/size, and its
 *   items carry bare image names as well. Filtering and paging therefore happen on the client.
 * - PATCH only persists name/price/status (stock is fixed by the demo backend).
 */
const IMAGE_BASE = '/assets/public/images/products/';

export interface MerchantProductInput {
  title: string;
  price: number;
  image: string;
  status: string;
  stock?: number;
  category?: string;
}

interface RawProduct {
  id?: number;
  name?: string;
  title?: string;
  price?: number;
  stock?: number;
  image?: string;
  status?: string;
}

interface RawOrderItem {
  productId?: number;
  title?: string;
  image?: string;
  unitPrice?: number;
  quantity?: number;
  subtotal?: number;
}

interface RawOrder {
  id?: number;
  buyerName?: string;
  total?: number;
  status?: string;
  statusText?: string;
  createdAt?: string;
  trackingNo?: string;
  items?: RawOrderItem[];
}

/** Bare file names from the API are resolved against the served product image folder. */
export function spProductImage(file: string | undefined, id: number): string {
  const name = String(file ?? '').trim() || 'sp-' + id + '.svg';
  return name.startsWith('/') || name.startsWith('http') ? name : IMAGE_BASE + name;
}

function toProduct(raw: RawProduct): MerchantProduct {
  const id = Number(raw.id ?? 0);
  const meta = PRODUCT_META[id];
  return {
    id,
    title: String(raw.title ?? raw.name ?? '商品 #' + id),
    price: Number(raw.price ?? 0),
    stock: Number(raw.stock ?? 100),
    status: String(raw.status ?? 'on_sale'),
    image: spProductImage(raw.image, id),
    sales: meta?.sales ?? 0,
    category: meta?.categoryId ?? 'all',
  };
}

function toOrder(raw: RawOrder): MerchantOrder {
  const items = (raw.items ?? []).map((item) => ({
    productId: Number(item.productId ?? 0),
    title: String(item.title ?? '商品'),
    image: spProductImage(item.image, Number(item.productId ?? 0)),
    unitPrice: Number(item.unitPrice ?? 0),
    quantity: Number(item.quantity ?? 0),
    subtotal: Number(item.subtotal ?? Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0)),
  }));
  return {
    id: Number(raw.id ?? 0),
    buyerName: String(raw.buyerName ?? '—'),
    total: Number(raw.total ?? 0),
    status: String(raw.status ?? ''),
    statusText: String(raw.statusText ?? ''),
    createdAt: String(raw.createdAt ?? ''),
    trackingNo: raw.trackingNo ? String(raw.trackingNo) : undefined,
    items,
  };
}

@Injectable({ providedIn: 'root' })
export class MerchantApi {
  private readonly http = inject(HttpClient);

  summary(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>('/api/merchant/summary');
  }

  products(): Observable<MerchantProduct[]> {
    return this.http
      .get<{ items?: RawProduct[] }>('/api/merchant/products')
      .pipe(map((res) => (res.items ?? []).map(toProduct).sort((a, b) => a.id - b.id)));
  }

  createProduct(payload: MerchantProductInput): Observable<MerchantProduct> {
    return this.http.post<RawProduct>('/api/merchant/products', payload).pipe(map(toProduct));
  }

  updateProduct(id: number, payload: Partial<MerchantProductInput>): Observable<MerchantProduct> {
    return this.http.patch<RawProduct>('/api/merchant/products/' + id, payload).pipe(map(toProduct));
  }

  orders(): Observable<MerchantOrder[]> {
    return this.http
      .get<{ items?: RawOrder[] }>('/api/merchant/orders')
      .pipe(map((res) => (res.items ?? []).map(toOrder)));
  }

  ship(id: number, trackingNo: string): Observable<{ id: number; status: string; trackingNo: string }> {
    return this.http.post<{ id: number; status: string; trackingNo: string }>(
      '/api/merchant/orders/' + id + '/ship',
      { trackingNo },
    );
  }
}
