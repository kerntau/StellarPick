import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-quantity-stepper',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="stepper">
      <button type="button" (click)="step(-1)" [disabled]="value() <= min()" aria-label="减少数量">
        <app-icon name="minus" [size]="14" />
      </button>
      <input class="sp-num" type="number" [value]="value()" [min]="min()" [max]="max()"
             [attr.aria-label]="'数量'" (change)="onInput($event)" />
      <button type="button" (click)="step(1)" [disabled]="value() >= max()" aria-label="增加数量">
        <app-icon name="plus" [size]="14" />
      </button>
    </div>
  `,
  styles: [`
    .stepper { display: inline-flex; align-items: center; border: 1px solid var(--sp-border-strong); border-radius: 6px; overflow: hidden; background: #fff; }
    button { width: 44px; height: 44px; border: 0; background: #fff; color: var(--sp-primary); display: inline-flex; align-items: center; justify-content: center; }
    button:hover:not(:disabled) { background: var(--sp-bg); }
    button:disabled { opacity: .35; cursor: not-allowed; }
    input { width: 48px; height: 44px; border: 0; border-left: 1px solid var(--sp-border); border-right: 1px solid var(--sp-border); text-align: center; font-size: 14px; -moz-appearance: textfield; }
    input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  `],
})
export class QuantityStepperComponent {
  readonly value = input(1);
  readonly min = input(1);
  readonly max = input(99);
  readonly valueChange = output<number>();

  step(delta: number): void {
    const next = Math.min(this.max(), Math.max(this.min(), this.value() + delta));
    if (next !== this.value()) {
      this.valueChange.emit(next);
    }
  }

  onInput(event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    const next = Math.min(this.max(), Math.max(this.min(), Number.isFinite(raw) ? raw : this.min()));
    (event.target as HTMLInputElement).value = String(next);
    this.valueChange.emit(next);
  }
}
