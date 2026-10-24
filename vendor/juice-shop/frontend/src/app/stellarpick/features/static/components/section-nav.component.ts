import { Component, DestroyRef, afterNextRender, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

export interface SectionNavItem {
  id: string;
  label: string;
}

/**
 * Sticky in-page anchor navigation with scroll-spy.
 * Used by /about, /privacy and /terms. On narrow screens it collapses into a
 * horizontally scrollable chip strip so the table of contents stays usable.
 */
@Component({
  selector: 'app-section-nav',
  standalone: true,
  template: `
    <nav class="section-nav" [attr.aria-label]="ariaLabel()">
      @if (title()) {
        <p class="nav-title">{{ title() }}</p>
      }
      <ul>
        @for (item of items(); track item.id) {
          <li>
            <a [href]="'#' + item.id" [class.is-active]="active() === item.id"
               [attr.aria-current]="active() === item.id ? 'location' : null"
               (click)="jump($event, item.id)">{{ item.label }}</a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: [`
    :host { display: block; }
    .nav-title { margin-bottom: 12px; font-size: 12px; font-weight: 700; letter-spacing: .12em; color: var(--sp-text-muted); }
    ul { display: flex; flex-direction: column; gap: 2px; border-left: 1px solid var(--sp-border); }
    a {
      display: block; margin-left: -1px; padding: 8px 0 8px 16px;
      border-left: 2px solid transparent; font-size: 13px; line-height: 1.5;
      color: var(--sp-text-secondary); transition: color .15s ease, border-color .15s ease;
    }
    a:hover { color: var(--sp-primary); }
    a.is-active { color: var(--sp-primary); font-weight: 700; border-left-color: var(--sp-accent); }
    @media (max-width: 1023px) {
      .nav-title { margin-bottom: 8px; }
      ul {
        flex-direction: row; gap: 6px; border-left: 0; border-bottom: 1px solid var(--sp-border);
        overflow-x: auto; padding-bottom: 8px; scrollbar-width: none;
      }
      ul::-webkit-scrollbar { display: none; }
      a {
        margin-left: 0; min-height: 40px; padding: 8px 12px; white-space: nowrap;
        border-left: 0; border-bottom: 2px solid transparent;
        background: var(--sp-surface); border-radius: var(--sp-radius-sm) var(--sp-radius-sm) 0 0;
      }
      a.is-active { border-bottom-color: var(--sp-accent); background: var(--sp-bg); }
    }
  `],
})
export class SectionNavComponent {
  readonly items = input<SectionNavItem[]>([]);
  readonly title = input('');
  readonly ariaLabel = input('本页导航');
  readonly active = signal('');
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    afterNextRender(() => {
      const update = () => this.updateActive();
      update();
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
      });
    });
  }

  jump(event: MouseEvent, id: string): void {
    event.preventDefault();
    this.scrollToSection(id);
    // Hash routing: keep the fragment inside the route (#/privacy#cookies) so a
    // reload or a shared link still lands on the same section.
    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: id,
      replaceUrl: true,
    });
  }

  private scrollToSection(id: string): void {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    this.active.set(id);
  }

  private updateActive(): void {
    const items = this.items();
    if (items.length === 0) {
      return;
    }
    let current = items[0].id;
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (!el) {
        continue;
      }
      if (el.getBoundingClientRect().top <= 160) {
        current = item.id;
      }
    }
    this.active.set(current);
  }
}
