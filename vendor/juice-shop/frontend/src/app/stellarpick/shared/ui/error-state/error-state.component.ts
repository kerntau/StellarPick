import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="sp-alert sp-alert--error error" role="alert">
      <app-icon name="alert-circle" [size]="20" />
      <div class="sp-grow">
        <p class="msg">{{ message() }}</p>
        @if (requestId()) { <p class="rid">错误编号 {{ requestId() }}</p> }
      </div>
      <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="retry.emit()">
        <app-icon name="refresh" [size]="16" /> 重试
      </button>
    </div>
  `,
  styles: [`
    .error { align-items: center; }
    .msg { font-weight: 600; }
    .rid { font-size: 12px; opacity: .8; margin-top: 2px; }
  `],
})
export class ErrorStateComponent {
  readonly message = input('加载失败，请稍后重试');
  readonly requestId = input<string | undefined>(undefined);
  readonly retry = output<void>();
}
