import { Component, input, output } from '@angular/core';
import { SORT_OPTIONS, SortKey } from './catalog-query';

@Component({
  selector: 'app-sort-bar',
  standalone: true,
  template: `
    <div class="sortbar">
      <p class="count" aria-live="polite">共 <strong class="sp-num">{{ total() }}</strong> 件商品</p>

      <div class="tabs" role="group" aria-label="排序方式">
        @for (option of options; track option.key) {
          <button
            class="tab"
            type="button"
            [class.on]="sort() === option.key"
            [attr.aria-pressed]="sort() === option.key"
            (click)="select(option.key)">{{ option.label }}</button>
        }
      </div>

      <label class="select">
        <span class="select-label">排序</span>
        <select class="sp-select" [value]="sort()" (change)="onSelect($event)" aria-label="排序方式">
          @for (option of options; track option.key) {
            <option [value]="option.key">{{ option.label }}</option>
          }
        </select>
      </label>
    </div>
  `,
  styles: [`
    .sortbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .count { font-size: 13px; color: var(--sp-text-secondary); white-space: nowrap; }
    .count strong { color: var(--sp-text); }
    .tabs { display: flex; align-items: center; gap: 2px; margin-left: auto; flex-wrap: wrap; }
    .tab { min-height: 36px; padding: 0 12px; border: 1px solid transparent; border-radius: var(--sp-radius-sm); background: transparent; color: var(--sp-text-secondary); font-size: 13px; white-space: nowrap; }
    .tab:hover { color: var(--sp-primary); background: rgba(11, 37, 69, .05); }
    .tab.on { background: var(--sp-surface); border-color: var(--sp-border-strong); color: var(--sp-primary); font-weight: 700; }
    .select { display: none; align-items: center; gap: 8px; margin-left: auto; }
    .select-label { font-size: 12px; color: var(--sp-text-muted); white-space: nowrap; }
    .select .sp-select { min-width: 132px; min-height: 40px; }
    @media (max-width: 767px) {
      .sortbar { gap: 8px; justify-content: space-between; }
      .count { flex: 1 1 auto; font-size: 12px; }
      .tabs { display: none; }
      .select { display: inline-flex; }
      .select-label { display: none; }
      .select .sp-select { min-width: 104px; min-height: 44px; }
    }
  `],
})
export class SortBarComponent {
  readonly sort = input<SortKey>('default');
  readonly total = input(0);
  readonly sortChange = output<SortKey>();

  readonly options = SORT_OPTIONS;

  select(key: SortKey): void {
    if (key !== this.sort()) {
      this.sortChange.emit(key);
    }
  }

  onSelect(event: Event): void {
    this.select((event.target as HTMLSelectElement).value as SortKey);
  }
}