export interface CachedReview {
  id: number;
  productId: number;
  rating: number;
  body: string;
  createdAt: string;
  productTitle: string;
  productImage: string;
}

const REVIEWED_KEY = 'sp.reviewedProducts';
const MY_REVIEWS_KEY = 'sp.myReviews';

function keyFor(base: string, userId?: number): string {
  return userId ? base + ':' + userId : base;
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
    // storage can be unavailable; the page still works in-memory
  }
}

export function readReviewedProducts(userId?: number): number[] {
  const ids = readJson<unknown>(keyFor(REVIEWED_KEY, userId), []);
  return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : [];
}

export function readMyReviews(userId?: number): CachedReview[] {
  const list = readJson<unknown>(keyFor(MY_REVIEWS_KEY, userId), []);
  return Array.isArray(list) ? (list as CachedReview[]) : [];
}

export function markReviewed(productId: number, review?: CachedReview, userId?: number): void {
  const ids = readReviewedProducts(userId);
  if (!ids.includes(productId)) {
    writeJson(keyFor(REVIEWED_KEY, userId), [...ids, productId]);
  }
  if (review) {
    const rest = readMyReviews(userId).filter((item) => item.productId !== productId);
    writeJson(keyFor(MY_REVIEWS_KEY, userId), [review, ...rest].slice(0, 60));
  }
}
