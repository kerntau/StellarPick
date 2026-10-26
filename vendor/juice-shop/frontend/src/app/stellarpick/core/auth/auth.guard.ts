import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

/**
 * Only checks whether a token exists. No role checks anywhere: V06 requires
 * /admin/** to stay reachable for a plain member. Merchant-only routes use the
 * separate merchantGuard below, which is not part of V01–V10.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (store.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
};

/** Merchant console: merchant or admin only (V06 does not cover /merchant). */
export const merchantGuard: CanActivateFn = (_route, state) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (!store.isLoggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
  }
  if (store.isMerchant()) {
    return true;
  }
  return router.createUrlTree(['/']);
};
