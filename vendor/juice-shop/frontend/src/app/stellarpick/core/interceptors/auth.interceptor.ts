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
      const isAuthCall = req.url.includes('/api/login') || req.url.includes('/api/register');
      if (err.status === 401 && !isAuthCall) {
        store.clear();
        toast.show('登录已过期，请重新登录', 'error');
        const next = router.url;
        if (!next.startsWith('/login')) {
          router.navigate(['/login'], { queryParams: { next } });
        }
      }
      return throwError(() => err);
    }),
  );
};
