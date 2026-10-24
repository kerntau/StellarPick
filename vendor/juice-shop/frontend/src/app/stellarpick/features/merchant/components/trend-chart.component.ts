import { Component, computed, input, signal } from '@angular/core';
import { compactNumber, formatPct, niceScale, pctChange } from '../ops-utils';

export type TrendMode = 'count' | 'money';

/**
 * 7 日经营趋势：带 Y 轴刻度、网格线、可切换图例与悬浮/聚焦提示。
 * 数据由页面按订单聚合后传入，金额与单量两条序列都在组件内。
 */
@Component({
  selector: 'app-trend-chart',
  standalone: true,
  template: `
    <figure class="chart">
      <figcaption class="sp-sr-only">{{ title() }}</figcaption>

      <div class="chart-top">
        <div class="legend" role="group" aria-label="趋势指标">
          <button
            type="button"
            [class.on]="mode() === 'count'"
            [attr.aria-pressed]="mode() === 'count'"
            (click)="setMode('count')"
          >
            <span class="swatch swatch--count" aria-hidden="true"></span>
            订单量
            <span class="legend-unit">单</span>
          </button>
          <button
            type="button"
            [class.on]="mode() === 'money'"
            [attr.aria-pressed]="mode() === 'money'"
            (click)="setMode('money')"
          >
            <span class="swatch swatch--money" aria-hidden="true"></span>
            成交额
            <span class="legend-unit">元</span>
          </button>
        </div>
        <span class="chart-hint">悬停或聚焦柱体查看明细</span>
      </div>

      <div class="plot">
        <div class="y-axis" aria-hidden="true">
          @for (tick of ticksDesc(); track tick) {
            <span class="y-tick sp-num">{{ tickText(tick) }}</span>
          }
        </div>

        <div class="plot-main">
          <div class="chart-area">
            <div class="grid" aria-hidden="true">
              @for (tick of ticksDesc(); track tick) {
                <span class="grid-line"></span>
              }
            </div>

            <div class="cols">
              @for (label of labels(); track $index; let i = $index) {
                <button
                  class="col"
                  type="button"
                  [attr.aria-label]="ariaFor(i)"
                  (mouseenter)="hover(i)"
                  (mouseleave)="clearHover()"
                  (focus)="hover(i)"
                  (blur)="clearHover()"
                >
                  <span class="bar-slot">
                    <span
                      class="bar"
                      [class.bar--zero]="valueAt(i) <= 0"
                      [class.bar--last]="i === labels().length - 1"
                      [style.height.%]="barHeight(i)"
                    ></span>
                  </span>
                </button>
              }
            </div>

            @if (hoverIndex() !== null) {
              <div class="tip" [style]="tipStyle()" aria-hidden="true">
                <strong class="sp-num">{{ hoverLabel() }}</strong>
                <span class="sp-num">{{ full(hoverValue()) }}</span>
                @if (hoverDelta() !== null) {
                  <small class="sp-num">{{ formatPct(hoverDelta()) }} 较前一日</small>
                }
              </div>
            }
          </div>

          <div class="x-row" aria-hidden="true">
            @for (label of labels(); track $index; let i = $index) {
              <span class="x-label" [class.x-label--last]="i === labels().length - 1">{{ label }}</span>
            }
          </div>
        </div>
      </div>

      <table class="sp-sr-only">
        <caption>{{ title() }}</caption>
        <thead>
          <tr>
            <th scope="col">日期</th>
            <th scope="col">订单量</th>
            <th scope="col">成交额</th>
          </tr>
        </thead>
        <tbody>
          @for (label of labels(); track $index; let i = $index) {
            <tr>
              <th scope="row">{{ label }}</th>
              <td>{{ counts()[i] || 0 }} 单</td>
              <td>¥{{ sales()[i] || 0 }}</td>
            </tr>
          }
        </tbody>
      </table>
    </figure>
  `,
  styles: [`
    .chart { margin: 0; }
    .chart-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
    .legend { display: inline-flex; align-items: center; gap: 4px; padding: 3px; border: 1px solid var(--sp-border); border-radius: 999px; background: #FBF9F5; }
    .legend button {
      display: inline-flex; align-items: center; gap: 6px;
      min-height: 36px; padding: 0 12px; border: 0; border-radius: 999px;
      background: transparent; font-size: 12px; font-weight: 600; color: var(--sp-text-secondary);
    }
    .legend button.on { background: var(--sp-surface); color: var(--sp-primary); box-shadow: var(--sp-shadow-sm); }
    .legend-unit { font-size: 10px; color: var(--sp-text-muted); font-weight: 500; }
    .swatch { width: 8px; height: 8px; border-radius: 2px; background: var(--sp-primary); flex: none; }
    .swatch--money { background: var(--sp-accent); }
    .chart-hint { font-size: 11px; color: var(--sp-text-muted); }
    .plot { display: flex; gap: 10px; }
    .y-axis { display: flex; flex-direction: column; justify-content: space-between; width: 38px; height: 220px; text-align: right; }
    .y-tick { font-size: 10px; color: var(--sp-text-muted); line-height: 1; transform: translateY(-4px); }
    .plot-main { flex: 1 1 auto; min-width: 0; }
    .chart-area { position: relative; height: 220px; }
    .grid { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; }
    .grid-line { height: 1px; background: #EFE9DF; }
    .grid-line:last-child { background: var(--sp-border-strong); }
    .cols { position: absolute; inset: 0; display: flex; gap: 6px; }
    .col {
      flex: 1 1 0; min-width: 0; padding: 0; border: 0; border-radius: 6px;
      background: transparent; display: flex; flex-direction: column; justify-content: flex-end;
      transition: background-color .15s ease;
    }
    .col:hover, .col:focus-visible { background: rgba(11, 37, 69, .035); }
    .bar-slot { flex: 1 1 auto; display: flex; align-items: flex-end; justify-content: center; min-height: 0; }
    .bar {
      width: 62%; max-width: 38px; min-height: 3px;
      border-radius: 4px 4px 2px 2px;
      background: linear-gradient(180deg, #2C5C8F 0%, var(--sp-primary) 100%);
      transition: height .2s ease, filter .15s ease;
    }
    .bar--last { background: linear-gradient(180deg, var(--sp-accent) 0%, #C9831F 100%); }
    .bar--zero { background: var(--sp-border-strong); min-height: 2px; }
    .col:hover .bar, .col:focus-visible .bar { filter: brightness(1.06); }
    .x-row { display: flex; gap: 6px; margin-top: 8px; }
    .x-label { flex: 1 1 0; min-width: 0; text-align: center; font-size: 11px; color: var(--sp-text-muted); white-space: nowrap; }
    .x-label--last { color: var(--sp-primary); font-weight: 700; }
    .tip {
      position: absolute; top: 0; z-index: 3;
      display: flex; flex-direction: column; gap: 1px;
      padding: 6px 9px; border-radius: 6px;
      background: var(--sp-primary); color: #fff;
      box-shadow: 0 6px 18px rgba(7, 26, 51, .22);
      pointer-events: none; white-space: nowrap;
    }
    .tip strong { font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, .72); }
    .tip span { font-size: 13px; font-weight: 700; }
    .tip small { font-size: 10px; color: var(--sp-accent-strong); }
    @media (max-width: 767px) {
      .chart-hint { display: none; }
      .legend { width: 100%; }
      .legend button { flex: 1 1 0; justify-content: center; }
      .y-axis { width: 30px; height: 180px; }
      .chart-area { height: 180px; }
      .cols { gap: 3px; }
      .x-row { gap: 3px; }
      .x-label { font-size: 10px; }
      .bar { width: 68%; }
    }
  `],
})
export class TrendChartComponent {
  readonly title = input('近 7 日经营趋势');
  readonly labels = input<string[]>([]);
  readonly counts = input<number[]>([]);
  readonly sales = input<number[]>([]);
  readonly mode = signal<TrendMode>('count');

