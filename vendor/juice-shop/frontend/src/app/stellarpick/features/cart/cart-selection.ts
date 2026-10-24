export const CART_SELECTION_KEY = 'sp.cart.selection';

export interface CartSelection {
  /** Cart line ids the shopper ticked on the cart page. */
  selected: number[];
  /** Cart line ids that existed when the selection was saved. */
  known: number[];
}

export function readCartSelection(): CartSelection | null {
  try {
    const raw = sessionStorage.getItem(CART_SELECTION_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const ids = parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value));
      return { selected: ids, known: ids };
    }
    if (parsed && typeof parsed === 'object') {
      const row = parsed as { selected?: unknown; known?: unknown };
      const selected = Array.isArray(row.selected)
        ? row.selected.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [];
      const known = Array.isArray(row.known)
        ? row.known.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : selected;
      return { selected, known };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCartSelection(selected: number[], known: number[]): void {
  try {
    sessionStorage.setItem(CART_SELECTION_KEY, JSON.stringify({ selected, known }));
  } catch {
    // storage may be unavailable; the selection still works for this page
  }
}

export function clearCartSelection(): void {
  try {
    sessionStorage.removeItem(CART_SELECTION_KEY);
  } catch {
    // ignore storage errors
  }
}
