import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { Session, User } from '../models';

interface LoginResponse {
  authentication: { token: string; umail?: string; bid?: number };
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  login(identifier: string, password: string): Observable<Session> {
    // V02: credentials are submitted verbatim; the field is still called email.
    return this.http.post<LoginResponse>('/rest/user/login', { email: identifier, password }).pipe(
      map((res) => ({
        token: res.authentication.token,
        user: {
          id: 0,
          name: identifier.split('@')[0],
          email: res.authentication.umail ?? identifier,
          role: 'member',
        } as User,
      })),
    );
  }

  register(name: string, email: string, password: string): Observable<Session> {
    return this.http
      .post('/api/Users', {
        email,
        password,
        passwordRepeat: password,
        // 后端把展示名存在 username 字段；不传的话注册后的昵称会退化成邮箱前缀。
        username: name,
        securityQuestion: { id: 1 },
        securityAnswer: 'demo',
      })
      .pipe(switchMap(() => this.login(email, password)));
  }

  me(): Observable<User> {
    return this.http.get<{ user: Record<string, unknown> }>('/rest/user/whoami').pipe(
      map((res) => {
        const user = res.user ?? {};
        return {
          id: Number(user['id'] ?? 0),
          name: String(user['username'] ?? user['email'] ?? '会员'),
          email: String(user['email'] ?? ''),
          role: 'member',
        } as User;
      }),
    );
  }
}