  readonly series = computed<number[]>(() => (this.mode() === 'money' ? this.sales() : this.counts()));
  readonly scale = computed(() => niceScale(Math.max(0, ...this.series()), 4, this.mode() === 'count'));
  readonly ticksDesc = computed(() => [...this.scale().ticks].reverse());
  readonly hoverIndex = signal<number | null>(null);
  readonly hoverLabel = computed(() => {
    const index = this.hoverIndex();
    return index === null ? '' : this.labels()[index] ?? '';
  });

  setMode(mode: TrendMode): void {
    this.mode.set(mode);
  }

  valueAt(index: number): number {
    return Number(this.series()[index] ?? 0);
  }

  barHeight(index: number): number {
    const top = this.scale().top || 1;
    const value = this.valueAt(index);
    return value <= 0 ? 0 : Math.max(2, (value / top) * 100);
  }

  hover(index: number): void {
    this.hoverIndex.set(index);
  }

  clearHover(): void {
    this.hoverIndex.set(null);
  }

  hoverValue(): number {
    const index = this.hoverIndex();
    return index === null ? 0 : this.valueAt(index);
  }

  hoverDelta(): number | null {
    const index = this.hoverIndex();
    if (index === null || index <= 0) {
      return null;
    }
    return pctChange(this.valueAt(index), this.valueAt(index - 1));
  }

  tipStyle(): Record<string, string> {
    const index = this.hoverIndex() ?? 0;
    const total = this.labels().length || 1;
    if (index <= 0) {
      return { left: '0', transform: 'none' };
    }
    if (index >= total - 1) {
      return { left: 'auto', right: '0', transform: 'none' };
    }
    return { left: ((index + 0.5) / total) * 100 + '%', transform: 'translateX(-50%)' };
  }

  tickText(tick: number): string {
    return this.mode() === 'money' ? '¥' + compactNumber(tick) : compactNumber(tick);
  }

  full(value: number): string {
    if (this.mode() === 'money') {
      return '¥' + Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
    }
    return value + ' 单';
  }

  ariaFor(index: number): string {
    const delta = index > 0 ? pctChange(this.valueAt(index), this.valueAt(index - 1)) : null;
    const trend = delta === null ? '' : '，较前一日 ' + formatPct(delta);
    return this.labels()[index] + ' ' + this.full(this.valueAt(index)) + trend;
  }
}
