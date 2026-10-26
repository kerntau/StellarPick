import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Address, Coupon, Paged } from '../models';

interface RawAddress {
  id: number;
  name?: string;
  fullName?: string;
  phone?: string;
  mobileNum?: string;
  region?: string;
  detail?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  isDefault?: boolean;
}

interface RawUser {
  id?: number;
  username?: string;
  email?: string;
  profileImage?: string;
  createdAt?: string;
  isActive?: boolean;
  role?: string;
}

export interface AccountProfile {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  createdAt?: string;
  active: boolean;
}

function toAddress(row: RawAddress): Address {
  const region = row.region ?? [row.state, row.city].filter(Boolean).join(' / ');
  return {
    id: Number(row.id),
    name: String(row.name ?? row.fullName ?? ''),
    phone: String(row.phone ?? row.mobileNum ?? ''),
    region,
    detail: String(row.detail ?? row.streetAddress ?? ''),
    isDefault: Boolean(row.isDefault),
  };
}

/**
 * The lab address book (routes/stellarpick.ts) reads name/phone/region/detail.
 * Only send the keys the caller actually supplied so PATCH (e.g. "set default")
 * never blanks the rest of the record.
 */
function toAddressBody(payload: Partial<Address>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    body['name'] = payload.name;
  }
  if (payload.phone !== undefined) {
    body['phone'] = payload.phone;
  }
  if (payload.region !== undefined) {
    body['region'] = payload.region;
  }
  if (payload.detail !== undefined) {
    body['detail'] = payload.detail;
  }
  if (payload.isDefault !== undefined) {
    body['isDefault'] = payload.isDefault;
  }
  return body;
}

@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly http = inject(HttpClient);

  addresses(): Observable<Address[]> {
    return this.http.get<{ items?: RawAddress[] }>('/api/addresses').pipe(
      map((res) => (res.items ?? []).map((row) => toAddress(row))),
    );
  }

  createAddress(payload: Omit<Address, 'id'>): Observable<Address> {
    return this.http.post<RawAddress>('/api/addresses', toAddressBody(payload)).pipe(map((row) => toAddress(row)));
  }

  updateAddress(id: number, payload: Partial<Address>): Observable<Address> {
    return this.http
      .patch<RawAddress>('/api/addresses/' + id, toAddressBody(payload))
      .pipe(map((row) => toAddress(row)));
  }

  deleteAddress(id: number): Observable<void> {
    return this.http.delete<void>('/api/addresses/' + id);
  }

  updateEmail(email: string): Observable<string | null> {
    // V08: no CSRF token, no Origin check. The server re-issues the JWT in a
    // response header so the header/sidebar and order list stop using the old email.
    return this.http.post<void>('/api/account/email', { email }, { observe: 'response' }).pipe(
      map((res) => res.headers.get('X-StellarPick-Token')),
    );
  }

  changePassword(current: string, next: string): Observable<void> {
    // Juice Shop's route requires current + new + repeat (routes/changePassword.ts).
    return this.http.get<void>('/rest/user/change-password', {
      params: { current, new: next, repeat: next },
    });
  }

  /** Registration date / stored avatar for the profile card. */
  profile(id: number): Observable<AccountProfile> {
    return this.http.get<{ data?: RawUser }>('/api/Users/' + id).pipe(
      map((res) => {
        const row = res.data ?? {};
        return {
          id: Number(row.id ?? id),
          username: String(row.username ?? ''),
          email: String(row.email ?? ''),
          avatar: row.profileImage ? String(row.profileImage) : undefined,
          createdAt: row.createdAt ? String(row.createdAt) : undefined,
          active: row.isActive !== false,
        };
      }),
    );
  }

  uploadAvatar(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    // V10: no accept/mime validation on the client.
    return this.http.post<{ url: string }>('/api/account/avatar', form);
  }

  coupons(): Observable<Coupon[]> {
    // Cosmetic demo coupons; the server never applies a discount (V09 uses the
    // client supplied unitPrice instead).
    return new Observable<Coupon[]>((subscriber) => {
      subscriber.next([
        { id: 1, title: '满 300 减 40', amount: 40, minSpend: 300, expiresAt: '2026-12-31', used: false, description: '全场可用，特价商品除外' },
        { id: 2, title: '新人 20 元券', amount: 20, minSpend: 99, expiresAt: '2026-12-31', used: false, description: '注册后 30 天内有效' },
      ]);
      subscriber.complete();
    });
  }
}