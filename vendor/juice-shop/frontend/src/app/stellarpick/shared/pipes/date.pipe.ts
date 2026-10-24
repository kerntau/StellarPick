import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'spDate' })
export class SpDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, withTime = true): string {
    if (!value) {
      return '—';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    return withTime ? day + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) : day;
  }
}
