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
        <div class="toast" [class]="'toast toast--' + toast.type">
          <app-icon [name]="toast.type === 'error' ? 'alert-circle' : toast.type === 'info' ? 'info' : 'check'" [size]="18" />
          <span>{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-host { position: fixed; top: 80px; right: 24px; z-index: 120; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
    .toast { display: flex; align-items: center; gap: 8px; min-width: 220px; max-width: 360px; padding: 12px 16px; border-radius: 8px; background: #0B2545; color: #fff; box-shadow: var(--sp-shadow-lg); font-size: 14px; animation: toast-in .18s ease-out; }
    .toast--error { background: #8E2A20; }
    .toast--info { background: #13314F; }
    .toast--success app-icon { color: #F2B95C; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    @media (max-width: 767px) { .toast-host { left: 16px; right: 16px; top: 72px; } .toast { max-width: none; } }
  `],
})
export class ToastHostComponent {
  readonly toastService = inject(ToastService);
}
