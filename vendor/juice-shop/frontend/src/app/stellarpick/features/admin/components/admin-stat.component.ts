import { Component, computed, input } from '@angular/core';
import { formatPct, sparklineArea, sparklinePoints } from '../ops-utils';
import { AdminIconComponent } from './admin-icon.component';

/** 平台指标卡：数值 + 环比 + 迷你趋势，数值使用 tabular-nums。 */
@Component({
  selector: 'app-admin-stat',
  standalone: true,
  imports: [AdminIconComponent],
  template: `
    <article [class]="'kpi kpi--' + tone()">
      <header class="kpi-head">
        <span class="kpi-label">{{ label() }}</span>
        <span class="kpi-ico"><app-admin-icon [name]="icon()" [size]="16" /></span>
      </header>

      <div class="kpi-main">
        <p class="kpi-value sp-num">{{ value() }}</p>
        @if (delta() !== null) {
          <span class="kpi-delta" [class.up]="isUp()" [class.down]="isDown()">
            <app-admin-icon [name]="isDown() ? 'trending-down' : 'trending-up'" [size]="12" />
            {{ pctText() }}
          </span>
        }
      </div>

      @if (delta() !== null) {
        <p class="kpi-delta-label">{{ deltaLabel() }}</p>
      }

      <footer class="kpi-foot">
        <p class="kpi-hint">{{ hint() }}</p>
        @if (spark().length > 1) {
          <svg class="spark" viewBox="0 0 84 26" width="84" height="26" aria-hidden="true" focusable="false">
            <polygon [attr.points]="areaPoints()" [class.spark-area--accent]="tone() === 'accent'" />
            <polyline [attr.points]="linePoints()" [class.spark-line--accent]="tone() === 'accent'" />
          </svg>
        }
        @if (meter() !== null) {
          <span class="kpi-meter" aria-hidden="true">
            <span [style.width.%]="meter()"></span>
          </span>
        }
      </footer>
    </article>
  `,
  styles: [`
    .kpi {
      display: flex; flex-direction: column; gap: 6px;
      background: var(--sp-surface); border: 1px solid var(--sp-border);
      border-radius: 10px; box-shadow: var(--sp-shadow-sm);
      padding: 16px 18px; min-height: 132px;
    }
    .kpi-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .kpi-label { font-size: 12px; font-weight: 600; color: var(--sp-text-secondary); letter-spacing: .02em; }
    .kpi-ico {
      width: 28px; height: 28px; border-radius: 7px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--sp-info-soft); color: var(--sp-info-strong);
    }
    .kpi-main { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .kpi-value { font-size: 28px; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; }
    .kpi-delta {
      display: inline-flex; align-items: center; gap: 2px;
      padding: 1px 6px 1px 4px; border-radius: 999px;
      font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
      background: var(--sp-bg); color: var(--sp-text-secondary);
    }
    .kpi-delta.up { background: var(--sp-success-soft); color: var(--sp-success); }
    .kpi-delta.down { background: var(--sp-danger-soft); color: var(--sp-danger); }
    .kpi-delta-label { font-size: 11px; color: var(--sp-text-muted); margin-top: -2px; }
    .kpi-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; margin-top: auto; }
    .kpi-hint { font-size: 11px; line-height: 1.5; color: var(--sp-text-muted); }
    .spark { flex: none; overflow: visible; }
    .spark polygon { fill: rgba(11, 37, 69, .07); }
    .spark polygon.spark-area--accent { fill: rgba(232, 163, 61, .16); }
    .spark polyline { fill: none; stroke: var(--sp-primary); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
    .spark polyline.spark-line--accent { stroke: #B77A15; }
    .kpi-meter { display: block; width: 84px; height: 6px; border-radius: 999px; background: var(--sp-bg); overflow: hidden; flex: none; }
    .kpi-meter span { display: block; height: 100%; border-radius: 999px; background: var(--sp-sage); }
    .kpi--accent .kpi-ico { background: #FBF0DC; color: var(--sp-accent-text); }
    .kpi--success .kpi-ico { background: var(--sp-success-soft); color: var(--sp-success); }
    .kpi--warning .kpi-ico { background: var(--sp-warning-soft); color: var(--sp-warning); }
    .kpi--danger .kpi-ico { background: var(--sp-danger-soft); color: var(--sp-danger); }
    .kpi--primary .kpi-ico { background: var(--sp-info-soft); color: var(--sp-primary); }
    @media (max-width: 767px) {
      .kpi { padding: 14px; min-height: 116px; gap: 4px; }
      .kpi-value { font-size: 24px; }
      .kpi-label { font-size: 11px; }
      .spark, .kpi-meter { display: none; }
    }
  `],
})
export class AdminStatComponent {
  readonly label = input.required<string>();
  readonly value = input<string | number>(0);
  readonly hint = input('');
  readonly icon = input('chart');
  readonly tone = input<'primary' | 'accent' | 'success' | 'warning' | 'danger'>('primary');
  readonly delta = input<number | null>(null);
  readonly deltaLabel = input('较前 7 日');
  readonly spark = input<number[]>([]);
  readonly meter = input<number | null>(null);

  readonly pctText = computed(() => formatPct(this.delta()));
  readonly isUp = computed(() => (this.delta() ?? 0) > 0);
  readonly isDown = computed(() => (this.delta() ?? 0) < 0);
  readonly linePoints = computed(() => sparklinePoints(this.spark()));
  readonly areaPoints = computed(() => sparklineArea(this.spark()));
}
