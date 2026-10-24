export const DEFAULT_AVATAR = '/assets/sp/img/avatar-default.svg';

const UPLOAD_PREFIX = '/assets/public/images/uploads/';

/**
 * The JWT stores profileImage as "assets/public/images/uploads/default.svg",
 * while the shared AuthStore prefixes that path once more. Normalise both the
 * token shape and the already-absolute shape into one usable URL.
 */
export function normalizeAvatar(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return DEFAULT_AVATAR;
  }
  if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('http')) {
    return raw;
  }
  if (raw.startsWith('/uploads/')) {
    return raw;
  }
  const marker = 'assets/public/images/uploads/';
  const index = raw.lastIndexOf(marker);
  if (index >= 0) {
    const file = raw.slice(index + marker.length);
    return file ? UPLOAD_PREFIX + file : DEFAULT_AVATAR;
  }
  if (raw.startsWith('/')) {
    return raw;
  }
  return UPLOAD_PREFIX + raw;
}
