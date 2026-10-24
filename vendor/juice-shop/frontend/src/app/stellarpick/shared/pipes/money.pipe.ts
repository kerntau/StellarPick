import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'spMoney' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) {
      return '¥0.00';
    }
    return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
