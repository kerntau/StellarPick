import { Component, computed, input } from '@angular/core';

const MAP: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: '待付款', tone: 'warning' },
  pending_shipment: { label: '待发货', tone: 'info' },
  shipped: { label: '已发货', tone: 'accent' },
  completed: { label: '已完成', tone: 'success' },
  cancelled: { label: '已取消', tone: 'muted' },
  pending: { label: '待处理', tone: 'warning' },
  open: { label: '待处理', tone: 'warning' },
  processing: { label: '处理中', tone: 'info' },
  closed: { label: '已关闭', tone: 'muted' },
  active: { label: '正常', tone: 'success' },
  disabled: { label: '已禁用', tone: 'danger' },
  approved: { label: '已通过', tone: 'success' },
  rejected: { label: '已驳回', tone: 'danger' },
  on_sale: { label: '在售', tone: 'success' },
  off_sale: { label: '已下架', tone: 'muted' },
  admin: { label: '管理员', tone: 'accent' },
  member: { label: '会员', tone: 'info' },
  merchant: { label: '商家', tone: 'info' },
  support: { label: '客服', tone: 'info' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span [class]="'sp-badge sp-badge--' + tone()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  readonly label = computed(() => MAP[this.status()]?.label ?? this.status());
  readonly tone = computed(() => MAP[this.status()]?.tone ?? 'muted');
}