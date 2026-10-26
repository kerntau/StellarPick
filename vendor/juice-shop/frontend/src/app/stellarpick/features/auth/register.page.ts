import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { AuthBrandPanelComponent } from './components/auth-brand-panel.component';

interface RegisterErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  agree?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [RouterLink, IconComponent, AuthBrandPanelComponent],
  template: `
    <div class="auth-page">
      <div class="sp-container">
        <div class="auth-shell auth-shell--register">
          <section class="auth-panel" aria-labelledby="register-title">
            <div class="auth-head">
              <p class="sp-eyebrow">创建账号</p>
              <h1 id="register-title">加入星澜优选</h1>
              <p class="sp-secondary">注册即可享受会员价、满 99 元包邮与专属客服。</p>
            </div>

            @if (serverError()) {
              <div class="sp-alert sp-alert--error auth-alert" role="alert" tabindex="-1">
                <app-icon name="alert-circle" [size]="18" />
                <span>{{ serverError() }}</span>
              </div>
            }

            <form class="auth-form" (submit)="$event.preventDefault(); submit()" novalidate>
              <div class="sp-field">
                <label class="sp-label" for="reg-name">昵称<span class="sp-req">*</span></label>
                <input
                  id="reg-name"
                  class="sp-input"
                  type="text"
                  name="name"
                  autocomplete="nickname"
                  maxlength="24"
                  placeholder="评价与工单中展示的名字"
                  [value]="name()"
                  (input)="onName($event)"
                  [attr.aria-invalid]="fieldErrors().name ? 'true' : null"
                  [attr.aria-describedby]="fieldErrors().name ? 'reg-name-error' : 'reg-name-hint'"
                  aria-required="true"
                />
                @if (fieldErrors().name) {
                  <p class="sp-error" id="reg-name-error">{{ fieldErrors().name }}</p>
                } @else {
                  <p class="sp-hint" id="reg-name-hint">2–24 个字符，注册后可在个人中心修改。</p>
                }
              </div>

              <div class="sp-field">
                <label class="sp-label" for="reg-email">邮箱<span class="sp-req">*</span></label>
                <input
                  id="reg-email"
                  class="sp-input"
                  type="email"
                  name="email"
                  autocomplete="email"
                  placeholder="name@example.com"
                  [value]="email()"
                  (input)="onEmail($event)"
                  [attr.aria-invalid]="fieldErrors().email ? 'true' : null"
                  [attr.aria-describedby]="fieldErrors().email ? 'reg-email-error' : 'reg-email-hint'"
                  aria-required="true"
                />
                @if (fieldErrors().email) {
                  <p class="sp-error" id="reg-email-error">{{ fieldErrors().email }}</p>
                } @else {
                  <p class="sp-hint" id="reg-email-hint">用于登录与订单通知，演示环境不会真实发送邮件。</p>
                }
              </div>

              <div class="sp-field">
                <label class="sp-label" for="reg-password">密码<span class="sp-req">*</span></label>
                <div class="pw-wrap">
                  <input
                    id="reg-password"
                    class="sp-input"
                    [type]="showPassword() ? 'text' : 'password'"
                    name="password"
                    autocomplete="new-password"
                    placeholder="至少 8 位字符"
                    [value]="password()"
                    (input)="onPassword($event)"
                    [attr.aria-invalid]="fieldErrors().password ? 'true' : null"
                    [attr.aria-describedby]="fieldErrors().password ? 'reg-password-error' : 'reg-password-hint'"
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
                  <p class="sp-error" id="reg-password-error">{{ fieldErrors().password }}</p>
                } @else {
                  <span class="sp-sr-only" id="reg-password-hint">密码至少 8 位，建议包含字母、数字与符号</span>
                }
                @if (password()) {
                  <ul class="pw-rules" aria-label="密码强度提示">
                    @for (rule of rules(); track rule.label) {
                      <li [class.ok]="rule.ok">
                        <app-icon [name]="rule.ok ? 'check' : 'x'" [size]="12" />{{ rule.label }}
                      </li>
                    }
                  </ul>
                }
              </div>

              <div class="sp-field">
                <label class="sp-label" for="reg-confirm">确认密码<span class="sp-req">*</span></label>
                <div class="pw-wrap">
                  <input
                    id="reg-confirm"
                    class="sp-input"
                    [type]="showConfirm() ? 'text' : 'password'"
                    name="confirm"
                    autocomplete="new-password"
                    placeholder="再次输入密码"
                    [value]="confirm()"
                    (input)="onConfirm($event)"
                    [attr.aria-invalid]="fieldErrors().confirm ? 'true' : null"
                    [attr.aria-describedby]="fieldErrors().confirm ? 'reg-confirm-error' : null"
                    aria-required="true"
                  />
                  <button
                    class="pw-toggle"
                    type="button"
                    (click)="showConfirm.set(!showConfirm())"
                    [attr.aria-label]="showConfirm() ? '隐藏确认密码' : '显示确认密码'"
                    [attr.aria-pressed]="showConfirm()"
                  >
                    {{ showConfirm() ? '隐藏' : '显示' }}
                  </button>
                </div>
                @if (fieldErrors().confirm) {
                  <p class="sp-error" id="reg-confirm-error">{{ fieldErrors().confirm }}</p>
                } @else if (confirm() && confirm() === password()) {
                  <p class="sp-hint match"><app-icon name="check" [size]="12" />两次输入一致</p>
                }
              </div>

              <div class="agree-row">
                <input
                  id="reg-agree"
                  type="checkbox"
                  [checked]="agree()"
                  (change)="onAgree($event)"
                  [attr.aria-invalid]="fieldErrors().agree ? 'true' : null"
                  [attr.aria-describedby]="fieldErrors().agree ? 'reg-agree-error' : null"
                  aria-required="true"
                />
                <label for="reg-agree" class="agree-label">
                  我已阅读并同意
                  <a routerLink="/terms" (click)="$event.stopPropagation()">《服务条款》</a>
                  <span class="agree-tail">与 <a routerLink="/privacy" (click)="$event.stopPropagation()">《隐私政策》</a></span>
                </label>
              </div>
              @if (fieldErrors().agree) {
                <p class="sp-error agree-error" id="reg-agree-error">{{ fieldErrors().agree }}</p>
              }

              <button
                id="register-submit"
                class="sp-btn sp-btn--primary sp-btn--lg sp-btn--block submit-btn"
                type="submit"
                [disabled]="loading()"
                [attr.aria-busy]="loading()"
              >
                @if (loading()) {
                  <span class="spinner" aria-hidden="true"></span> 注册中…
                } @else {
                  注册
                }
              </button>
            </form>

            <p class="switch sp-text-13 sp-secondary">
              已有账号？
              <a class="sp-link" routerLink="/login" [queryParams]="loginQuery">去登录</a>
            </p>
          </section>

          <app-auth-brand-panel />
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
    .auth-shell--register { grid-template-columns: minmax(0, 1fr) minmax(0, 1.02fr); }
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
    .pw-rules { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 2px; }
    .pw-rules li {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; color: var(--sp-text-muted);
    }
    .pw-rules li.ok { color: var(--sp-success); }
    .match { display: inline-flex; align-items: center; gap: 4px; color: var(--sp-success); }
    .agree-row { display: flex; align-items: flex-start; gap: 8px; margin: 4px 0; }
    .agree-row input { width: 16px; height: 16px; margin-top: 3px; accent-color: var(--sp-primary); flex: 0 0 auto; }
    .agree-label { font-size: 13px; line-height: 1.6; color: var(--sp-text-secondary); }
    .agree-label a { color: var(--sp-info); font-weight: 600; white-space: nowrap; }
    .agree-tail { white-space: nowrap; }
    .agree-label a:hover { text-decoration: underline; }
    .agree-error { margin-top: 2px; }
    .submit-btn { margin-top: 16px; }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, .35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: register-spin .8s linear infinite;
    }
    @keyframes register-spin { to { transform: rotate(360deg); } }
    .switch { margin-top: 20px; }
    .switch a { margin-left: 4px; display: inline-flex; align-items: center; min-height: 44px; }

    @media (max-width: 900px) {
      .auth-shell, .auth-shell--register { grid-template-columns: 1fr; }
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
export class RegisterPage implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly showPassword = signal(false);
  readonly showConfirm = signal(false);
  readonly agree = signal(false);
  readonly loading = signal(false);
  readonly fieldErrors = signal<RegisterErrors>({});
  readonly serverError = signal('');

  readonly rules = computed(() => {
    const value = this.password();
    return [
      { label: '至少 8 位字符', ok: value.length >= 8 },
      { label: '包含字母与数字', ok: /[A-Za-z]/.test(value) && /\d/.test(value) },
      { label: '包含一个符号（如 @ ! #）', ok: /[^A-Za-z0-9]/.test(value) },
    ];
  });

  private readonly nextTarget = this.route.snapshot.queryParamMap.get('next') ?? '';
  readonly loginQuery: Record<string, string> = this.isSafePath(this.nextTarget)
    ? { next: this.nextTarget }
    : {};

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
      setTimeout(() => this.focusField('reg-name'));
    }
  }

  onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
    this.clearError('name');
  }

  onEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.clearError('email');
  }

  onPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.clearError('password');
  }

  onConfirm(event: Event): void {
    this.confirm.set((event.target as HTMLInputElement).value);
    this.clearError('confirm');
  }

  onAgree(event: Event): void {
    this.agree.set((event.target as HTMLInputElement).checked);
    this.clearError('agree');
  }

  submit(): void {
    if (this.loading()) {
      return;
    }
    const errors: RegisterErrors = {};
    const name = this.name().trim();
    const email = this.email().trim();
    if (!name) {
      errors.name = '请填写昵称';
    } else if (name.length < 2) {
      errors.name = '昵称至少 2 个字符';
    }
    if (!email) {
      errors.email = '请填写邮箱';
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = '邮箱格式不正确，例如 name@example.com';
    }
    if (!this.password()) {
      errors.password = '请填写密码';
    } else if (this.password().length < 8) {
      errors.password = '密码至少 8 位';
    }
    if (!this.confirm()) {
      errors.confirm = '请再次输入密码';
    } else if (this.confirm() !== this.password()) {
      errors.confirm = '两次输入的密码不一致';
    }
    if (!this.agree()) {
      errors.agree = '请阅读并同意服务条款与隐私政策';
    }

    this.fieldErrors.set(errors);
    this.serverError.set('');
    if (Object.keys(errors).length > 0) {
      this.focusFirstError(errors);
      return;
    }

    this.loading.set(true);
    this.auth.register(name, email, this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.show('注册成功，欢迎加入星澜优选', 'success');
        this.router.navigateByUrl(this.safeNext());
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.handleError(err);
        this.cdr.detectChanges();
      },
    });
  }

  private handleError(err: unknown): void {
    const body = (err as { error?: unknown } | null)?.error;

    if (body && typeof body === 'object') {
      const fields = (body as {
        errors?: { field?: string; path?: string; message?: string; type?: string }[];
      }).errors ?? [];
      const emailIssue = fields.find((entry) => entry.field === 'email' || entry.path === 'email');
      if (emailIssue) {
        const type = String(emailIssue.type ?? '');
        const text = String(emailIssue.message ?? '');
        const unique = /unique/i.test(type) || /unique|已存在|already/i.test(text);
        const message = unique
          ? '该邮箱已注册，请直接登录或换一个邮箱'
          : /validation error/i.test(text) || !text
            ? '邮箱格式不正确，例如 name@example.com'
            : text;
        this.fieldErrors.set({ email: message });
        this.focusField('reg-email');
        return;
      }
      const message = (body as { message?: string }).message;
      if (message && message !== 'Validation error') {
        this.serverError.set(message);
        this.focusAlert();
        return;
      }
    }

    this.serverError.set(this.message(err));
    this.focusAlert();
  }

  private isSafePath(value: string): boolean {
    return value.startsWith('/') && !value.startsWith('//');
  }

  private safeNext(): string {
    return this.isSafePath(this.nextTarget) ? this.nextTarget : '/account';
  }

  private clearError(field: keyof RegisterErrors): void {
    this.serverError.set('');
    if (this.fieldErrors()[field]) {
      this.fieldErrors.update((errors) => ({ ...errors, [field]: undefined }));
    }
  }

  private focusFirstError(errors: RegisterErrors): void {
    const ids: Record<keyof RegisterErrors, string> = {
      name: 'reg-name',
      email: 'reg-email',
      password: 'reg-password',
      confirm: 'reg-confirm',
      agree: 'reg-agree',
    };
    const order: (keyof RegisterErrors)[] = ['name', 'email', 'password', 'confirm', 'agree'];
    const field = order.find((key) => errors[key]);
    if (!field) {
      return;
    }
    this.focusField(ids[field]);
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
    if (status === 400) {
      return '注册信息未通过校验，请检查邮箱与密码后重试';
    }
    return errorMessage(err);
  }
}
