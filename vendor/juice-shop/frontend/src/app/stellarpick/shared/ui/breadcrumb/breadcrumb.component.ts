import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

export interface Crumb {
  label: string;
  link?: string | unknown[];
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <nav class="crumbs" aria-label="面包屑">
      <ol>
        @for (crumb of items(); track crumb.label; let last = $last) {
          <li>
            @if (!last && crumb.link) {
              <a [routerLink]="crumb.link">{{ crumb.label }}</a>
              <app-icon name="chevron-right" [size]="12" />
            } @else {
              <span [attr.aria-current]="last ? 'page' : null">{{ crumb.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [`
    .crumbs { padding: 16px 0 6px; font-size: 11.5px; letter-spacing: .02em; color: var(--sp-text-secondary); }
    ol { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
    li { display: inline-flex; align-items: center; gap: 4px; }
    a:hover { color: var(--sp-primary); text-decoration: underline; text-underline-offset: 3px; }
    span[aria-current] { color: var(--sp-text-muted); }
    app-icon { color: var(--sp-text-muted); }
  `],
})
export class BreadcrumbComponent {
  readonly items = input<Crumb[]>([]);
}
