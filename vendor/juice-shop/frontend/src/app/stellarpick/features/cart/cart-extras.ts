import type { User } from '../../core/models';

/** Member free-shipping threshold used by the cart progress meter. */
export const FREE_SHIPPING_THRESHOLD = 99;

const EXTRAS_KEY = 'sp.checkout.extras';
const FAVORITES_PREFIX = 'sp.favorites.';
const VIEWED_PREFIX = 'sp.viewed.';
const VIEWED_LIMIT = 8;

export interface CheckoutExtras {
  /** Gift note shown with the parcel and echoed on the checkout summary. */
  gift: string;
  /** Whether the shopper wants an electronic invoice. */
  invoice: boolean;
}

export interface ViewedItem {
  productId: number;
  title: string;
  image: string;
  at: number;
}

export const EMPTY_EXTRAS: CheckoutExtras = { gift: '', invoice: false };

/** Same per-account key shape the product page uses for its favourite toggle. */
export function storageUserKey(user: User | null): string {
  return String(user?.email || user?.id || 'guest');
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage can be unavailable; the in-memory state still works for this page
  }
}

export function readCheckoutExtras(): CheckoutExtras {
  const value = readJson<Partial<CheckoutExtras>>(EXTRAS_KEY, {});
  return {
    gift: typeof value.gift === 'string' ? value.gift.slice(0, 50) : '',
    invoice: value.invoice === true,
  };
}

export function writeCheckoutExtras(extras: CheckoutExtras): void {
  writeJson(EXTRAS_KEY, {
    gift: String(extras.gift ?? '').slice(0, 50),
    invoice: extras.invoice === true,
  });
}

export function readFavorites(user: User | null): number[] {
  const key = FAVORITES_PREFIX + storageUserKey(user);
  const value = readJson<unknown>(key, []);
  return Array.isArray(value)
    ? value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
    : [];
}

export function isFavorite(user: User | null, productId: number): boolean {
  return readFavorites(user).includes(Number(productId));
}

/** Toggles a product and returns the new favourite state. */
export function toggleFavorite(user: User | null, productId: number): boolean {
  const id = Number(productId);
  const ids = readFavorites(user);
  const has = ids.includes(id);
  const next = has ? ids.filter((value) => value !== id) : [...ids, id];
  writeJson(FAVORITES_PREFIX + storageUserKey(user), next);
  return !has;
}

/** Adds every supplied product to the favourites list; returns how many were new. */
export function addFavorites(user: User | null, productIds: number[]): number {
  const ids = readFavorites(user);
  const next = [...ids];
  let added = 0;
  for (const value of productIds) {
    const id = Number(value);
    if (Number.isFinite(id) && !next.includes(id)) {
      next.push(id);
      added += 1;
    }
  }
  if (added > 0) {
    writeJson(FAVORITES_PREFIX + storageUserKey(user), next);
  }
  return added;
}

/** Remembers recently inspected cart products for the account activity module. */
export function recordViewed(
  user: User | null,
  items: { productId: number; title: string; image: string }[],
): void {
  if (items.length === 0) {
    return;
  }
  const key = VIEWED_PREFIX + storageUserKey(user);
  const existing = readViewed(user);
  const byId = new Map<number, ViewedItem>();
  for (const item of items) {
    const productId = Number(item.productId);
    if (Number.isFinite(productId) && productId > 0) {
      byId.set(productId, {
        productId,
        title: String(item.title ?? ''),
        image: String(item.image ?? ''),
        at: Date.now(),
      });
    }
  }
  for (const item of existing) {
    if (!byId.has(item.productId)) {
      byId.set(item.productId, item);
    }
  }
  writeJson(key, [...byId.values()].slice(0, VIEWED_LIMIT));
}

export function readViewed(user: User | null): ViewedItem[] {
  const value = readJson<unknown>(VIEWED_PREFIX + storageUserKey(user), []);
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((raw) => {
      const row = (raw ?? {}) as Record<string, unknown>;
      return {
        productId: Number(row['productId'] ?? 0),
        title: String(row['title'] ?? ''),
        image: String(row['image'] ?? ''),
        at: Number(row['at'] ?? 0),
      } as ViewedItem;
    })
    .filter((item) => item.productId > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, VIEWED_LIMIT);
}

/** 0–100 progress toward the free-shipping threshold. */
export function shippingProgress(subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100)));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function monthDay(date: Date): string {
  return date.getMonth() + 1 + '月' + date.getDate() + '日';
}

/** Human delivery estimate such as "10月24日–10月26日". */
export function deliveryWindow(fromDays = 2, toDays = 4, base = new Date()): string {
  return monthDay(addDays(base, fromDays)) + '–' + monthDay(addDays(base, toDays));
}

/** Single-day estimate used by next-day delivery copy. */
export function deliveryDay(days = 1, base = new Date()): string {
  return monthDay(addDays(base, days));
}
