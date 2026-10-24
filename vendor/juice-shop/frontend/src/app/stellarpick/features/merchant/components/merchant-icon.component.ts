import { Component, computed, input } from '@angular/core';

/** 商家中心本地内联图标（24x24 线性，颜色继承 currentColor）。 */
const PATHS: Record<string, string[]> = {
  home: ['M3 10.5 12 3l9 7.5V21H3z', 'M9 21v-7h6v7'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  package: ['M20.5 8 12 3.5 3.5 8 12 12.5z', 'M3.5 8v8L12 21l8.5-5V8', 'M12 12.5V21'],
  'file-text': ['M14 3H6v18h12V7z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  store: ['M3.5 9 5 4h14l1.5 5', 'M4 9v11h16V9', 'M9 20v-6h6v6'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M3 20h18'],
  truck: [
    'M3 6h11v10H3z',
    'M14 10h4l3 3v3h-7',
    'M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
    'M17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  ],
  clock: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18', 'M12 7v5l3 2'],
  edit: ['M4 20h4L18.5 9.5l-4-4L4 16z', 'm13 6 4 4'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['m4 12 5 5L20 6'],
  x: ['M5 5l14 14', 'M19 5 5 19'],
  'chevron-left': ['m14 6-6 6 6 6'],
  'chevron-right': ['m10 6 6 6-6 6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'arrow-right': ['M4 12h16', 'm13 5 7 7-7 7'],
  'arrow-left': ['M20 12H4', 'm11 5-7 7 7 7'],
  'log-out': ['M15 4h4v16h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
  search: ['M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14', 'm20 20-3.6-3.6'],
  refresh: ['M20 11a8 8 0 1 0-2.4 5.7', 'M20 4v7h-7'],
  image: ['M4 4h16v16H4z', 'M4 16l4.5-4.5L13 16l3-3 4 4', 'M9 9.5h.01'],
  tag: ['M20 12l-8 8-8-8V4h8z', 'M8.5 7.5h.01'],
  alert: ['M12 3 21 20H3z', 'M12 9v5', 'M12 17h.01'],
  info: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18', 'M12 11v5', 'M12 8h.01'],
  'credit-card': ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4'],
  calendar: ['M4 6h16v14H4z', 'M8 3v4', 'M16 3v4', 'M4 11h16'],
  'map-pin': ['M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  phone: ['M6 3h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 4 5a2 2 0 0 1 2-2z'],
  user: ['M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
  sparkles: [
    'm12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z',
    'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  ],
  download: ['M12 4v11', 'm7 10 5 5 5-5', 'M4 20h16'],
  filter: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  eye: ['M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  shield: ['M12 3l8 3v6c0 4.8-3.3 7.9-8 9-4.7-1.1-8-4.2-8-9V6z', 'm9 12 2 2 4-4'],
  'arrow-up': ['M12 20V4', 'm5 11 7-7 7 7'],
  'arrow-down': ['M12 4v16', 'm5 13 7 7 7-7'],
  'user-check': [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'm16 11 2 2 4-4',
  ],
  'alert-circle': ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18', 'M12 8v5', 'M12 16h.01'],
  'check-circle': ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18', 'm8 12 3 3 5-6'],
  'trending-up': ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  wallet: ['M3 7h18v12H3z', 'M3 7l2-3h12l2 3', 'M16 13h2'],
  inbox: ['M3 13h5l2 3h4l2-3h5', 'M3 13V6h18v7', 'M3 13v5h18v-5'],
  activity: ['M3 12h4l2.5-7 4 14 2.5-7h5'],
  layers: ['M12 3 3 8l9 5 9-5z', 'm3 13 9 5 9-5'],
  sliders: ['M4 7h10', 'M18 7h2', 'M4 17h4', 'M12 17h8', 'M16 5v4', 'M10 15v4'],
  bookmark: ['M6 3h12v18l-6-4-6 4z'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  'more-horizontal': ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  'chevron-up': ['m6 15 6-6 6 6'],
  'trending-down': ['M22 17l-8.5-8.5-5 5L2 7', 'M16 17h6v-6'],
  'arrow-up-right': ['M7 17 17 7', 'M8 7h9v9'],
  'check-square': ['M4 4h16v16H4z', 'm8 12 3 3 5-6'],
  clipboard: ['M9 4h6v3H9z', 'M9 5H5v16h14V5h-4', 'M9 12h6', 'M9 16h4'],
  star: ['m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
  save: ['M4 4h13l3 3v13H4z', 'M8 4v6h8V4', 'M8 20v-6h8v6'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'],
  percent: ['M19 5 5 19', 'M7.5 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5', 'M16.5 14a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5'],
  'shopping-bag': ['M5 8h14l-1 13H6z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  archive: ['M3 5h18v4H3z', 'M5 9v11h14V9', 'M10 13h4'],
  minus: ['M5 12h14'],
  'rotate-ccw': ['M3 5v6h6', 'M3.5 11a8.5 8.5 0 1 1 2 8'],
};

@Component({
  selector: 'app-merchant-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; flex: none; }
    svg { display: block; }
  `],
})
export class MerchantIconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly paths = computed(() => PATHS[this.name()] ?? PATHS['info'] ?? []);
}
