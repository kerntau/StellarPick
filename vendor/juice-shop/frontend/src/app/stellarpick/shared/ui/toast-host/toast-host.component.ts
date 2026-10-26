import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/toast.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="toast-host" role="status" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast--' + toast.type" [attr.role]="toast.type === 'error' ? 'alert' : null" [attr.aria-live]="toast.type === 'error' ? 'assertive' : null">
          <app-icon [name]="toast.type === 'error' ? 'alert-circle' : toast.type === 'info' ? 'info' : 'check'" [size]="18" />
          <span>{{ toast.message }}</span>
          <button class="toast-close" type="button" (click)="toastService.dismiss(toast.id)" aria-label="关闭通知">
            <app-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-host { position: fixed; top: var(--sp-toast-top, calc(var(--sp-chrome-h) + 12px)); right: 24px; z-index: 300; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
    .toast { display: flex; align-items: center; gap: 8px; min-width: 220px; max-width: 360px; padding: 12px 16px; border-radius: 8px; background: #0B2545; color: #fff; box-shadow: var(--sp-shadow-lg); font-size: 14px; animation: toast-in .18s ease-out; }
    .toast--error { background: #8E2A20; }
    .toast--info { background: #13314F; }
    .toast--success app-icon { color: #F2B95C; }
    .toast-close { pointer-events: auto; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-left: 4px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: rgba(255, 255, 255, .72); cursor: pointer; }
    .toast-close:hover { background: rgba(255, 255, 255, .14); color: #fff; }
    .toast-close:focus-visible { outline: 2px solid #F2B95C; outline-offset: 1px; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    @media (max-width: 767px) { .toast-host { left: 16px; right: 16px; top: var(--sp-toast-top, calc(var(--sp-chrome-h) + 8px)); } .toast { max-width: none; } }
  `],
})
export class ToastHostComponent {
  readonly toastService = inject(ToastService);
}
