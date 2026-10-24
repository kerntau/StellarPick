import { ChangeDetectorRef, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AccountApi } from '../../core/api/account.api';
import { OrdersApi } from '../../core/api/orders.api';
import type { CreateOrderPayload } from '../../core/api/orders.api';
import { CartService } from '../../core/cart.service';
import { PRODUCT_META } from '../../core/catalog';
import { Address, CartItem, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { clearCartSelection, readCartSelection } from '../cart/cart-selection';
import { deliveryDay, deliveryWindow, readCheckoutExtras } from '../cart/cart-extras';
import { PaymentIconsComponent } from '../cart/components/payment-icons.component';

type ShippingMethod = 'standard' | 'next_day' | 'scheduled';
type InvoiceType = 'none' | 'personal';

interface ShippingOption {
  key: ShippingMethod;
  label: string;
  hint: string;
  badge: string;
  icon: string;
}

interface AddressDraft {
  name: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
}

interface AddressErrors {
  name?: string;
  phone?: string;
  region?: string;
  detail?: string;
}

interface PlacedOrder {
  id: number;
  total: number;
  recipient: string;
  count: number;
}

const FALLBACK_IMAGE = '/assets/sp/img/products/1001.svg';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [
    RouterLink,
    MoneyPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    ModalComponent,
    SkeletonComponent,
    PaymentIconsComponent,
  ],
  template: `
    <div class="sp-container checkout-page">
      <nav class="crumbs" aria-label="面包屑">
        <a routerLink="/">首页</a>
        <span class="crumb-sep" aria-hidden="true">/</span>
        <a routerLink="/cart">购物车</a>
        <span class="crumb-sep" aria-hidden="true">/</span>
        <span aria-current="page">结算</span>
      </nav>

      <ol class="sp-steps" aria-label="购物流程">
        <li class="done"><span class="dot" aria-hidden="true">✓</span>购物车</li>
        <li
          [class.on]="!successOrder()"
          [class.done]="!!successOrder()"
          [attr.aria-current]="successOrder() ? null : 'step'"
        >
          <span class="dot" aria-hidden="true">{{ successOrder() ? '✓' : '2' }}</span>结算
        </li>
        <li [class.on]="!!successOrder()" [attr.aria-current]="successOrder() ? 'step' : null">
          <span class="dot" aria-hidden="true">3</span>完成
        </li>
      </ol>

      @if (successOrder(); as order) {
        <div class="success-wrap">
          <section class="sp-card success-card" aria-labelledby="checkout-success-title">
            <span class="success-icon" aria-hidden="true"><app-icon name="check" [size]="30" /></span>
            <span class="sp-eyebrow">ORDER CONFIRMED · 下单成功</span>
            <h1 id="checkout-success-title">订单提交成功</h1>
            <p class="success-lead">我们已收到你的订单，请尽快完成支付，仓库会按付款顺序安排发货。</p>

            <ol class="success-steps" aria-label="订单进度">
              <li class="on"><span class="step-dot">1</span><strong>订单已提交</strong><small>刚刚</small></li>
              <li><span class="step-dot">2</span><strong>仓库备货</strong><small>预计 24 小时内</small></li>
              <li><span class="step-dot">3</span><strong>等待发货</strong><small>{{ deliveryStandard() }}</small></li>
            </ol>

            <dl class="success-meta">
              <div><dt>订单号</dt><dd class="sp-num">{{ order.id }}</dd></div>
              <div><dt>应付金额</dt><dd class="amount sp-num">{{ order.total | spMoney }}</dd></div>
              <div><dt>收货人</dt><dd>{{ order.recipient }}</dd></div>
              <div><dt>商品件数</dt><dd>{{ order.count }} 件</dd></div>
            </dl>

            <div class="success-pay">
              <span class="success-pay-label">支付方式</span>
              <app-payment-icons [compact]="true" />
            </div>

            <div class="success-actions">
              <a class="sp-btn sp-btn--primary" [routerLink]="['/account/orders', order.id]">查看订单</a>
              <a class="sp-btn sp-btn--secondary" routerLink="/category/all">继续购物</a>
            </div>

            <ul class="trust-row trust-row--success">
              <li><app-icon name="shield" [size]="15" /> 正品保障</li>
              <li><app-icon name="refresh" [size]="15" /> 7 天无理由</li>
              <li><app-icon name="headset" [size]="15" /> 客服在线</li>
            </ul>
            <p class="sp-text-12 sp-muted success-note">订单状态与物流信息可在「我的订单」中查看。</p>
          </section>
        </div>
      } @else {
        <header class="sp-page-head">
          <div>
            <span class="sp-eyebrow">SECURE CHECKOUT · 安全结算</span>
            <h1>确认订单</h1>
            <p>核对收货信息与商品清单，提交后我们立即为你备货。</p>
          </div>
          <div class="head-side">
            <span class="secure-note"><app-icon name="lock" [size]="14" /> 支付信息加密传输</span>
            <a class="sp-btn sp-btn--ghost" routerLink="/cart">
              <app-icon name="chevron-left" [size]="16" /> 返回购物车
            </a>
          </div>
        </header>

        @if (loading()) {
          @if (showSkeleton()) {
            <div class="checkout-layout" aria-busy="true" aria-label="正在加载结算信息">
              <div class="checkout-main">
                <div class="sp-card sp-card--pad"><app-skeleton variant="line" width="35%" /><div class="sp-mt-4"><app-skeleton variant="line" /></div></div>
                <div class="sp-card sp-card--pad"><app-skeleton variant="line" width="28%" /><div class="sp-mt-4"><app-skeleton variant="line" /></div></div>
                <div class="sp-card sp-card--pad"><app-skeleton variant="line" width="45%" /><div class="sp-mt-4"><app-skeleton variant="line" /></div></div>
              </div>
              <div class="checkout-aside">
                <div class="sp-card sp-card--pad"><app-skeleton variant="line" width="55%" /><div class="sp-mt-4"><app-skeleton variant="line" /></div><div class="sp-mt-3"><app-skeleton variant="line" width="75%" /></div></div>
              </div>
            </div>
          } @else {
            <div class="load-hold" aria-busy="true"></div>
          }
        } @else if (loadError()) {
          <app-error-state [message]="loadError()" [requestId]="requestId()" (retry)="loadAll()" />
        } @else if (cart.items().length === 0) {
          <section class="sp-card sp-card--pad">
            <app-empty-state
              image="cart"
              title="购物车是空的"
              description="先挑几件商品，再回来完成结算。"
              actionLabel="去逛逛"
              (action)="goShopping()"
            />
          </section>
        } @else {
          <div class="checkout-layout">
            <div class="checkout-main">
              <section class="sp-card sp-card--pad" aria-labelledby="checkout-address-title">
                <div class="section-head">
                  <div class="section-title">
                    <span class="section-index" aria-hidden="true">01</span>
                    <div>
                      <h2 id="checkout-address-title">收货地址</h2>
                      <p class="sp-text-13 sp-secondary">请选择本次订单的收货地址，默认地址已为你高亮。</p>
                    </div>
                  </div>
                  <div class="head-actions">
                    <a class="sp-link sp-text-13" routerLink="/account/addresses">管理地址</a>
                    <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="openAddressModal()">新增地址</button>
                  </div>
                </div>

                @if (addresses().length === 0) {
                  <div class="addr-empty">
                    <app-icon name="map-pin" [size]="28" />
                    <div class="sp-grow">
                      <strong>还没有收货地址</strong>
                      <p class="sp-text-13 sp-secondary">添加一个收货地址，我们才能为你安排配送。</p>
                    </div>
                    <button class="sp-btn sp-btn--primary sp-btn--sm" type="button" (click)="openAddressModal()">新增收货地址</button>
                  </div>
                } @else {
                  <fieldset class="addr-group">
                    <legend class="sp-sr-only">选择收货地址</legend>
                    @for (address of addresses(); track address.id) {
                      <div class="addr-card" [class.is-selected]="selectedAddressId() === address.id" [class.is-default]="address.isDefault">
                        <label class="addr-pick">
                          <input
                            type="radio"
                            name="checkout-address"
                            [value]="address.id"
                            [checked]="selectedAddressId() === address.id"
                            (change)="selectAddress(address.id)"
                          />
                          <span class="addr-body">
                            <span class="addr-top">
                              <strong>{{ address.name }}</strong>
                              <span class="sp-num phone">{{ maskPhone(address.phone) }}</span>
                              @if (address.isDefault) {
                                <span class="sp-badge sp-badge--accent">默认</span>
                              }
                            </span>
                            <span class="addr-text">{{ address.region }} {{ address.detail }}</span>
                            <span class="addr-tags">
                              <span class="addr-tag"><app-icon name="truck" [size]="12" /> 配送至</span>
                              <span>预计 {{ deliveryStandard() }} 送达</span>
                            </span>
                          </span>
                        </label>
                        <a class="addr-edit" routerLink="/account/addresses" [attr.aria-label]="'编辑 ' + address.name + ' 的收货地址'">编辑</a>
                      </div>
                    }
                    <button class="addr-add" type="button" (click)="openAddressModal()">
                      <span class="addr-add-icon" aria-hidden="true"><app-icon name="plus" [size]="18" /></span>
                      <span class="addr-add-text"><strong>新增收货地址</strong><small>配送到新的地址</small></span>
                    </button>
                  </fieldset>
                }
              </section>

              <section class="sp-card sp-card--pad" aria-labelledby="checkout-shipping-title">
                <div class="section-head">
                  <div class="section-title">
                    <span class="section-index" aria-hidden="true">02</span>
                    <div>
                      <h2 id="checkout-shipping-title">配送方式</h2>
                      <p class="sp-text-13 sp-secondary">会员订单免运费，具体送达时间以物流信息为准。</p>
                    </div>
                  </div>
                  <span class="head-note">预计 {{ deliveryStandard() }} 送达</span>
                </div>

                <fieldset class="option-group shipping-group">
                  <legend class="sp-sr-only">选择配送方式</legend>
                  @for (option of shippingOptions(); track option.key) {
                    <label class="option" [class.is-selected]="shipping() === option.key">
                      <input type="radio" name="checkout-shipping" [value]="option.key" [checked]="shipping() === option.key" (change)="shipping.set(option.key)" />
                      <span class="option-icon" aria-hidden="true"><app-icon [name]="option.icon" [size]="18" /></span>
                      <span class="option-body">
                        <strong>{{ option.label }}</strong>
                        <small>{{ option.hint }}</small>
                      </span>
                      <span class="sp-badge" [class.sp-badge--success]="option.badge === '免运费'" [class.sp-badge--accent]="option.badge !== '免运费'">{{ option.badge }}</span>
                    </label>
                  }
                </fieldset>

                @if (shipping() === 'scheduled') {
                  <div class="schedule-row">
                    <div class="sp-field schedule-field">
                      <label class="sp-label" for="schedule-slot">预约时段</label>
                      <select id="schedule-slot" class="sp-select" [value]="scheduleSlot()" (change)="onSchedule($event)">
                        @for (slot of scheduleSlots; track slot) {
                          <option [value]="slot">{{ slot }}</option>
                        }
                      </select>
                    </div>
                    <p class="sp-hint schedule-hint"><app-icon name="clock" [size]="14" /> 配送员会在时段开始前 30 分钟电话联系。</p>
                  </div>
                }
              </section>

              <section class="sp-card sp-card--pad" aria-labelledby="checkout-payment-title">
                <div class="section-head">
                  <div class="section-title">
                    <span class="section-index" aria-hidden="true">03</span>
                    <div>
                      <h2 id="checkout-payment-title">支付方式</h2>
                      <p class="sp-text-13 sp-secondary">选择习惯的支付方式，提交订单后完成付款。</p>
                    </div>
                  </div>
                  <span class="sp-badge sp-badge--success"><app-icon name="shield" [size]="12" /> 安全支付</span>
                </div>

                <app-payment-icons [selectable]="true" [selected]="payment()" (select)="payment.set($event)" />
                <p class="payment-note">
                  <app-icon name="info" [size]="14" />
                  支付方式仅用于页面展示，本页不会发起扣款；请在订单详情中完成支付。
                </p>
              </section>

              <section class="sp-card sp-card--pad" aria-labelledby="checkout-invoice-title">
                <div class="section-head">
                  <div class="section-title">
                    <span class="section-index" aria-hidden="true">04</span>
                    <div>
                      <h2 id="checkout-invoice-title">发票</h2>
                      <p class="sp-text-13 sp-secondary">电子发票开具后将发送至账户邮箱。</p>
                    </div>
                  </div>
                </div>

                <fieldset class="option-group">
                  <legend class="sp-sr-only">选择发票类型</legend>
                  <label class="option" [class.is-selected]="invoice() === 'none'">
                    <input type="radio" name="checkout-invoice" value="none" [checked]="invoice() === 'none'" (change)="invoice.set('none')" />
                    <span class="option-icon" aria-hidden="true"><app-icon name="file-text" [size]="18" /></span>
                    <span class="option-body">
                      <strong>不开票</strong>
                      <small>本次订单不需要发票</small>
                    </span>
                  </label>
                  <label class="option" [class.is-selected]="invoice() === 'personal'">
                    <input type="radio" name="checkout-invoice" value="personal" [checked]="invoice() === 'personal'" (change)="invoice.set('personal')" />
                    <span class="option-icon" aria-hidden="true"><app-icon name="file-text" [size]="18" /></span>
                    <span class="option-body">
                      <strong>电子普通发票</strong>
                      <small>个人抬头，订单完成后开具</small>
                    </span>
                  </label>
                </fieldset>

                @if (invoice() === 'personal') {
                  <div class="invoice-extra">
                    <div class="sp-field">
                      <label class="sp-label" for="invoice-title">发票抬头</label>
                      <input
                        id="invoice-title"
                        class="sp-input"
                        type="text"
                        maxlength="50"
                        placeholder="个人 / 单位名称"
                        [value]="invoiceTitle()"
                        (input)="onInvoiceTitle($event)"
                      />
                    </div>
                    <p class="sp-hint">抬头将显示在电子发票上，可稍后在订单详情中修改。</p>
                  </div>
                }
              </section>

              <section class="sp-card sp-card--pad" aria-labelledby="checkout-items-title">
                <div class="section-head">
                  <div class="section-title">
                    <span class="section-index" aria-hidden="true">05</span>
                    <div>
                      <h2 id="checkout-items-title">商品清单</h2>
                      <p class="sp-text-13 sp-secondary">共 {{ count() }} 件商品，单价以购物车记录为准。</p>
                    </div>
                  </div>
                  <a class="sp-link sp-text-13" routerLink="/cart">修改</a>
                </div>

                @if (gift()) {
                  <div class="gift-note">
                    <app-icon name="gift" [size]="16" />
                    <span>赠言卡片：{{ gift() }}</span>
                    <a class="sp-link sp-text-12" routerLink="/cart">修改</a>
                  </div>
                }

                <div class="order-lines">
                  @for (item of lines(); track item.id) {
                    <div class="order-line">
                      <a class="ol-thumb" [routerLink]="['/product', item.productId]" tabindex="-1" aria-hidden="true">
                        <img [src]="item.image" alt="" width="72" height="72" loading="lazy" (error)="onImageError($event)" />
                      </a>
                      <div class="ol-info">
                        <a class="ol-title sp-clamp-2" [routerLink]="['/product', item.productId]">{{ item.title }}</a>
                        <p class="ol-meta sp-text-12 sp-muted">
                          @if (specOf(item.productId)) {
                            <span class="ol-spec">{{ specOf(item.productId) }}</span>
                          }
                          <span class="member-chip">会员价</span>
                          <span class="ol-price-qty">
                            <span class="sp-num">{{ item.unitPrice | spMoney }}</span>
                            <span aria-hidden="true">×</span> {{ item.quantity }}
                          </span>
                        </p>
                        <p class="ol-stock sp-text-12"><span class="stock-dot" aria-hidden="true"></span> 现货 · 48 小时内发出</p>
                      </div>
                      <span class="ol-sub sp-num">{{ item.unitPrice * item.quantity | spMoney }}</span>
                    </div>
                  }
                </div>
              </section>

              <ul class="trust-row trust-row--wide" aria-label="购物保障">
                <li><app-icon name="shield" [size]="18" /><div><strong>正品保障</strong><small>品牌直供 · 假一赔十</small></div></li>
                <li><app-icon name="refresh" [size]="18" /><div><strong>7 天无理由</strong><small>签收后 7 天内可退</small></div></li>
                <li><app-icon name="headset" [size]="18" /><div><strong>客服在线</strong><small>9:00–21:00 真人服务</small></div></li>
                <li><app-icon name="truck" [size]="18" /><div><strong>极速发货</strong><small>48 小时内出库</small></div></li>
              </ul>
            </div>

            <aside class="checkout-aside">
              <div class="sp-summary">
                <div class="summary-head">
                  <h2>订单摘要</h2>
                  <span class="summary-count">{{ count() }} 件</span>
                </div>

                @if (summaryThumbs().length > 0) {
                  <div class="summary-thumbs" aria-label="商品缩略图">
                    @for (item of summaryThumbs(); track item.id) {
                      <img [src]="item.image" [alt]="item.title" width="42" height="42" loading="lazy" (error)="onImageError($event)" />
                    }
                    @if (summaryMore() > 0) {
                      <span class="thumb-more">+{{ summaryMore() }}</span>
                    }
                  </div>
                }

                <dl>
                  <div><dt>商品件数</dt><dd>{{ count() }} 件</dd></div>
                  <div><dt>商品金额</dt><dd>{{ merchandise() | spMoney }}</dd></div>
                  <div><dt>运费</dt><dd class="free">免运费</dd></div>
                  <div><dt>配送方式</dt><dd>{{ shippingLabel() }}</dd></div>
                  <div><dt>发票</dt><dd>{{ invoiceLabel() }}</dd></div>
                  <div><dt>支付方式</dt><dd>{{ paymentLabel() }}</dd></div>
                  <div class="total"><dt>应付合计</dt><dd>{{ total() | spMoney }}</dd></div>
                </dl>

                @if (submitError()) {
                  <div id="checkout-submit-error" class="sp-alert sp-alert--error submit-error" role="alert" tabindex="-1">
                    <app-icon name="alert-circle" [size]="18" />
                    <span>{{ submitError() }}</span>
                  </div>
                }

                @if (selectedAddressId() === null) {
                  <p class="addr-warn sp-text-12">
                    <app-icon name="alert-circle" [size]="14" /> 请先选择或新增收货地址
                  </p>
                }

                <button
                  class="sp-btn sp-btn--accent sp-btn--lg sp-btn--block submit"
                  type="button"
                  [disabled]="!canSubmit()"
                  [attr.aria-busy]="submitting()"
                  (click)="submit()"
                >
                  @if (submitting()) {
                    <span class="spinner" aria-hidden="true"></span> 提交中，请勿重复点击
                  } @else {
                    <app-icon name="lock" [size]="16" /> 提交订单
                  }
                </button>

                <p class="submit-note"><app-icon name="clock" [size]="13" /> 提交后请在 15 分钟内完成支付，超时库存将释放。</p>

                <ul class="trust-row">
                  <li><app-icon name="shield" [size]="15" /> 正品保障</li>
                  <li><app-icon name="refresh" [size]="15" /> 7 天无理由</li>
                  <li><app-icon name="headset" [size]="15" /> 客服在线</li>
                </ul>

                <p class="sp-text-12 sp-muted summary-note">
                  提交订单即表示同意 <a class="sp-link" routerLink="/terms">《服务条款》</a> 与
                  <a class="sp-link" routerLink="/privacy">《隐私政策》</a>。
                </p>
                <a class="sp-link sp-text-13 back-cart" routerLink="/cart">返回购物车修改</a>
              </div>
            </aside>
          </div>
        }
      }
    </div>

    <app-modal [open]="addressModalOpen()" title="新增收货地址" (closed)="closeAddressModal()">
      <form class="addr-form" (submit)="$event.preventDefault(); saveAddress()" novalidate>
        @if (addressError()) {
          <div id="address-form-error" class="sp-alert sp-alert--error" role="alert" tabindex="-1">
            <app-icon name="alert-circle" [size]="18" />
            <span>{{ addressError() }}</span>
          </div>
        }

        <div class="addr-form-grid">
          <div class="sp-field">
            <label class="sp-label" for="addr-name">收件人<span class="sp-req">*</span></label>
            <input
              id="addr-name"
              class="sp-input"
              type="text"
              name="name"
              autocomplete="name"
              [value]="draft().name"
              (input)="setDraftText('name', $event)"
              [attr.aria-invalid]="draftErrors().name ? 'true' : null"
              [attr.aria-describedby]="draftErrors().name ? 'addr-name-error' : null"
              aria-required="true"
            />
            @if (draftErrors().name) { <p class="sp-error" id="addr-name-error">{{ draftErrors().name }}</p> }
          </div>

          <div class="sp-field">
            <label class="sp-label" for="addr-phone">手机号<span class="sp-req">*</span></label>
            <input
              id="addr-phone"
              class="sp-input"
              type="tel"
              name="phone"
              inputmode="tel"
              autocomplete="tel"
              [value]="draft().phone"
              (input)="setDraftText('phone', $event)"
              [attr.aria-invalid]="draftErrors().phone ? 'true' : null"
              [attr.aria-describedby]="draftErrors().phone ? 'addr-phone-error' : null"
              aria-required="true"
            />
            @if (draftErrors().phone) { <p class="sp-error" id="addr-phone-error">{{ draftErrors().phone }}</p> }
          </div>
        </div>

        <div class="sp-field">
          <label class="sp-label" for="addr-region">省 / 市 / 区<span class="sp-req">*</span></label>
          <input
            id="addr-region"
            class="sp-input"
            type="text"
            name="region"
            placeholder="例如：上海市 / 上海市 / 星澜区"
            [value]="draft().region"
            (input)="setDraftText('region', $event)"
            [attr.aria-invalid]="draftErrors().region ? 'true' : null"
            [attr.aria-describedby]="draftErrors().region ? 'addr-region-error' : null"
            aria-required="true"
          />
          @if (draftErrors().region) { <p class="sp-error" id="addr-region-error">{{ draftErrors().region }}</p> }
        </div>

        <div class="sp-field">
          <label class="sp-label" for="addr-detail">详细地址<span class="sp-req">*</span></label>
          <textarea
            id="addr-detail"
            class="sp-textarea"
            name="detail"
            rows="3"
            placeholder="街道、门牌号、楼栋与房间号"
            [value]="draft().detail"
            (input)="setDraftText('detail', $event)"
            [attr.aria-invalid]="draftErrors().detail ? 'true' : null"
            [attr.aria-describedby]="draftErrors().detail ? 'addr-detail-error' : null"
            aria-required="true"
          ></textarea>
          @if (draftErrors().detail) { <p class="sp-error" id="addr-detail-error">{{ draftErrors().detail }}</p> }
        </div>

        <label class="sp-check default-check">
          <input type="checkbox" [checked]="draft().isDefault" (change)="setDefault($event)" />
          设为默认收货地址
        </label>
        <p class="sp-hint form-hint">地址仅用于本次配送，我们不会用于其他用途。</p>

        <div class="modal-actions">
          <button class="sp-btn sp-btn--secondary" type="button" (click)="closeAddressModal()">取消</button>
          <button class="sp-btn sp-btn--primary" type="submit" [disabled]="savingAddress()" [attr.aria-busy]="savingAddress()">
            @if (savingAddress()) { 保存中… } @else { 保存地址 }
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: [`
    .checkout-page {
      padding-bottom: 48px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E");
      background-size: 160px 160px;
    }
    .crumbs { display: flex; align-items: center; gap: 8px; padding-top: 16px; font-size: 12px; color: var(--sp-text-muted); }
    .crumbs a { color: var(--sp-text-secondary); min-height: 32px; display: inline-flex; align-items: center; }
    .crumbs a:hover { color: var(--sp-primary); }
    .crumb-sep { color: var(--sp-border-strong); }
    .sp-eyebrow {
      display: block;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: .18em;
      color: var(--sp-text-muted);
      margin-bottom: 4px;
    }
    .sp-steps li { white-space: nowrap; }
    .sp-steps li.done .dot { background: var(--sp-success-soft); border-color: #BDE0D2; color: var(--sp-success); }
    .sp-page-head { align-items: flex-end; padding-top: 8px; }
    .sp-page-head h1 { font-family: var(--sp-serif); font-size: 36px; letter-spacing: .02em; }
    .head-side { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .secure-note { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--sp-sage); }
    .head-side .sp-btn { min-height: 44px; }

    .checkout-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 24px;
      align-items: start;
      margin-top: 8px;
    }
    .checkout-main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
    .checkout-aside { position: sticky; top: calc(var(--sp-header-h) + 16px); min-width: 0; }
    .load-hold { min-height: 360px; }
    .section-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .section-title { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
    .section-index {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      margin-top: 1px;
      border-radius: 50%;
      border: 1px solid var(--sp-border-strong);
      background: var(--sp-bg);
      color: var(--sp-text-muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .02em;
    }
    .section-head h2 { font-size: 18px; }
    .section-head p { margin-top: 2px; }
    .head-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .head-actions .sp-btn, .addr-empty .sp-btn { min-height: 44px; }
    .head-actions .sp-link { display: inline-flex; align-items: center; min-height: 44px; }
    .head-note { font-size: 12px; color: var(--sp-text-muted); white-space: nowrap; }

    .addr-group, .option-group {
      border: 0;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .addr-card {
      position: relative;
      border: 1px solid var(--sp-border);
      border-radius: 8px;
      background: var(--sp-surface);
      min-width: 0;
      transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
    }
    .addr-card:hover { border-color: var(--sp-border-strong); }
    .addr-card.is-default { background: #FFFBF3; border-color: #F3D9AE; }
    .addr-card.is-selected { border-color: var(--sp-primary); background: #F7F9FC; box-shadow: 0 0 0 2px rgba(11, 37, 69, .12); }
    .addr-pick {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px 16px;
      cursor: pointer;
      min-height: 108px;
    }
    .addr-pick input { width: 16px; height: 16px; margin-top: 3px; accent-color: var(--sp-primary); flex: 0 0 auto; }
    .addr-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding-right: 34px; }
    .addr-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .addr-top strong { font-size: 14px; }
    .phone { font-size: 13px; color: var(--sp-text-secondary); }
    .addr-text { color: var(--sp-text-secondary); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
    .addr-tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; font-size: 11px; color: var(--sp-text-muted); }
    .addr-tag { display: inline-flex; align-items: center; gap: 3px; color: var(--sp-sage); }
    .addr-edit {
      position: absolute;
      top: 8px;
      right: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      font-size: 12px;
      font-weight: 600;
      color: var(--sp-info);
    }
    .addr-edit:hover { text-decoration: underline; }
    .addr-add {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 108px;
      padding: 14px 16px;
      border: 1px dashed var(--sp-border-strong);
      border-radius: 8px;
      background: transparent;
      color: var(--sp-text-secondary);
      text-align: left;
    }
    .addr-add:hover { border-color: var(--sp-primary); background: #FCFAF6; color: var(--sp-primary); }
    .addr-add-icon {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--sp-bg);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }
    .addr-add-text { display: flex; flex-direction: column; gap: 1px; }
    .addr-add-text strong { font-size: 13px; }
    .addr-add-text small { font-size: 11px; color: var(--sp-text-muted); }
    .addr-empty {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      padding: 20px;
      border: 1px dashed var(--sp-border-strong);
      border-radius: 8px;
      background: var(--sp-bg);
    }
    .addr-empty app-icon { color: var(--sp-text-muted); }
    .addr-empty .sp-btn { margin-left: auto; }

    .option {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px 16px;
      border: 1px solid var(--sp-border);
      border-radius: 8px;
      background: var(--sp-surface);
      cursor: pointer;
      flex-wrap: nowrap;
      min-width: 0;
    }
    .option:hover { border-color: var(--sp-border-strong); }
    .option.is-selected { border-color: var(--sp-primary); background: #F7F9FC; box-shadow: 0 0 0 2px rgba(11, 37, 69, .08); }
    .option input { width: 16px; height: 16px; margin-top: 3px; accent-color: var(--sp-primary); flex: 0 0 auto; }
    .option-icon { width: 28px; height: 28px; color: var(--sp-accent-text); display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
    .option-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto; }
    .option-body strong { font-size: 14px; }
    .option-body small { color: var(--sp-text-muted); font-size: 12px; }
    .option .sp-badge { margin-left: auto; flex: 0 0 auto; align-self: center; }
    .shipping-group .option { min-height: 82px; }
    @media (min-width: 641px) {
      .shipping-group .option:last-child { grid-column: 1 / -1; }
    }
    .schedule-row {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
      margin-top: 12px;
      padding: 14px 16px;
      border: 1px dashed var(--sp-border-strong);
      border-radius: 8px;
      background: #FFFDF8;
    }
    .schedule-field { margin-bottom: 0; min-width: 220px; flex: 0 1 280px; }
    .schedule-field .sp-select { min-height: 44px; }
    .schedule-hint { display: inline-flex; align-items: center; gap: 4px; padding-bottom: 8px; }

    .payment-note {
      display: flex;
      align-items: flex-start;
      gap: 5px;
      margin-top: 10px;
      font-size: 11.5px;
      color: var(--sp-text-muted);
      line-height: 1.5;
    }
    .payment-note app-icon { flex: 0 0 auto; margin-top: 1px; }
    .invoice-extra { margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--sp-border); }
    .invoice-extra .sp-field { margin-bottom: 6px; max-width: 360px; }

    .gift-note {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #FFFBF3;
      border: 1px solid #F3E3C4;
      font-size: 12.5px;
      color: var(--sp-text-secondary);
    }
    .gift-note app-icon { color: var(--sp-accent-text); flex: 0 0 auto; }
    .gift-note .sp-link { margin-left: auto; }

    .order-lines { display: flex; flex-direction: column; }
    .order-line {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px solid var(--sp-border);
    }
    .order-line:last-child { border-bottom: 0; }
    .ol-thumb { display: block; width: 72px; height: 72px; border-radius: 6px; overflow: hidden; border: 1px solid var(--sp-border); background: #F1EEE8; }
    .ol-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .ol-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .ol-title { font-size: 14px; font-weight: 600; line-height: 1.45; }
    .ol-title:hover { color: var(--sp-accent-text); }
    .ol-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .ol-spec { padding: 0 5px; border: 1px solid var(--sp-border); border-radius: 3px; background: var(--sp-bg); color: var(--sp-text-secondary); }
    .member-chip { padding: 0 5px; border-radius: 2px; background: #FBF0DC; color: var(--sp-accent-text); font-size: 10.5px; font-weight: 700; }
    .ol-price-qty { display: inline-flex; align-items: baseline; gap: 3px; white-space: nowrap; }
    .ol-stock { display: flex; align-items: center; gap: 4px; color: var(--sp-success); }
    .stock-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
    .ol-sub { font-size: 15px; font-weight: 700; color: var(--sp-accent-text); text-align: right; white-space: nowrap; }

    .trust-row.trust-row--wide {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 0;
      padding: 16px 20px;
      border: 1px solid var(--sp-border);
      border-radius: 8px;
      background: #FFFDF8;
      list-style: none;
    }
    .trust-row.trust-row--wide li { display: flex; align-items: flex-start; gap: 8px; min-width: 0; white-space: normal; }
    .trust-row.trust-row--wide app-icon { color: var(--sp-sage); flex: 0 0 auto; margin-top: 1px; }
    .trust-row.trust-row--wide div { display: flex; flex-direction: column; gap: 0; min-width: 0; }
    .trust-row.trust-row--wide strong { font-size: 12.5px; }
    .trust-row.trust-row--wide small { font-size: 11px; color: var(--sp-text-muted); line-height: 1.4; white-space: normal; }

    .sp-summary { padding: 20px; }
    .summary-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .sp-summary h2 { font-size: 18px; margin-bottom: 10px; }
    .summary-count { font-size: 12px; color: var(--sp-text-muted); }
    .summary-thumbs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-bottom: 14px; margin-bottom: 4px; border-bottom: 1px solid var(--sp-border); }
    .summary-thumbs img { width: 42px; height: 42px; border-radius: 5px; object-fit: cover; border: 1px solid var(--sp-border); background: var(--sp-bg); }
    .thumb-more { font-size: 11px; color: var(--sp-text-muted); }
    .sp-summary .free { color: var(--sp-success); font-weight: 600; }
    .submit-error { margin-top: 12px; align-items: center; }
    .addr-warn { color: var(--sp-danger); display: flex; align-items: center; gap: 4px; margin-top: 12px; }
    .submit { margin-top: 16px; }
    .submit-note { display: flex; align-items: flex-start; gap: 4px; margin-top: 8px; font-size: 11px; color: var(--sp-text-muted); line-height: 1.5; }
    .submit-note app-icon { flex: 0 0 auto; margin-top: 1px; }
    .trust-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      margin: 14px 0 0;
      padding: 10px 0;
      border-top: 1px dashed var(--sp-border);
      border-bottom: 1px dashed var(--sp-border);
      list-style: none;
    }
    .trust-row li { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; color: var(--sp-text-secondary); white-space: nowrap; }
    .trust-row app-icon { color: var(--sp-sage); }
    .summary-note { margin-top: 12px; line-height: 1.5; }
    .back-cart { display: inline-block; margin-top: 10px; }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(11, 37, 69, .25);
      border-top-color: var(--sp-primary);
      border-radius: 50%;
      animation: checkout-spin .8s linear infinite;
    }
    @keyframes checkout-spin { to { transform: rotate(360deg); } }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
    .modal-actions .sp-btn { min-height: 44px; }
    .sp-page-head .sp-btn { min-height: 44px; }
    a.sp-btn { color: var(--sp-primary); }
    a.sp-btn--primary { color: #fff; }
    a.sp-link { color: var(--sp-info); }
    .addr-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
    .addr-form .sp-alert { margin-bottom: 16px; align-items: center; }
    .default-check { margin: 4px 0 0; min-height: 32px; }
    .form-hint { margin-top: 6px; }

    .success-wrap { max-width: 760px; margin: 8px auto 0; }
    .success-card { padding: 40px 36px; text-align: center; }
    .success-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 14px;
      border-radius: 50%;
      background: var(--sp-success-soft);
      color: var(--sp-success);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .success-card h1 { font-family: var(--sp-serif); font-size: 28px; }
    .success-lead { color: var(--sp-text-secondary); margin-top: 8px; }
    .success-steps {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
      margin: 26px 0 0;
      padding: 0;
      list-style: none;
      counter-reset: step;
    }
    .success-steps li { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 0 8px; }
    .success-steps li::before { content: ''; position: absolute; top: 13px; left: -50%; width: 100%; height: 1px; background: var(--sp-border); }
    .success-steps li:first-child::before { display: none; }
    .success-steps .step-dot {
      width: 27px;
      height: 27px;
      border-radius: 50%;
      border: 1px solid var(--sp-border-strong);
      background: var(--sp-surface);
      color: var(--sp-text-muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      position: relative;
      z-index: 1;
    }
    .success-steps li.on .step-dot { background: var(--sp-primary); border-color: var(--sp-primary); color: #fff; }
    .success-steps strong { font-size: 12.5px; }
    .success-steps small { font-size: 11px; color: var(--sp-text-muted); }
    .success-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 28px 0 0;
      text-align: left;
    }
    .success-meta > div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 16px;
      border-radius: 8px;
      background: var(--sp-bg);
      border: 1px solid var(--sp-border);
    }
    .success-meta dt { font-size: 12px; color: var(--sp-text-secondary); }
    .success-meta dd { margin: 0; font-size: 16px; font-weight: 700; }
    .success-meta .amount { color: var(--sp-accent-text); font-size: 20px; }
    .success-pay { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 18px; }
    .success-pay-label { font-size: 11px; color: var(--sp-text-muted); }
    .success-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
    .success-actions .sp-btn { min-height: 44px; }
    .trust-row.trust-row--success { justify-content: center; gap: 20px; border-bottom: 0; margin-top: 22px; }
    .success-note { margin-top: 6px; }

    @media (max-width: 1180px) {
      .checkout-layout { grid-template-columns: minmax(0, 1fr) 330px; }
    }
    @media (max-width: 1023px) {
      .checkout-layout { grid-template-columns: 1fr; gap: 16px; }
      .checkout-aside { position: static; }
      .trust-row.trust-row--wide { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .addr-group, .option-group { grid-template-columns: 1fr; }
      .addr-form-grid { grid-template-columns: 1fr; }
      .head-actions { width: 100%; justify-content: space-between; }
      .head-side { align-items: flex-start; }
      .sp-page-head h1 { font-size: 30px; }
      .success-card { padding: 32px 20px; }
      .success-meta { grid-template-columns: 1fr; gap: 8px; margin-top: 20px; }
      .trust-row.trust-row--wide { grid-template-columns: 1fr; }
      .success-steps strong { font-size: 11.5px; }
      .success-steps small { display: none; }
      .schedule-row { flex-direction: column; align-items: stretch; }
      .schedule-field { flex: 1 1 auto; }
    }
    @media (max-width: 480px) {
      .sp-steps { gap: 4px; }
      .sp-steps li { gap: 6px; }
      .sp-steps li::after { width: 20px; margin-left: 4px; }
      .order-line { grid-template-columns: 56px minmax(0, 1fr) auto; gap: 10px; }
      .ol-thumb { width: 56px; height: 56px; }
      .ol-sub { font-size: 14px; }
      .success-actions { flex-direction: column; }
      .success-actions .sp-btn { width: 100%; }
    }
  `],
})
export class CheckoutPage implements OnInit, OnDestroy {
  readonly cart = inject(CartService);
  private readonly account = inject(AccountApi);
  private readonly orders = inject(OrdersApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly extras = readCheckoutExtras();

  readonly loading = signal(true);
  readonly showSkeleton = signal(false);
  readonly loadError = signal('');
  readonly requestId = signal<string | undefined>(undefined);

  readonly addresses = signal<Address[]>([]);
  readonly selectedAddressId = signal<number | null>(null);
  readonly shipping = signal<ShippingMethod>('standard');
  readonly invoice = signal<InvoiceType>(this.extras.invoice ? 'personal' : 'none');
  readonly invoiceTitle = signal('');
  readonly payment = signal('wechat');
  readonly scheduleSlot = signal('周六 10:00–14:00');
  readonly gift = signal(this.extras.gift);
  readonly lines = signal<CartItem[]>([]);

  readonly submitting = signal(false);
  readonly submitError = signal('');
  readonly successOrder = signal<PlacedOrder | null>(null);

  readonly addressModalOpen = signal(false);
  readonly savingAddress = signal(false);
  readonly addressError = signal('');
  readonly draft = signal<AddressDraft>({ name: '', phone: '', region: '', detail: '', isDefault: false });
  readonly draftErrors = signal<AddressErrors>({});

  readonly scheduleSlots = ['周六 10:00–14:00', '周六 14:00–18:00', '周日 10:00–14:00', '周日 14:00–18:00'];
  readonly deliveryStandard = computed(() => deliveryWindow(2, 4));
  readonly deliveryNext = computed(() => deliveryDay(1));
  readonly shippingOptions = computed<ShippingOption[]>(() => [
    {
      key: 'standard',
      label: '标准配送',
      hint: '预计 ' + this.deliveryStandard() + ' 送达 · 48 小时内发出',
      badge: '免运费',
      icon: 'truck',
    },
    {
      key: 'next_day',
      label: '次日达',
      hint: '预计 ' + this.deliveryNext() + ' 送达 · 工作日 15:00 前下单',
      badge: '会员免运费',
      icon: 'clock',
    },
    {
      key: 'scheduled',
      label: '预约配送',
      hint: '选择周末或指定时段，配送员提前联系',
      badge: '预约',
      icon: 'calendar',
    },
  ]);

  readonly count = computed(() => this.lines().reduce((sum, item) => sum + item.quantity, 0));
  readonly merchandise = computed(() =>
    this.lines().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
  readonly total = computed(() => this.merchandise());
  readonly selectedAddress = computed(
    () => this.addresses().find((address) => address.id === this.selectedAddressId()) ?? null,
  );
  readonly shippingLabel = computed(() => {
    switch (this.shipping()) {
      case 'next_day':
        return '次日达';
      case 'scheduled':
        return '预约配送 · ' + this.scheduleSlot();
      default:
        return '标准配送';
    }
  });
  readonly paymentLabel = computed(() => {
    switch (this.payment()) {
      case 'alipay':
        return '支付宝';
      case 'card':
        return '银行卡';
      default:
        return '微信支付';
    }
  });
  readonly invoiceLabel = computed(() => {
    if (this.invoice() === 'none') {
      return '不开票';
    }
    const title = this.invoiceTitle().trim();
    return title ? '电子普通发票 · ' + title : '电子普通发票';
  });
  readonly summaryThumbs = computed(() => this.lines().slice(0, 4));
  readonly summaryMore = computed(() => Math.max(0, this.lines().length - 4));
  readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      !this.successOrder() &&
      this.selectedAddressId() !== null &&
      this.lines().length > 0,
  );

  private skeletonTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
    }
  }

  loadAll(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.requestId.set(undefined);
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
    }
    this.skeletonTimer = setTimeout(() => this.showSkeleton.set(true), 300);

    forkJoin({
      cart: this.cart.refresh(),
      addresses: this.account.addresses(),
    }).subscribe({
      next: ({ cart, addresses }) => {
        this.finishLoading();
        this.lines.set(this.pickLines(cart?.items ?? []));
        const list = this.normalizeAddresses(addresses as unknown);
        this.addresses.set(list);
        const preferred = list.find((address) => address.isDefault) ?? list[0] ?? null;
        this.selectedAddressId.set(preferred ? preferred.id : null);
      },
      error: (err: unknown) => {
        this.finishLoading();
        this.loadError.set(this.message(err));
        this.requestId.set(errorRequestId(err));
      },
    });
  }

  selectAddress(id: number): void {
    this.selectedAddressId.set(id);
    this.submitError.set('');
  }

  onSchedule(event: Event): void {
    this.scheduleSlot.set((event.target as HTMLSelectElement).value);
  }

  onInvoiceTitle(event: Event): void {
    this.invoiceTitle.set((event.target as HTMLInputElement).value.slice(0, 50));
  }

  goShopping(): void {
    this.router.navigate(['/category/all']);
  }

  openAddressModal(): void {
    this.draft.set({
      name: '',
      phone: '',
      region: '',
      detail: '',
      isDefault: this.addresses().length === 0,
    });
    this.draftErrors.set({});
    this.addressError.set('');
    this.addressModalOpen.set(true);
  }

  closeAddressModal(): void {
    if (this.savingAddress()) {
      return;
    }
    this.addressModalOpen.set(false);
  }

  setDraftText(field: 'name' | 'phone' | 'region' | 'detail', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    this.draftErrors.update((errors) => ({ ...errors, [field]: undefined }));
    this.addressError.set('');
  }

  setDefault(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.draft.update((draft) => ({ ...draft, isDefault: checked }));
  }

  saveAddress(): void {
    if (this.savingAddress()) {
      return;
    }
    const draft = this.draft();
    const errors: AddressErrors = {};
    if (!draft.name.trim()) {
      errors.name = '请填写收件人姓名';
    }
    if (!draft.phone.trim()) {
      errors.phone = '请填写手机号';
    } else if (!/^[0-9+\-\s]{6,20}$/.test(draft.phone.trim())) {
      errors.phone = '手机号格式不正确，例如 13800000000';
    }
    if (!draft.region.trim()) {
      errors.region = '请填写省 / 市 / 区';
    }
    if (!draft.detail.trim()) {
      errors.detail = '请填写详细地址';
    }
    this.draftErrors.set(errors);
    if (Object.keys(errors).length > 0) {
      this.focusFirstAddressError(errors);
      return;
    }

    this.savingAddress.set(true);
    this.addressError.set('');
    this.account
      .createAddress({
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        region: draft.region.trim(),
        detail: draft.detail.trim(),
        isDefault: draft.isDefault,
      })
      .subscribe({
        next: (created) => {
          this.savingAddress.set(false);
          const address = this.normalizeAddress(created as unknown);
          if (!address.id) {
            this.addressModalOpen.set(false);
            this.toast.show('收货地址已保存', 'success');
            this.reloadAddresses();
            return;
          }
          this.addresses.update((list) => {
            const cleared = address.isDefault
              ? list.map((item) => ({ ...item, isDefault: false }))
              : list;
            return [...cleared, address];
          });
          this.selectedAddressId.set(address.id);
          this.addressModalOpen.set(false);
          this.toast.show('收货地址已保存', 'success');
        },
        error: (err: unknown) => {
          this.savingAddress.set(false);
          this.addressError.set(this.message(err));
          this.cdr.detectChanges();
          this.focusAddressErrorAlert();
        },
      });
  }

  submit(): void {
    if (this.submitting() || this.successOrder()) {
      return;
    }
    if (this.lines().length === 0) {
      this.submitError.set('购物车中没有可结算的商品，请返回购物车重新选择');
      this.focusSubmitError();
      return;
    }
    const addressId = this.selectedAddressId();
    if (addressId === null) {
      this.submitError.set('请先选择或新增收货地址');
      this.focusSubmitError();
      return;
    }

    this.submitting.set(true);
    this.submitError.set('');

    const selected = this.selectedAddress();
    const payload: CreateOrderPayload = {
      items: this.lines().map((item) => ({
        productId: item.productId,
        title: item.title,
        image: item.image,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
      addressId,
      address: selected
        ? {
            recipient: selected.name,
            phone: selected.phone,
            region: selected.region,
            detail: selected.detail,
          }
        : undefined,
      shipping: this.shipping(),
      invoice: this.invoice(),
    };
    const recipient = selected?.name ?? '会员';
    const count = this.count();

    this.orders.create(payload).subscribe({
      next: (order) => {
        this.cart.clear();
        clearCartSelection();
        this.submitting.set(false);
        this.successOrder.set({
          id: Number(order?.id ?? 0),
          total: Number(order?.total ?? 0),
          recipient,
          count,
        });
        this.toast.show('订单提交成功', 'success');
        this.scrollTop();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.submitError.set(this.message(err));
        this.cdr.detectChanges();
        this.focusSubmitError();
      },
    });
  }

  specOf(productId: number): string {
    return PRODUCT_META[productId]?.specs?.[0]?.value ?? '';
  }

  maskPhone(phone: string): string {
    const value = String(phone ?? '');
    return value.length >= 7 ? value.slice(0, 3) + '****' + value.slice(-4) : value;
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(FALLBACK_IMAGE)) {
      image.src = FALLBACK_IMAGE;
    }
  }

  private pickLines(items: CartItem[]): CartItem[] {
    if (items.length === 0) {
      return [];
    }
    const stored = readCartSelection();
    if (stored === null) {
      return items;
    }
    const picked = items.filter(
      (item) => stored.selected.includes(item.id) || !stored.known.includes(item.id),
    );
    return picked.length > 0 ? picked : items;
  }

  private reloadAddresses(): void {
    this.account.addresses().subscribe({
      next: (res) => {
        const list = this.normalizeAddresses(res as unknown);
        this.addresses.set(list);
        if (this.selectedAddressId() === null) {
          const preferred = list.find((address) => address.isDefault) ?? list[0] ?? null;
          this.selectedAddressId.set(preferred ? preferred.id : null);
        }
      },
      error: () => undefined,
    });
  }

  private finishLoading(): void {
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
      this.skeletonTimer = undefined;
    }
    this.loading.set(false);
    this.showSkeleton.set(false);
  }

  private focusFirstAddressError(errors: AddressErrors): void {
    const ids: Record<keyof AddressErrors, string> = {
      name: 'addr-name',
      phone: 'addr-phone',
      region: 'addr-region',
      detail: 'addr-detail',
    };
    const order: (keyof AddressErrors)[] = ['name', 'phone', 'region', 'detail'];
    const field = order.find((key) => errors[key]);
    if (!field) {
      return;
    }
    setTimeout(() => document.getElementById(ids[field])?.focus());
  }

  private focusAddressErrorAlert(): void {
    setTimeout(() => document.getElementById('address-form-error')?.focus());
  }

  private focusSubmitError(): void {
    setTimeout(() => document.getElementById('checkout-submit-error')?.focus());
  }

  private scrollTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private normalizeAddresses(res: unknown): Address[] {
    const list = Array.isArray(res) ? res : ((res as { items?: unknown[] } | null)?.items ?? []);
    if (!Array.isArray(list)) {
      return [];
    }
    return list
      .map((raw) => this.normalizeAddress(raw))
      .filter((address) => address.id > 0);
  }

  private normalizeAddress(raw: unknown): Address {
    const row = (raw ?? {}) as Record<string, unknown>;
    return {
      id: Number(row['id'] ?? 0),
      name: String(row['name'] ?? ''),
      phone: String(row['phone'] ?? ''),
      region: String(row['region'] ?? ''),
      detail: String(row['detail'] ?? ''),
      isDefault: Boolean(row['isDefault'] ?? row['is_default']),
    };
  }

  private message(err: unknown): string {
    const status = (err as { status?: number } | null)?.status;
    return status === 0 ? '网络连接失败，请确认服务已启动后重试' : errorMessage(err);
  }
}
