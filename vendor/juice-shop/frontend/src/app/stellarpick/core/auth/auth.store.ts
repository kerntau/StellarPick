import { Injectable, computed, signal } from '@angular/core';
import { Role, User } from '../models';

/** Juice Shop keeps its JWT under the "token" key; V07 depends on it. */
export const TOKEN_KEY = 'token';

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) {
      return null;
    }
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeAvatarPath(value: unknown): string | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const raw = String(value);
  if (raw.startsWith('/assets/')) {
    return raw;
  }
  if (raw.startsWith('assets/')) {
    return '/' + raw;
  }
  return '/assets/public/images/uploads/' + raw;
}

function normalizeRole(value: unknown): Role {
  switch (String(value ?? '').toLowerCase()) {
    case 'admin':
      return 'admin';
    case 'merchant':
      return 'merchant';
    case 'support':
    case 'accounting':
      return 'support';
    case 'customer':
    case 'member':
    case 'deluxe':
      return 'member';
    default:
      return 'member';
  }
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _token = signal<string | null>(null);
  private readonly _user = signal<User | null>(null);

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._token() !== null);
  readonly role = computed<Role>(() => this._user()?.role ?? 'guest');
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isMerchant = computed(() => this.role() === 'merchant' || this.role() === 'admin');
  readonly displayName = computed(() => this._user()?.name ?? '会员');

  constructor() {
    this.restore();
  }

  restore(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return;
    }
    const payload = decodePayload(token);
    if (!payload) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    const exp = typeof payload['exp'] === 'number' ? (payload['exp'] as number) : 0;
    if (exp > 0 && exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    this._token.set(token);
    this._user.set(this.userFromPayload(payload));
  }

  setSession(token: string, user: User): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
    const payload = decodePayload(token);
    const merged = payload ? { ...user, ...this.userFromPayload(payload) } : user;
    this._user.set(merged);
  }

  merge(user: Partial<User>): void {
    const current = this._user();
    if (!current) {
      return;
    }
    // V07: role always comes from the token payload, never from /api/me.
    const { role: _ignored, ...rest } = user;
    this._user.set({ ...current, ...rest });
  }

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._token.set(null);
    this._user.set(null);
  }

  private userFromPayload(payload: Record<string, unknown>): User {
    // Juice Shop nests user data under "data"; tolerate flat tokens as well.
    const data = (payload['data'] ?? payload) as Record<string, unknown>;
    const email = String(data['email'] ?? '');
    const username = data['username'] == null ? undefined : String(data['username']);
    return {
      id: Number(data['id'] ?? 0),
      username,
      name: username || email.split('@')[0] || '会员',
      email,
      role: normalizeRole(data['role']),
      avatar: normalizeAvatarPath(data['profileImage']),
      level: normalizeRole(data['role']) === 'admin' ? '平台管理员' : '星澜会员',
    };
  }
}
