import { Component, input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<svg [attr.width]="size()" [attr.height]="size()" aria-hidden="true" focusable="false"><use [attr.href]="'/assets/sp/icons.svg#i-' + name()"></use></svg>`,
  styles: [':host{display:inline-flex;align-items:center;justify-content:center;line-height:0}'],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);
}

