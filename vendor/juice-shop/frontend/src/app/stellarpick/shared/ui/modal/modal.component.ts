import { Component, DestroyRef, ElementRef, effect, inject, input, output, viewChild } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (open()) {
      <div class="overlay" (click)="onBackdrop($event)">
        <div class="panel" [class.panel--right]="variant() === 'right'" role="dialog" aria-modal="true"
             [attr.aria-label]="title()" tabindex="-1" #panel>
          <header class="head">
            <h2>{{ title() }}</h2>
            <button class="close" type="button" (click)="closed.emit()" aria-label="关闭">
              <app-icon name="x" [size]="18" />
            </button>
          </header>
          <div class="body"><ng-content /></div>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay { position: fixed; inset: 0; z-index: 100; background: rgba(7, 26, 51, .48); display: flex; align-items: center; justify-content: center; padding: 24px; }
    .panel { width: 560px; max-width: 100%; max-height: 90vh; overflow: auto; background: var(--sp-surface); border-radius: 12px; box-shadow: var(--sp-shadow-lg); }
    .panel--right { margin-left: auto; height: 100%; max-height: none; width: 400px; border-radius: 12px 0 0 12px; }
    .overlay:has(.panel--right) { justify-content: flex-end; padding: 0; }
    .head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--sp-border); position: sticky; top: 0; background: var(--sp-surface); z-index: 1; }
    .head h2 { font-size: 18px; }
    .close { width: 36px; height: 36px; border: 0; background: transparent; border-radius: 6px; color: var(--sp-text-secondary); display: inline-flex; align-items: center; justify-content: center; }
    .close:hover { background: var(--sp-bg); }
    .body { padding: 24px; }
    @media (max-width: 767px) {
      .panel { width: 100%; }
      .overlay { padding: 0; align-items: flex-end; }
      .panel { border-radius: 12px 12px 0 0; max-height: 92vh; }
      .panel--right { height: auto; max-height: 92vh; width: 100%; border-radius: 12px 12px 0 0; }
      .body { padding: 16px; }
      .head { padding: 16px; }
    }
  `],
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly variant = input<'center' | 'right'>('center');
  readonly closed = output<void>();
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) {
        return;
      }
      // Remember who opened the dialog so focus can go back there on close.
      const opener = document.activeElement as HTMLElement | null;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const focusTimer = setTimeout(() => {
        const panel = this.panel()?.nativeElement;
        if (!panel) {
          return;
        }
        const target = panel.querySelector<HTMLElement>(FOCUSABLE);
        (target ?? panel).focus();
      });

      // A capture-phase listener keeps Tab trapped even when focus slipped to
      // <body>, and consumes Escape before the header's shortcut sees it.
      const onKeydown = (event: KeyboardEvent): void => this.onKeydown(event);
      document.addEventListener('keydown', onKeydown, true);

      onCleanup(() => {
        clearTimeout(focusTimer);
        document.removeEventListener('keydown', onKeydown, true);
        document.body.style.overflow = previousOverflow;
        if (opener?.isConnected) {
          opener.focus();
        }
      });
    });
    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closed.emit();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const panel = this.panel()?.nativeElement;
    if (!panel) {
      return;
    }
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (node) => node.offsetParent !== null && !node.hasAttribute('disabled'),
    );
    if (nodes.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (!active || !panel.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}