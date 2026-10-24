import { Injectable, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthApi } from '../api/auth.api';
import { CartService } from '../cart.service';
import { Session, User } from '../models';
import { ToastService } from '../toast.service';
import { AuthStore } from './auth.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly cart = inject(CartService);

  readonly user = this.store.user;
  readonly isLoggedIn = this.store.isLoggedIn;
  readonly role = this.store.role;

  login(username: string, password: string): Observable<Session> {
    return this.api.login(username, password).pipe(
      tap((session) => {
        this.store.setSession(session.token, session.user);
        this.cart.refresh().subscribe({ error: () => undefined });
      }),
    );
  }

  register(name: string, email: string, password: string): Observable<Session> {
    return this.api.register(name, email, password).pipe(
      tap((session) => this.store.setSession(session.token, session.user)),
    );
  }

  refreshMe(): void {
    if (!this.store.isLoggedIn()) {
      return;
    }
    this.api.me().subscribe({
      next: (user: User) => this.store.merge(user),
      error: () => undefined,
    });
  }

  logout(): void {
    this.store.clear();
    this.cart.clear();
    this.toast.show('已退出登录', 'info');
    this.router.navigate(['/']);
  }
}
