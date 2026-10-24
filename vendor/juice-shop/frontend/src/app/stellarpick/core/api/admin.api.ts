import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AdminUser, Merchant } from '../models';

/**
 * Admin adapter for the lab backend (routes/stellarpick.ts).
 *
 * Contract notes (confirmed against the running server):
 * - GET /api/admin/users returns every account in one page; the q/role/status query
 *   parameters are not honoured consistently (q only matches lower-case usernames), so
 *   search + filters are applied on the client over the full list.
 * - GET /api/admin/merchants returns every application, optionally filtered by status.
 * - PATCH /api/admin/users/:id accepts { role, status }; POST .../reset-password returns
 *   { password }; merchants are handled through POST .../approve and .../reject { reason }.
 * - V06: only a login is required, there is no role check on the server or the client.
 */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  users(): Observable<AdminUser[]> {
    return this.http
      .get<{ items?: AdminUser[] }>('/api/admin/users')
      .pipe(map((res) => (res.items ?? []).map((user) => ({ ...user, status: user.status || 'active' }))));
  }

  updateUser(id: number, payload: { role?: string; status?: string }): Observable<AdminUser> {
    return this.http.patch<AdminUser>('/api/admin/users/' + id, payload);
  }

  resetPassword(id: number): Observable<{ password: string }> {
    return this.http.post<{ password: string }>('/api/admin/users/' + id + '/reset-password', {});
  }

  merchants(): Observable<Merchant[]> {
    return this.http
      .get<{ items?: Merchant[] }>('/api/admin/merchants')
      .pipe(map((res) => (res.items ?? []).map((row) => ({ ...row, status: row.status || 'pending' }))));
  }

  approveMerchant(id: number): Observable<Merchant> {
    return this.http.post<Merchant>('/api/admin/merchants/' + id + '/approve', {});
  }

  rejectMerchant(id: number, reason: string): Observable<Merchant> {
    return this.http.post<Merchant>('/api/admin/merchants/' + id + '/reject', { reason });
  }

  settings(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>('/api/admin/settings');
  }
}
