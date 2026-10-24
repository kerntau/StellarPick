import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="open()" [title]="title()" (closed)="closed.emit()">
      <p class="msg">{{ message() }}</p>
      @if (error()) {
        <div class="sp-alert sp-alert--error" role="alert">{{ error() }}</div>
      }
      <div class="actions">
        <button class="sp-btn sp-btn--secondary" type="button" (click)="closed.emit()">{{ cancelLabel() }}</button>
        <button
          class="sp-btn"
          [class.sp-btn--danger]="danger()"
          [class.sp-btn--primary]="!danger()"
          type="button"
          [disabled]="busy()"
          (click)="confirmed.emit()"
        >
          {{ busy() ? '处理中…' : confirmLabel() }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .msg { color: var(--sp-text-secondary); line-height: 1.7; }
      .sp-alert { margin-top: 16px; }
      .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
      @media (max-width: 480px) {
        .actions { flex-direction: column-reverse; }
        .actions .sp-btn { width: 100%; }
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input('请确认');
  readonly message = input('');
  readonly confirmLabel = input('确认');
  readonly cancelLabel = input('取消');
  readonly danger = input(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly confirmed = output<void>();
  readonly closed = output<void>();
}
