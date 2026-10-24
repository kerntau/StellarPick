import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { AuthBrandPanelComponent } from './components/auth-brand-panel.component';
import { DemoAccountsComponent } from './components/demo-accounts.component';
import type { DemoAccount } from './components/demo-accounts.component';

interface LoginErrors {
  username?: string;
  password?: string;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [RouterLink, IconComponent, AuthBrandPanelComponent, DemoAccountsComponent],
  template: `
    <div class="auth-page">
      <div class="sp-container">
        <div class="auth-shell">
          <app-auth-brand-panel />

          <section class="auth-panel" aria-labelledby="login-title">
            <div class="auth-head">
              <p class="sp-eyebrow">会员登录</p>
              <h1 id="login-title">欢迎回来</h1>
              <p class="sp-secondary">登录后可同步购物车、查看订单与会员权益。</p>
            </div>

            @if (serverError()) {
              <div class="sp-alert sp-alert--error auth-alert" role="alert" tabindex="-1">
                <app-icon name="alert-circle" [size]="18" />
                <span>{{ serverError() }}</span>
              </div>
            }

            <form class="auth-form" (submit)="$event.preventDefault(); submit()" novalidate>
              <div class="sp-field">
                <label class="sp-label" for="login-username">账号<span class="sp-req">*</span></label>
                <input
                  id="login-username"
                  class="sp-input"
                  type="text"
                  name="username"
                  autocomplete="username"
                  inputmode="email"
                  placeholder="邮箱或会员账号"
                  [value]="username()"
                  (input)="onUsername($event)"
                  [attr.aria-invalid]="fieldErrors().username ? 'true' : null"
                  [attr.aria-describedby]="fieldErrors().username ? 'login-username-error' : null"
                  aria-required="true"
                />
                @if (fieldErrors().username) {
                  <p class="sp-error" id="login-username-error">{{ fieldErrors().username }}</p>
                }
              </div>

              <div class="sp-field">
                <label class="sp-label" for="login-password">密码<span class="sp-req">*</span></label>
                <div class="pw-wrap">
                  <input
                    id="login-password"
                    class="sp-input"
                    [type]="showPassword() ? 'text' : 'password'"
                    name="password"
                    autocomplete="current-password"
                    placeholder="请输入登录密码"
                    [value]="password()"
                    (input)="onPassword($event)"
                    (keydown)="onPasswordKey($event)"
                    (keyup)="onPasswordKey($event)"
                    [attr.aria-invalid]="fieldErrors().password ? 'true' : null"
                    [attr.aria-describedby]="fieldErrors().password ? 'login-password-error' : (capsLock() ? 'login-caps' : null)"
                    aria-required="true"
                  />
                  <button
                    class="pw-toggle"
                    type="button"
                    (click)="showPassword.set(!showPassword())"
                    [attr.aria-label]="showPassword() ? '隐藏密码' : '显示密码'"
                    [attr.aria-pressed]="showPassword()"
                  >
                    {{ showPassword() ? '隐藏' : '显示' }}
                  </button>
                </div>
                @if (fieldErrors().password) {
                  <p class="sp-error" id="login-password-error">{{ fieldErrors().password }}</p>
                }
                @if (capsLock()) {
                  <p class="sp-hint caps" id="login-caps" aria-live="polite">
                    <app-icon name="alert-circle" [size]="12" />大写锁定已开启
                  </p>
                }
              </div>

              <div class="field-row">
                <button class="link-btn" type="button" (click)="forgotPassword()">忘记密码？</button>
              </div>

              <button
                id="login-submit"
                class="sp-btn sp-btn--primary sp-btn--lg sp-btn--block submit-btn"
                type="submit"
                [disabled]="loading()"
                [attr.aria-busy]="loading()"
              >
                @if (loading()) {
                  <span class="spinner" aria-hidden="true"></span> 登录中…
                } @else {
                  登录
                }
              </button>

              <p class="terms-note">
                登录即表示你同意
                <a class="sp-link" href="/#/terms">《服务条款》</a>与
                <a class="sp-link" href="/#/privacy">《隐私政策》</a>。
              </p>
            </form>

            <p class="switch sp-text-13 sp-secondary">
              还没有账号？
              <a class="sp-link" routerLink="/register" [queryParams]="registerQuery">立即注册</a>
            </p>

            <app-demo-accounts (fill)="fillDemo($event)" />
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { padding: 40px 0 64px; }
    .auth-shell {
      display: grid;
      grid-template-columns: minmax(0, 1.02fr) minmax(0, 1fr);
      background: var(--sp-surface);
      border: 1px solid var(--sp-border);
      border-radius: var(--sp-radius-lg);
      box-shadow: var(--sp-shadow-md);
      overflow: hidden;
    }
    .auth-panel { padding: 40px; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
    .auth-head h1 { font-size: var(--sp-text-32); margin: 4px 0 6px; }
    .auth-head p { line-height: 1.55; }
    .auth-form { margin-top: 24px; }
    .auth-panel .sp-input { min-height: 44px; }
    .auth-alert { margin-top: 16px; align-items: center; }
    .pw-wrap { position: relative; }
    .pw-wrap .sp-input { padding-right: 64px; }
    .pw-toggle {
      position: absolute;
      right: 4px;
      top: 50%;
      transform: translateY(-50%);
      min-width: 52px;
      height: 44px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--sp-info);
      font-size: 12px;
      font-weight: 600;
    }
    .pw-toggle:hover { background: var(--sp-bg); }
    .caps { display: inline-flex; align-items: center; gap: 4px; color: var(--sp-warning); }
    .field-row { display: flex; justify-content: flex-end; margin: -4px 0 4px; }
    .link-btn {
      border: 0;
      background: transparent;
      color: var(--sp-info);
      font-size: 13px;
      font-weight: 600;
      padding: 0 2px;
      min-height: 44px;
    }
    .link-btn:hover { text-decoration: underline; }
    .submit-btn { margin-top: 4px; }
    .terms-note { margin-top: 12px; font-size: 12px; line-height: 1.6; color: var(--sp-text-muted); }
    .terms-note a { font-weight: 600; }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, .35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: login-spin .8s linear infinite;
    }
    @keyframes login-spin { to { transform: rotate(360deg); } }
    .switch { margin-top: 20px; }
    .switch a { margin-left: 4px; display: inline-flex; align-items: center; min-height: 44px; }

    /* 窄屏：表单优先，品牌区收在下方，避免首屏被营销块占满。 */
    @media (max-width: 900px) {
      .auth-shell { grid-template-columns: 1fr; }
      .auth-panel { order: 1; padding: 28px 24px 32px; }
      app-auth-brand-panel { order: 2; }
    }
    @media (max-width: 600px) {
      .auth-page { padding: 16px 0 32px; }
      .auth-panel { padding: 24px 20px 28px; }
      .auth-head h1 { font-size: 26px; }
      .auth-panel .sp-input { font-size: 16px; }
    }
  `],
})
export class LoginPage implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly username = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly capsLock = signal(false);
  readonly loading = signal(false);
  readonly fieldErrors = signal<LoginErrors>({});
  readonly serverError = signal('');

  private readonly nextTarget = this.route.snapshot.queryParamMap.get('next') ?? '';
  readonly registerQuery: Record<string, string> = this.isSafePath(this.nextTarget)
    ? { next: this.nextTarget }
    : {};

  constructor() {
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(this.safeNext(), { replaceUrl: true });
    }
  }

  ngAfterViewInit(): void {
    // 桌面端聚焦账号输入框；触屏设备不自动聚焦，避免弹出软键盘遮挡首屏。
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
      setTimeout(() => this.focusField('login-username'));
    }
  }

  onUsername(event: Event): void {
    this.username.set((event.target as HTMLInputElement).value);
    this.serverError.set('');
    if (this.fieldErrors().username) {
      this.fieldErrors.update((errors) => ({ ...errors, username: undefined }));
    }
  }

  onPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.serverError.set('');
    if (this.fieldErrors().password) {
      this.fieldErrors.update((errors) => ({ ...errors, password: undefined }));
    }
  }

  onPasswordKey(event: KeyboardEvent): void {
    this.capsLock.set(event.getModifierState?.('CapsLock') ?? false);
  }

  fillDemo(account: DemoAccount): void {
    this.username.set(account.username);
    this.password.set(account.password);
    this.fieldErrors.set({});
    this.serverError.set('');
    this.capsLock.set(false);
    setTimeout(() => document.getElementById('login-submit')?.focus());
  }

  forgotPassword(): void {
    this.toast.show('演示环境暂不支持自助找回，请联系客服', 'info');
  }

  submit(): void {
    if (this.loading()) {
      return;
    }
    const errors: LoginErrors = {};
    if (!this.username()) {
      errors.username = '请输入账号';
    }
    if (!this.password()) {
      errors.password = '请输入密码';
    }
    this.fieldErrors.set(errors);
    this.serverError.set('');

    if (errors.username || errors.password) {
      this.focusField(errors.username ? 'login-username' : 'login-password');
      return;
    }

    this.loading.set(true);
    // V02: credentials are submitted verbatim. No trimming, filtering or
    // client-side injection checks; the server message is shown as-is.
    this.auth.login(this.username(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.show('登录成功', 'success');
        this.router.navigateByUrl(this.safeNext());
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const status = (err as { status?: number } | null)?.status;
        this.serverError.set(this.message(err));
        if (status === 401) {
          // 凭证错误时清空密码，保留账号方便重试。
          this.password.set('');
        }
        this.cdr.detectChanges();
        this.focusAlert();
      },
    });
  }

  private isSafePath(value: string): boolean {
    return value.startsWith('/') && !value.startsWith('//');
  }

  private safeNext(): string {
    return this.isSafePath(this.nextTarget) ? this.nextTarget : '/';
  }

  private focusField(id: string): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('#' + id)?.focus());
  }

  private focusAlert(): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.auth-alert')?.focus());
  }

  private message(err: unknown): string {
    const status = (err as { status?: number } | null)?.status;
    if (status === 0) {
      return '网络连接失败，请确认服务已启动后重试';
    }
    if (status === 401) {
      return '账号或密码不正确，请重新输入';
    }
    if (status === 403) {
      return '该账号已被限制登录，请联系客服';
    }
    if (status === 429) {
      return '尝试次数过多，请稍后再试';
    }
    return errorMessage(err);
  }
}
