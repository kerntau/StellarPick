import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { ToastService } from '../toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const toast = inject(ToastService);
  const token = store.token();
  const authReq = token && req.url.startsWith('/api')
    ? req.clone({ setHeaders: { Authorization: 'Bearer ' + token } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // A failed login/registration is not an expired session: let the page
      // show its own error instead of clearing the store and redirecting.
      // Password/reset endpoints also answer 401 for a wrong current password
      // or security answer, which is a form error rather than session expiry.
      const isAuthCall =
        (req.method === 'POST' && req.url.includes('/rest/user/login')) ||
        (req.method === 'POST' && req.url.endsWith('/api/Users')) ||
        req.url.includes('/rest/user/change-password') ||
        req.url.includes('/rest/user/reset-password');
      if (err.status === 401 && !isAuthCall) {
        store.clear();
        toast.show('登录已过期，请重新登录', 'error');
        const current = router.url;
        if (!current.startsWith('/login')) {
          router.navigate(['/login'], { queryParams: { next: current } });
        }
      }
      return throwError(() => err);
    }),
  );
};
