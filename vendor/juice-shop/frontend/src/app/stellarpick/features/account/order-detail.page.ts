import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { OrdersApi } from '../../core/api/orders.api';
import { CartService } from '../../core/cart.service';
import { PRODUCT_META } from '../../core/catalog';
import { Order, OrderItem, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SpDatePipe } from '../../shared/pipes/date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ConfirmDialogComponent } from './components/confirm-dialog.component';
import { ReviewModalComponent } from './components/review-modal.component';
import { PaymentIconsComponent } from '../cart/components/payment-icons.component';

interface ReviewTarget {
  productId: number;
  title: string;
  image: string;
}

const STEP_KEYS: { key: string; label: string }[] = [
  { key: 'pending_payment', label: '待付款' },
  { key: 'pending_shipment', label: '待发货' },
  { key: 'shipped', label: '已发货' },
  { key: 'completed', label: '已完成' },
];

const STATUS_INDEX: Record<string, number> = {
  pending_payment: 0,
  pending_shipment: 1,
  shipped: 2,
  completed: 3,
};

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    MoneyPipe,
    SpDatePipe,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    StatusBadgeComponent,
    IconComponent,
    ConfirmDialogComponent,
    ReviewModalComponent,
    PaymentIconsComponent,
  ],
  template: `
    @if (showSkeleton()) {
      <div class="detail-skeleton">
        <app-skeleton variant="line" width="35%" />
        <app-skeleton variant="detail" />
        <app-skeleton variant="table" />
      </div>
    } @else if (notFound()) {
      <app-empty-state
        image="not-found"
        title="订单不存在"
        description="订单号可能有误，或该订单已被删除。你可以返回订单列表重新选择。"
        actionLabel="返回订单列表"
        actionLink="/account/orders"
      />
    } @else if (error()) {
      <app-error-state
        [message]="error() ?? '加载失败，请稍后重试'"
        [requestId]="requestId()"
        (retry)="load()"
      />
    } @else if (order(); as o) {
      <div class="detail-head">
        <a class="back-link" routerLink="/account/orders">
          <app-icon name="chevron-left" [size]="16" /> 返回订单列表
        </a>
        <span class="sp-eyebrow">ORDER DETAIL · 订单详情</span>
        <div class="title-row">
          <h1>订单详情</h1>
          <app-status-badge [status]="o.status" />
        </div>
        <p class="sp-secondary sp-text-13">
          订单号 <strong class="sp-num">{{ o.id }}</strong>
          <button class="copy-btn" type="button" (click)="copyOrderNo(o)" aria-label="复制订单号">
            <app-icon name="file-text" [size]="14" /> 复制
          </button>
          <span class="dot-sep">·</span>
          下单时间 <span class="sp-num">{{ o.createdAt | spDate }}</span>
          <span class="dot-sep">·</span>
          {{ o.statusText }}
        </p>
      </div>

      <section class="sp-card status-card" aria-label="订单进度">
        @if (o.status === 'cancelled') {
          <div class="cancelled">
            <app-icon name="alert-circle" [size]="22" />
            <div>
              <strong>订单已取消</strong>
              <p class="sp-text-13">该订单已关闭，如需帮助可联系客服或重新下单。</p>
            </div>
          </div>
        } @else {
          <div class="status-head">
            <div>
              <span class="status-kicker">ORDER TIMELINE</span>
              <strong class="status-title">{{ statusTitle(o.status) }}</strong>
            </div>
            @if (statusHint()) {
              <p class="status-hint sp-text-13">{{ statusHint() }}</p>
            }
          </div>

          <ol class="sp-steps order-steps">
            @for (step of steps(); track step.key; let i = $index) {
              <li
                [class.on]="i <= activeStep(o.status)"
                [class.current]="i === activeStep(o.status)"
                [attr.aria-current]="i === activeStep(o.status) ? 'step' : null"
              >
                <span class="dot">
                  @if (i < activeStep(o.status)) {
                    <app-icon name="check" [size]="14" />
                  } @else {
                    {{ i + 1 }}
                  }
                </span>
                <span class="step-text">
                  <span class="step-label">{{ step.label }}</span>
                  @if (step.at) {
                    <span class="step-time sp-num">{{ step.at | spDate }}</span>
                  }
                  <span class="step-desc">{{ stepDescription(step.key) }}</span>
                </span>
              </li>
            }
          </ol>

          <div class="status-meta">
            <div>
              <span class="meta-label">预计送达</span>
              <strong>{{ etaLabel(o) }}</strong>
            </div>
            <div>
              <span class="meta-label">配送方式</span>
              <strong>{{ shippingLabel(o.shipping, o.shippingSlot) }}</strong>
            </div>
            <div>
              <span class="meta-label">运单号</span>
              <strong class="sp-num">{{ trackingNo(o) }}</strong>
            </div>
          </div>
        }
      </section>

      <section class="sp-card items-card" aria-labelledby="items-title">
        <header class="card-head">
          <h2 id="items-title">商品清单</h2>
          <span class="sp-text-13 sp-muted">共 {{ itemCount(o) }} 件</span>
        </header>

        <div class="item-list">
          @for (item of o.items; track item.productId + '-' + $index) {
            <div class="item">
              <img
                class="item-img"
                [src]="item.image"
                [alt]="item.title"
                width="72"
                height="72"
                loading="lazy"
              />
              <div class="item-info">
                <a class="item-title sp-clamp-2" [routerLink]="['/product', item.productId]">{{ item.title }}</a>
                <p class="item-meta sp-text-13 sp-muted">
                  @if (specOf(item.productId)) {
                    <span class="item-spec">{{ specOf(item.productId) }}</span>
                  }
                  <span class="member-chip">成交价</span>
                  <span class="sp-num">{{ item.unitPrice | spMoney }}</span>
                  <span class="dot-sep">×</span>
                  {{ item.quantity }}
                </p>
              </div>
              <div class="item-total sp-num">{{ item.unitPrice * item.quantity | spMoney }}</div>
              @if (o.status === 'completed') {
                <div class="item-ops">
                  <a class="review-link" [routerLink]="['/product', item.productId]" fragment="reviews">查看评价</a>
                  <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="openReview(item)">
                    评价
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </section>

      <div class="info-grid">
        <div class="info-left">
          <section class="sp-card sp-card--pad info-card" aria-labelledby="shipping-title">
            <h2 id="shipping-title" class="card-title"><app-icon name="map-pin" [size]="18" /> 收货信息</h2>
            <dl class="info-list">
              <div>
                <dt>收货人</dt>
                <dd>{{ recipient(o) }} <span class="sp-num phone">{{ addressPhone(o) }}</span></dd>
              </div>
              <div>
                <dt>收货地址</dt>
                <dd>
                  <span class="addr-tag"><app-icon name="truck" [size]="12" /> 配送至</span>
                  {{ addressRegion(o) }} {{ addressDetail(o) }}
                </dd>
              </div>
              <div>
                <dt>下单账号</dt>
                <dd>
                  {{ o.ownerName || '—' }}
                  <span class="sp-muted">（{{ o.ownerEmail || '—' }}）</span>
                  @if (o.ownerUsername) {
                    <span class="sp-muted"> · {{ o.ownerUsername }}</span>
                  }
                </dd>
              </div>
              <div>
                <dt>发票</dt>
                <dd>{{ invoiceLabel(o.invoice, o.invoiceTitle) }}</dd>
              </div>
              @if (o.gift) {
                <div>
                  <dt>赠言</dt>
                  <dd>{{ o.gift }}</dd>
                </div>
              }
            </dl>
            <p class="sp-hint account-hint">订单信息按订单号展示，请核对收货人与下单账号后再操作。</p>
          </section>

          <section id="logistics" class="sp-card sp-card--pad info-card" aria-labelledby="logistics-title">
            <h2 id="logistics-title" class="card-title"><app-icon name="truck" [size]="18" /> 物流信息</h2>
            <dl class="info-list logistics-head">
              <div>
                <dt>配送方式</dt>
                <dd>{{ shippingLabel(o.shipping, o.shippingSlot) }}</dd>
              </div>
              <div>
                <dt>运单号</dt>
                <dd class="sp-num">{{ trackingNo(o) }}</dd>
              </div>
              <div>
                <dt>物流状态</dt>
                <dd>{{ logisticsStatus(o) }}</dd>
              </div>
            </dl>

            <ol class="logistics-timeline" aria-label="物流轨迹">
              @for (event of logisticsEvents(o); track event.label) {
                <li [class.on]="event.on">
                  <span class="log-dot" aria-hidden="true"></span>
                  <div class="log-copy">
                    <strong>{{ event.label }}</strong>
                    <small class="sp-num">{{ event.at | spDate }}</small>
                  </div>
                </li>
              }
            </ol>
            <p class="sp-hint">演示环境，物流轨迹与运单号为虚构数据，仅用于页面展示。</p>
          </section>
        </div>

        <aside class="sp-card sp-card--pad amount-card" aria-labelledby="amount-title">
          <h2 id="amount-title" class="card-title"><app-icon name="credit-card" [size]="18" /> 金额明细</h2>
          <dl class="amount-list">
            <div>
              <dt>商品件数</dt>
              <dd class="sp-num">{{ itemCount(o) }} 件</dd>
            </div>
            <div>
              <dt>商品合计</dt>
              <dd class="sp-num">{{ itemsTotal() | spMoney }}</dd>
            </div>
            <div>
              <dt>运费</dt>
              <dd class="sp-num">{{ shippingFee() > 0 ? (shippingFee() | spMoney) : '包邮' }}</dd>
            </div>
            @if (discount() > 0) {
              <div>
                <dt>优惠</dt>
                <dd class="sp-num discount">-{{ discount() | spMoney }}</dd>
              </div>
            }
            <div>
              <dt>支付方式</dt>
              <dd>{{ paymentLabel(o) }}</dd>
            </div>
            <div class="total">
              <dt>实付金额</dt>
              <dd class="sp-num">{{ o.total | spMoney }}</dd>
            </div>
          </dl>

          <div class="amount-pay">
            <span class="amount-pay-label">支付方式</span>
            <app-payment-icons [compact]="true" />
          </div>
          <p class="amount-note"><app-icon name="info" [size]="13" /> 演示支付，不会产生真实扣款。</p>
        </aside>
      </div>

      <div class="action-bar">
        <a class="sp-btn sp-btn--ghost" routerLink="/support/tickets">
          <app-icon name="headset" [size]="16" /> 申请售后
        </a>

        <div class="ops">
          @if (o.status === 'pending_payment') {
            <button class="sp-btn sp-btn--secondary" type="button" [disabled]="busy()" (click)="cancelOpen.set(true)">
              取消订单
            </button>
            <button class="sp-btn sp-btn--primary" type="button" [disabled]="busy()" (click)="pay(o)">
              {{ busy() ? '处理中…' : '立即付款' }}
            </button>
          }
          @if (o.status === 'pending_shipment') {
            <button class="sp-btn sp-btn--secondary" type="button" (click)="remindShipment(o)">
              <app-icon name="clock" [size]="16" /> 提醒发货
            </button>
          }
          @if (o.status === 'shipped') {
            <button class="sp-btn sp-btn--secondary" type="button" (click)="scrollToLogistics()">
              <app-icon name="truck" [size]="16" /> 查看物流
            </button>
            <button class="sp-btn sp-btn--primary" type="button" [disabled]="busy()" (click)="confirmReceipt(o)">
              {{ busy() ? '处理中…' : '确认收货' }}
            </button>
          }
          @if (o.status === 'completed') {
            <button class="sp-btn sp-btn--secondary" type="button" [disabled]="busy()" (click)="buyAgain(o)">
              再次购买
            </button>
            <button class="sp-btn sp-btn--primary" type="button" (click)="openOrderReview(o)">
              <app-icon name="star" [size]="16" /> 评价订单
            </button>
          }
          <a class="sp-btn sp-btn--secondary" routerLink="/account/orders">返回列表</a>
        </div>
      </div>

      <app-confirm-dialog
        [open]="cancelOpen()"
        title="取消订单"
        [message]="'确定取消订单 #' + o.id + ' 吗？取消后无法恢复。'"
        confirmLabel="取消订单"
        cancelLabel="保留订单"
        [danger]="true"
        [busy]="busy()"
        [error]="cancelError()"
        (confirmed)="cancelOrder(o)"
        (closed)="cancelOpen.set(false)"
      />

      <app-review-modal
        [open]="reviewOpen()"
        [productId]="reviewTarget()?.productId ?? null"
        [productTitle]="reviewTarget()?.title ?? ''"
        [productImage]="reviewTarget()?.image ?? ''"
        (closed)="reviewOpen.set(false)"
        (saved)="onReviewed()"
      />
    }
  `,
  styles: [
    `
      .detail-skeleton { display: flex; flex-direction: column; gap: 20px; padding-top: 8px; }

      .detail-head { padding-bottom: 16px; }
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 32px;
        font-size: var(--sp-text-13);
        color: var(--sp-text-secondary);
        margin-bottom: 8px;
      }
      .back-link:hover { color: var(--sp-primary); }
      .title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .title-row h1 { font-family: var(--sp-serif); font-size: 32px; letter-spacing: .02em; }
      .dot-sep { margin: 0 6px; color: var(--sp-text-muted); }
      .copy-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
        padding: 2px 8px;
        min-height: 24px;
        border: 1px solid var(--sp-border);
        border-radius: var(--sp-radius-pill);
        background: var(--sp-surface);
        color: var(--sp-text-secondary);
        font-size: var(--sp-text-12);
      }
      .copy-btn:hover { border-color: var(--sp-primary); color: var(--sp-primary); }

      .status-card { padding: 18px 24px; margin-bottom: 16px; }
      .status-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .status-kicker { display: block; font-size: 9.5px; letter-spacing: .18em; color: var(--sp-text-muted); }
      .status-title { display: block; font-size: var(--sp-text-16); color: var(--sp-primary); margin-top: 1px; }
      .order-steps { padding: 12px 0 4px; overflow-x: auto; flex-wrap: nowrap; }
      .order-steps li { flex: 0 0 auto; align-items: flex-start; }
      .order-steps .dot { flex: 0 0 auto; margin-top: 1px; }
      .order-steps li::after { width: 32px; margin-top: 12px; }
      .step-text { display: inline-flex; flex-direction: column; line-height: 1.3; }
      .step-label { font-size: var(--sp-text-13); }
      .step-time { font-size: 11px; color: var(--sp-text-muted); margin-top: 2px; }
      .step-desc { font-size: 10.5px; color: var(--sp-text-muted); margin-top: 1px; max-width: 130px; white-space: normal; }
      .order-steps li.on .step-time { color: var(--sp-text-secondary); }
      .order-steps li.current .step-label { font-weight: 700; color: var(--sp-primary); }
      .order-steps li.current .dot { background: var(--sp-primary); border-color: var(--sp-primary); color: #fff; }
      .status-hint { margin: 4px 0 0; color: var(--sp-text-secondary); }
      .status-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px dashed var(--sp-border);
      }
      .status-meta > div { display: flex; flex-direction: column; gap: 1px; padding-left: 16px; border-left: 1px solid var(--sp-border); }
      .status-meta > div:first-child { padding-left: 0; border-left: 0; }
      .meta-label { font-size: 10.5px; color: var(--sp-text-muted); }
      .status-meta strong { font-size: 12.5px; color: var(--sp-text); }

      .cancelled {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        color: var(--sp-warning);
        padding: 4px 0;
      }
      .cancelled strong { display: block; color: var(--sp-text); font-size: var(--sp-text-16); }
      .cancelled p { color: var(--sp-text-secondary); margin-top: 2px; }

      .items-card { margin-bottom: 16px; overflow: hidden; }
      .card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 24px;
        border-bottom: 1px solid var(--sp-border);
      }
      .card-head h2 { font-size: var(--sp-text-16); }
      .item-list { display: flex; flex-direction: column; }
      .item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 24px;
        border-bottom: 1px solid var(--sp-border);
      }
      .item:last-child { border-bottom: 0; }
      .item-img {
        width: 72px;
        height: 72px;
        border-radius: var(--sp-radius-sm);
        object-fit: cover;
        background: var(--sp-bg);
        border: 1px solid var(--sp-border);
        flex: 0 0 auto;
      }
      .item-info { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 4px; }
      .item-title { font-size: var(--sp-text-14); font-weight: 600; }
      .item-title:hover { color: var(--sp-accent-text); }
      .item-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .item-spec { padding: 0 5px; border: 1px solid var(--sp-border); border-radius: 3px; background: var(--sp-bg); color: var(--sp-text-secondary); }
      .member-chip { padding: 0 5px; border-radius: 2px; background: #FBF0DC; color: var(--sp-accent-text); font-size: 10.5px; font-weight: 700; }
      .item-total { color: var(--sp-accent-text); font-weight: 700; flex: 0 0 auto; }
      .item-ops { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
      .review-link { font-size: var(--sp-text-12); color: var(--sp-info); font-weight: 600; }
      .review-link:hover { text-decoration: underline; }

      .info-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(260px, 1fr);
        gap: 16px;
        align-items: start;
      }
      .info-left { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
      .card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--sp-text-16);
        margin-bottom: 12px;
      }
      .card-title app-icon { color: var(--sp-accent-text); }
      .info-list { display: flex; flex-direction: column; gap: 10px; margin: 0; }
      .info-list > div { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 12px; font-size: var(--sp-text-14); }
      .info-list dt { color: var(--sp-text-muted); font-size: var(--sp-text-13); }
      .info-list dd { margin: 0; line-height: 1.6; word-break: break-word; }
      .phone { color: var(--sp-text-secondary); margin-left: 6px; }
      .addr-tag { display: inline-flex; align-items: center; gap: 3px; margin-right: 6px; padding: 0 5px; border-radius: 3px; background: var(--sp-success-soft); color: var(--sp-success); font-size: 10.5px; }
      .account-hint { margin-top: 12px; }
      .info-card .sp-hint { margin-top: 12px; }

      .logistics-head { margin-bottom: 12px; }
      .logistics-timeline { display: flex; flex-direction: column; gap: 0; margin: 0; padding: 4px 0 0; list-style: none; }
      .logistics-timeline li { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 0 0 14px 0; }
      .logistics-timeline li::before { content: ''; position: absolute; left: 4px; top: 12px; bottom: 0; width: 1px; background: var(--sp-border); }
      .logistics-timeline li:last-child { padding-bottom: 0; }
      .logistics-timeline li:last-child::before { display: none; }
      .log-dot { width: 9px; height: 9px; margin-top: 3px; border-radius: 50%; background: var(--sp-border-strong); flex: 0 0 auto; position: relative; z-index: 1; }
      .logistics-timeline li.on .log-dot { background: var(--sp-sage); box-shadow: 0 0 0 3px var(--sp-success-soft); }
      .log-copy { display: flex; flex-direction: column; gap: 0; min-width: 0; }
      .log-copy strong { font-size: 12px; color: var(--sp-text-secondary); }
      .logistics-timeline li.on .log-copy strong { color: var(--sp-text); }
      .log-copy small { font-size: 10.5px; color: var(--sp-text-muted); }

      .amount-card { position: sticky; top: calc(var(--sp-header-h) + 12px); }
      .amount-list { display: flex; flex-direction: column; gap: 10px; margin: 0; }
      .amount-list > div { display: flex; justify-content: space-between; gap: 16px; font-size: var(--sp-text-14); }
      .amount-list dt { color: var(--sp-text-secondary); }
      .amount-list dd { margin: 0; }
      .amount-list .discount { color: var(--sp-success); }
      .amount-list .total {
        border-top: 1px solid var(--sp-border);
        margin-top: 4px;
        padding-top: 12px;
        font-size: var(--sp-text-16);
        font-weight: 700;
      }
      .amount-list .total dd { color: var(--sp-accent-text); font-size: var(--sp-text-24); font-weight: 800; }
      .amount-pay { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--sp-border); }
      .amount-pay-label { display: block; margin-bottom: 4px; font-size: 10.5px; color: var(--sp-text-muted); }
      .amount-note { display: flex; align-items: flex-start; gap: 4px; margin-top: 8px; font-size: 10.5px; color: var(--sp-text-muted); line-height: 1.45; }
      .amount-note app-icon { flex: 0 0 auto; margin-top: 1px; }

      .action-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 16px;
        padding: 16px 0;
      }
      .ops { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

      @media (max-width: 1023px) {
        .info-grid { grid-template-columns: 1fr; }
        .amount-card { position: static; }
      }
      @media (max-width: 767px) {
        .title-row h1 { font-size: 26px; }
        .status-card { padding: 14px 16px; }
        .status-head { flex-direction: column; gap: 4px; }
        .status-meta { grid-template-columns: 1fr; gap: 6px; }
        .status-meta > div { padding-left: 0; border-left: 0; }
        .step-desc { display: none; }
        .order-steps {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 4px;
          overflow: visible;
          padding: 4px 0 0;
        }
        .order-steps li {
          flex-direction: column;
          align-items: center;
          gap: 4px;
          text-align: center;
        }
        .order-steps li::after { display: none; }
        .order-steps .step-text { align-items: center; }
        .step-time { display: none; }
        .item-ops { flex-direction: column; align-items: flex-end; gap: 6px; }
        .item { padding: 12px 16px; gap: 12px; flex-wrap: wrap; }
        .item-img { width: 64px; height: 64px; }
        .item-total { margin-left: auto; }
        .item .sp-btn { min-height: 44px; }
        .action-bar { flex-direction: column-reverse; align-items: stretch; }
        .action-bar .sp-btn { width: 100%; justify-content: center; }
        .ops { flex-direction: column-reverse; align-items: stretch; }
        .ops .sp-btn { width: 100%; justify-content: center; min-height: 44px; }
      }
      @media (max-width: 480px) {
        .info-list > div { grid-template-columns: 1fr; gap: 2px; }
      }
    `,
  ],
})
export class OrderDetailPage {
  private readonly api = inject(OrdersApi);
  private readonly cart = inject(CartService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly order = signal<Order | null>(null);
  readonly orderId = signal('');
  readonly showSkeleton = signal(false);
  readonly error = signal<string | null>(null);
  readonly requestId = signal<string | undefined>(undefined);
  readonly notFound = signal(false);
  readonly busy = signal(false);
  readonly cancelOpen = signal(false);
  readonly cancelError = signal<string | null>(null);

  readonly reviewOpen = signal(false);
  readonly reviewTarget = signal<ReviewTarget | null>(null);

  readonly itemsTotal = computed(() => {
    const current = this.order();
    if (!current) {
      return 0;
    }
    return round2(current.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  });

  readonly shippingFee = computed(() => {
    const current = this.order();
    if (!current) {
      return 0;
    }
    const diff = round2(current.total - this.itemsTotal());
    return diff > 0.009 ? diff : 0;
  });

  readonly discount = computed(() => {
    const current = this.order();
    if (!current) {
      return 0;
    }
    const diff = round2(current.total - this.itemsTotal());
    return diff < -0.009 ? round2(-diff) : 0;
  });

  readonly statusHint = computed(() => {
    const current = this.order();
    if (!current) {
      return '';
    }
    switch (current.status) {
      case 'pending_payment':
        return '请在 24 小时内完成支付，超时订单将自动取消。';
      case 'pending_shipment':
        return '商家正在备货，预计 24 小时内发出，请留意物流通知。';
      case 'shipped':
        return '包裹已交给承运方，运单号 ' + this.trackingNo(current) + '。';
      case 'completed':
        return '订单已完成，感谢你的支持。';
      case 'cancelled':
        return '订单已关闭，如需帮助可联系客服。';
      default:
        return '';
    }
  });

  readonly steps = computed(() => {
    const current = this.order();
    const timeline = this.timelineOf(current);
    const alias: Record<string, string> = {
      created: 'pending_payment',
      paid: 'pending_shipment',
      payment: 'pending_shipment',
      shipped: 'shipped',
      delivered: 'completed',
      completed: 'completed',
    };
    return STEP_KEYS.map((step) => {
      const hit = timeline.find((entry) => {
        const mapped = alias[entry.status] ?? entry.status;
        return mapped === step.key || entry.label === step.label;
      });
      return { key: step.key, label: step.label, at: hit ? hit.at : '' };
    });
  });

  private reviewRequested = false;
  private seq = 0;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.orderId.set(params.get('id') ?? '');
      this.load();
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (params.get('review') === '1') {
        this.reviewRequested = true;
        this.maybeOpenReview();
      }
    });
  }

  load(): void {
    const id = this.orderId();
    if (!id) {
      this.notFound.set(true);
      return;
    }
    const seq = ++this.seq;
    this.error.set(null);
    this.requestId.set(undefined);
    this.notFound.set(false);
    this.showSkeleton.set(false);
    const timer = setTimeout(() => {
      if (seq === this.seq) {
        this.showSkeleton.set(true);
      }
    }, 300);

    // V05: request the order by URL id only — never compare ownerId or hide
    // orders that belong to another account.
    this.api.get(id).subscribe({
      next: (order) => {
        clearTimeout(timer);
        if (seq !== this.seq) {
          return;
        }
        this.showSkeleton.set(false);
        this.order.set(order);
        this.maybeOpenReview();
      },
      error: (err) => {
        clearTimeout(timer);
        if (seq !== this.seq) {
          return;
        }
        this.showSkeleton.set(false);
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        if (status === 404) {
          this.notFound.set(true);
          return;
        }
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
      },
    });
  }

  activeStep(status: string): number {
    return STATUS_INDEX[status] ?? 0;
  }

  itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  specOf(productId: number): string {
    return PRODUCT_META[productId]?.specs?.[0]?.value ?? '';
  }

  statusTitle(status: string): string {
    switch (status) {
      case 'pending_payment':
        return '等待付款';
      case 'pending_shipment':
        return '仓库备货中';
      case 'shipped':
        return '包裹运输中';
      case 'completed':
        return '订单已完成';
      case 'cancelled':
        return '订单已关闭';
      default:
        return '订单处理中';
    }
  }

  stepDescription(key: string): string {
    switch (key) {
      case 'pending_payment':
        return '提交订单';
      case 'pending_shipment':
        return '付款后备货';
      case 'shipped':
        return '交给承运方';
      case 'completed':
        return '签收完成';
      default:
        return '';
    }
  }

  etaLabel(order: Order): string {
    switch (order.status) {
      case 'pending_payment':
        return '付款后 48 小时内发出';
      case 'pending_shipment':
        return '预计 1–2 天内发出';
      case 'shipped':
        return '预计 1–2 天送达';
      case 'completed':
        return '已签收';
      case 'cancelled':
        return '—';
      default:
        return '待确认';
    }
  }

  logisticsEvents(order: Order): { label: string; at: string; on: boolean }[] {
    const created = order.createdAt;
    const paid = order.paidAt || created;
    const shipped = order.shippedAt || addDays(created, 1);
    const completed = order.completedAt || addDays(created, 3);
    const index = this.activeStep(order.status);
    return [
      { label: '订单已创建', at: created, on: true },
      { label: '支付成功', at: paid, on: order.status !== 'pending_payment' && order.status !== 'cancelled' && index >= 1 },
      { label: '包裹已揽收', at: shipped, on: index >= 2 && order.status !== 'cancelled' },
      { label: '已签收', at: completed, on: index >= 3 && order.status !== 'cancelled' },
    ];
  }

  recipient(order: Order): string {
    return order.address && order.address.recipient ? order.address.recipient : '—';
  }

  addressPhone(order: Order): string {
    return order.address ? order.address.phone || '—' : '—';
  }

  addressRegion(order: Order): string {
    return order.address ? order.address.region || '' : '';
  }

  addressDetail(order: Order): string {
    return order.address ? order.address.detail || '' : '';
  }

  paymentLabel(order: Order): string {
    const map: Record<string, string> = { wechat: '微信支付', alipay: '支付宝', card: '银行卡' };
    if (order.payment && map[order.payment]) {
      return map[order.payment];
    }
    return order.status === 'pending_payment' ? '待支付' : '微信支付（演示）';
  }

  copyOrderNo(order: Order): void {
    const text = String(order.id);
    if (!navigator.clipboard) {
      this.toast.show('订单号 ' + text, 'info');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => this.toast.show('订单号已复制'),
      () => this.toast.show('复制失败，请手动选择订单号', 'error'),
    );
  }

  scrollToLogistics(): void {
    document.getElementById('logistics')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  remindShipment(order: Order): void {
    this.toast.show('已提醒商家尽快发货（订单 #' + order.id + '）');
  }

  buyAgain(order: Order): void {
    if (this.busy() || order.items.length === 0) {
      return;
    }
    this.busy.set(true);
    forkJoin(order.items.map((item) => this.cart.add(item.productId, item.quantity, item.unitPrice))).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show('已加入购物车');
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  shippingLabel(value: string | undefined, slot?: string): string {
    if (!value) {
      return '标准配送';
    }
    const map: Record<string, string> = {
      standard: '标准配送',
      express: '次日达',
      next_day: '次日达',
      scheduled: '预约配送',
      pickup: '到店自提',
    };
    const label = map[value] ?? value;
    return value === 'scheduled' && slot ? label + ' · ' + slot : label;
  }

  invoiceLabel(value: string | undefined, title?: string): string {
    if (!value) {
      return '不开发票';
    }
    const map: Record<string, string> = {
      none: '不开发票',
      electronic: '电子普通发票',
      paper: '纸质发票',
      company: '电子普通发票（单位）',
      personal: '电子普通发票（个人）',
    };
    const label = map[value] ?? value;
    return value === 'personal' && title ? label + ' · ' + title : label;
  }

  trackingNo(order: Order): string {
    if (order.trackingNo) {
      return order.trackingNo;
    }
    if (order.status === 'shipped' || order.status === 'completed') {
      return 'SP' + String(order.id).padStart(8, '0') + 'DEMO';
    }
    return '待发货后生成';
  }

  logisticsStatus(order: Order): string {
    switch (order.status) {
      case 'shipped':
        return '运输中，预计 1–2 天送达';
      case 'completed':
        return '已签收';
      case 'cancelled':
        return '订单已取消';
      default:
        return '待发货';
    }
  }

  pay(order: Order): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.api.pay(order.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show('支付成功，等待发货');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  confirmReceipt(order: Order): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.api.confirm(order.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show('已确认收货');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  cancelOrder(order: Order): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.cancelError.set(null);
    this.api.cancel(order.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.cancelOpen.set(false);
        this.toast.show('订单已取消');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.cancelError.set(errorMessage(err));
      },
    });
  }

  openReview(item: OrderItem): void {
    this.reviewTarget.set({ productId: item.productId, title: item.title, image: item.image });
    this.reviewOpen.set(true);
  }

  openOrderReview(order: Order): void {
    const item = order.items[0];
    if (item) {
      this.openReview(item);
    }
  }

  onReviewed(): void {
    this.reviewOpen.set(false);
    this.load();
  }

  private maybeOpenReview(): void {
    if (!this.reviewRequested) {
      return;
    }
    const current = this.order();
    if (!current || current.status !== 'completed' || current.items.length === 0) {
      return;
    }
    this.reviewRequested = false;
    this.openOrderReview(current);
  }

  private timelineOf(order: Order | null): { status: string; label: string; at: string }[] {
    if (!order || !order.timeline) {
      return [];
    }
    return order.timeline.map((entry) => ({
      status: entry.status,
      label: entry.label,
      at: entry.at ?? '',
    }));
  }
}

function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  date.setDate(date.getDate() + days);
  return date.toISOString();
}