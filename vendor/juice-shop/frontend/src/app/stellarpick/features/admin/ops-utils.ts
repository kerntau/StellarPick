/** 平台后台的派生工具：日期分桶、环比、迷你折线与相对时间。 */

export const DAY_MS = 86_400_000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dayKey(date: Date): string {
  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
}

/** 最近 n 天（含今天），按时间正序。 */
export function lastNDays(count: number, today = new Date()): Date[] {
  const base = startOfDay(today).getTime();
  return Array.from({ length: count }, (_, index) => new Date(base - (count - 1 - index) * DAY_MS));
}

/** 最近 n 个月（含本月），按时间正序，每月 1 日。 */
export function lastNMonths(count: number, today = new Date()): Date[] {
  return Array.from(
    { length: count },
    (_, index) => new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1),
  );
}

export function monthKey(date: Date): string {
  return date.getFullYear() + '-' + (date.getMonth() + 1);
}

export function monthLabel(date: Date): string {
  return date.getMonth() + 1 + '月';
}

export function dayLabel(date: Date): string {
  return date.getMonth() + 1 + '/' + date.getDate();
}

export function weekdayLabel(date: Date): string {
  return '周' + '日一二三四五六'[date.getDay()];
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

/** 环比百分比；基数为 0 时返回 null，避免出现无意义的 +∞。 */
export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }
  const abs = Math.abs(value);
  const rounded = abs >= 10 ? Math.round(abs) : Math.round(abs * 10) / 10;
  return (value > 0 ? '+' : value < 0 ? '−' : '') + rounded + '%';
}

export function compactNumber(value: number): string {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(1) + '万';
  }
  if (Math.abs(n) >= 1000) {
    return (n / 1000).toFixed(1) + 'k';
  }
  return String(Math.round(n * 100) / 100);
}

export function relativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) {
    return '时间未记录';
  }
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return '时间未记录';
  }
  const diff = now - time;
  if (diff < 60_000) {
    return '刚刚';
  }
  if (diff < 3_600_000) {
    return Math.floor(diff / 60_000) + ' 分钟前';
  }
  if (diff < DAY_MS) {
    return Math.floor(diff / 3_600_000) + ' 小时前';
  }
  if (diff < DAY_MS * 30) {
    return Math.floor(diff / DAY_MS) + ' 天前';
  }
  return new Date(value).toLocaleDateString('zh-CN');
}

export function daysSince(value: string | null | undefined, now = Date.now()): number {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return 0;
  }
  return Math.max(0, Math.floor((now - time) / DAY_MS));
}

export function initials(name: string | null | undefined): string {
  const text = String(name ?? '').trim();
  return text ? text.slice(0, 1).toUpperCase() : '?';
}

/** 迷你折线坐标串；全 0 时贴底绘制一条平线。 */
export function sparklinePoints(values: number[], width = 84, height = 26, pad = 3): string {
  if (values.length === 0) {
    return '';
  }
  const max = Math.max(...values);
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const stepX = values.length > 1 ? usableW / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const ratio = max > 0 ? Math.max(0, value) / max : 0;
      const x = pad + stepX * index;
      const y = pad + usableH - ratio * usableH;
      return Math.round(x * 10) / 10 + ',' + Math.round(y * 10) / 10;
    })
    .join(' ');
}

export function sparklineArea(values: number[], width = 84, height = 26, pad = 3): string {
  const line = sparklinePoints(values, width, height, pad);
  if (!line) {
    return '';
  }
  return pad + ',' + (height - pad) + ' ' + line + ' ' + (width - pad) + ',' + (height - pad);
}

/** 坐标轴取整：返回 0..max 的刻度与上界；整数序列（单量/人数）不出现小数刻度。 */
export function niceScale(max: number, tickCount = 4, integer = false): { top: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) {
    return { top: 1, ticks: [0, 1] };
  }
  const rough = max / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  let step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  if (integer) {
    step = Math.max(1, Math.round(step));
  }
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return { top, ticks };
}