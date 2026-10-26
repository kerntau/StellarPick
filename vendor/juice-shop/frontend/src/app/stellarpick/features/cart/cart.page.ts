import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AccountApi } from '../../core/api/account.api';
import { ProductsApi } from '../../core/api/products.api';
import { AuthStore } from '../../core/auth/auth.store';
import { CartService } from '../../core/cart.service';
import { CartItem, Coupon, Product, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { CartLineComponent } from './components/cart-line.component';
import { CouponPickerComponent } from './components/coupon-picker.component';
import { PaymentIconsComponent } from './components/payment-icons.component';
import { readCartSelection, writeCartSelection } from './cart-selection';
import {
  FREE_SHIPPING_THRESHOLD,
  addFavorites,
  deliveryWindow,
  readCheckoutExtras,
  readFavorites,
  recordViewed,
  shippingProgress,
  toggleFavorite,
  writeCheckoutExtras,
} from './cart-extras';
import type { CheckoutExtras } from './cart-extras';

const FALLBACK_IMAGE = '/assets/sp/img/products/1001.svg';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [
    RouterLink,
    MoneyPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
    CartLineComponent,
    CouponPickerComponent,
    PaymentIconsComponent,
  ],
  template: `
    <div class="sp-container cart-page">
      <nav class="crumbs" aria-label="面包屑">
        <a routerLink="/">首页</a>
        <span class="crumb-sep" aria-hidden="true">/</span>
        <span aria-current="page">购物车</span>
      </nav>

      <ol class="sp-steps" aria-label="购物流程">
        <li class="on" aria-current="step"><span class="dot">1</span>购物车</li>
        <li><span class="dot">2</span>结算</li>
        <li><span class="dot">3</span>完成</li>
      </ol>

      <header class="sp-page-head">
        <div>
          <span class="sp-eyebrow">SHOPPING BAG · 购物袋</span>
          <h1>购物车</h1>
          @if (auth.isLoggedIn() && cart.items().length > 0) {
            <p>共 {{ cart.items().length }} 种商品，已选 {{ selectedCount() }} 件。核对后即可去结算。</p>
          } @else if (auth.isLoggedIn()) {
            <p>购物车还是空的，去挑几件日常好物吧。</p>
          } @else {
            <p>登录后可同步购物车、使用优惠券并继续结算。</p>
          }
        </div>
        <div class="head-side">
          @if (auth.isLoggedIn() && cart.items().length > 0) {
            <p class="head-eta">
              <app-icon name="truck" [size]="16" />
              今日 15:00 前下单，预计 {{ deliveryEstimate() }} 送达
            </p>
          }
          <a class="sp-btn sp-btn--ghost" routerLink="/category/all">继续购物</a>
        </div>
      </header>

      @if (!auth.isLoggedIn()) {
        <section class="sp-card guest-card">
          <div class="guest-grid">
            <div class="guest-copy">
              <span class="sp-eyebrow sp-eyebrow--muted">MEMBER BENEFITS</span>
              <h2>登录后继续你的购物袋</h2>
              <p>登录后可同步购物车、使用优惠券并继续结算。会员订单全年包邮，积分可抵现。</p>
              <div class="guest-actions">
                <button class="sp-btn sp-btn--accent" type="button" (click)="goLogin()">登录 / 注册</button>
                <a class="sp-btn sp-btn--ghost" routerLink="/category/all">先逛逛</a>
              </div>
              <p class="guest-register sp-text-13">
                还没有账号？<a class="sp-link" routerLink="/register">立即注册</a>
              </p>
            </div>
            <ul class="guest-benefits">
              <li><span class="benefit-icon"><app-icon name="tag" [size]="18" /></span><strong>会员专享价</strong><small>精选商品会员立减</small></li>
              <li><span class="benefit-icon"><app-icon name="truck" [size]="18" /></span><strong>会员订单免运费</strong><small>全年包邮，不设门槛</small></li>
              <li><span class="benefit-icon"><app-icon name="shield" [size]="18" /></span><strong>7 天无理由退换</strong><small>正品保障，售后无忧</small></li>
            </ul>
          </div>
        </section>
      } @else if (loading()) {
        @if (showSkeleton()) {
          <div class="cart-layout" aria-busy="true" aria-label="正在加载购物车">
            <div class="cart-main">
              <div class="sp-card sp-card--pad"><app-skeleton variant="table" /></div>
              <div class="sp-card sp-card--pad"><app-skeleton variant="line" width="40%" /></div>
            </div>
            <div class="cart-aside">
              <div class="sp-card sp-card--pad">
                <app-skeleton variant="line" width="60%" />
                <div class="sp-mt-4"><app-skeleton variant="line" /></div>
                <div class="sp-mt-3"><app-skeleton variant="line" width="80%" /></div>
                <div class="sp-mt-6"><app-skeleton variant="line" width="100%" /></div>
              </div>
            </div>
          </div>
        } @else {
          <div class="load-hold" aria-busy="true"></div>
        }
      } @else if (error()) {
        <app-error-state [message]="error()" [requestId]="requestId()" (retry)="loadCart()" />
      } @else if (cart.items().length === 0) {
        <section class="sp-card empty-card">
          <app-empty-state
            image="cart"
            title="购物车还是空的"
            description="去挑几件日常好物，会员订单免运费，7 天无理由退换。"
            actionLabel="去逛逛"
            (action)="goShopping()"
          />
          <div class="empty-links">
            <a class="sp-link" routerLink="/account/orders">查看我的订单</a>
            <span class="sp-muted" aria-hidden="true">·</span>
            <a class="sp-link" routerLink="/help">配送与售后说明</a>
          </div>
        </section>

        @if (recommendations().length > 0) {
          <section class="sp-card addon-card empty-addon" aria-labelledby="empty-addon-title">
            <div class="addon-head">
              <div>
                <span class="sp-eyebrow sp-eyebrow--muted">POPULAR NOW</span>
                <h2 id="empty-addon-title">本周热销</h2>
                <p>会员复购率最高的几件日常好物。</p>
              </div>
              <a class="sp-link sp-text-13" routerLink="/category/all">查看全部</a>
            </div>
            <div class="addon-grid">
              @for (product of recommendations(); track product.id) {
                <article class="addon">
                  <a class="addon-thumb" [routerLink]="['/product', product.id]" tabindex="-1" aria-hidden="true">
                    <img [src]="product.image" alt="" width="88" height="88" loading="lazy" (error)="onImageError($event)" />
                  </a>
                  <div class="addon-info">
                    <a class="addon-title sp-clamp-2" [routerLink]="['/product', product.id]">{{ product.title }}</a>
                    <p class="addon-meta"><app-icon name="star" [size]="12" /> {{ product.rating }} · 已售 {{ product.sales }}</p>
                    <div class="addon-foot">
                      <span class="addon-price sp-num">{{ product.price | spMoney }}</span>
                      <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" [disabled]="addonBusyId() === product.id" (click)="addRecommendation(product)">
                        {{ addonBusyId() === product.id ? '加购中…' : '加购' }}
                      </button>
                    </div>
                  </div>
                </article>
              }
            </div>
          </section>
        }
      } @else {
        <div class="cart-layout">
          <div class="cart-main">
            <section class="sp-card ship-card" aria-labelledby="ship-title">
              <div class="ship-main">
                <span class="ship-icon" aria-hidden="true"><app-icon name="truck" [size]="20" /></span>
                <div class="ship-copy">
                  <div class="ship-title-row">
                    <h2 id="ship-title">会员包邮</h2>
                    <span class="ship-badge" [class.is-on]="shippingReached()">{{ shippingReached() ? '已解锁' : '满 ' + (freeShippingThreshold | spMoney) + ' 包邮' }}</span>
                  </div>
                  <p>
                    @if (shippingReached()) {
                      本单已满足包邮门槛，会员订单继续免运费。
                    } @else {
                      再买 <strong>{{ shippingRemaining() | spMoney }}</strong> 即可享全场包邮。
                    }
                  </p>
                  <div
                    class="ship-bar"
                    role="progressbar"
                    aria-label="包邮进度"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-valuenow]="shippingPercent()"
                  >
                    <span [style.width.%]="shippingPercent()"></span>
                  </div>
                  <div class="ship-foot">
                    <span>已选商品 {{ merchandise() | spMoney }}</span>
                    <span>门槛 {{ freeShippingThreshold | spMoney }}</span>
                  </div>
                </div>
              </div>
              <div class="ship-side">
                <span class="ship-side-label">预计送达</span>
                <strong>{{ deliveryEstimate() }}</strong>
                <small>标准配送 · 48 小时内发出</small>
              </div>
            </section>

            <section class="sp-card cart-list" aria-label="购物车商品">
              <div class="list-toolbar">
                <label class="select-all">
                  <input
                    type="checkbox"
                    [checked]="allSelected()"
                    [indeterminate]="someSelected()"
                    (change)="toggleAll($event)"
                    aria-label="全选购物车商品"
                  />
                  <span>全选</span>
                </label>
                <span class="sel-count sp-text-13 sp-secondary">已选 {{ selectedCount() }} 件</span>
                <span class="sp-grow"></span>
                @if (confirmRemove()) {
                  <span class="confirm-text sp-text-13">删除已选 {{ selectedItems().length }} 种商品？</span>
                  <button class="sp-btn sp-btn--ghost sp-btn--sm" type="button" (click)="cancelRemoveSelected()">取消</button>
                  <button
                    class="sp-btn sp-btn--danger sp-btn--sm"
                    type="button"
                    [disabled]="batchBusy()"
                    [attr.aria-busy]="batchBusy()"
                    (click)="confirmRemoveSelected()"
                  >
                    {{ batchBusy() ? '删除中…' : '确认删除' }}
                  </button>
                } @else {
                  <button
                    class="tool-action"
                    type="button"
                    [disabled]="selectedCount() === 0"
                    (click)="favoriteSelected()"
                  >
                    <app-icon name="heart" [size]="15" /> 收藏已选
                  </button>
                  <button
                    class="remove-selected"
                    type="button"
                    [disabled]="selectedCount() === 0 || batchBusy()"
                    (click)="askRemoveSelected()"
                  >
                    <app-icon name="trash" [size]="15" /> 删除已选
                  </button>
                }
              </div>

              <div class="list-head" aria-hidden="true">
                <span class="h-info">商品信息</span>
                <span class="h-unit">单价</span>
                <span class="h-qty">数量</span>
                <span class="h-sub">小计</span>
                <span class="h-ops">操作</span>
              </div>

              @for (item of cart.items(); track item.id) {
                <app-cart-line
                  [item]="item"
                  [busy]="updatingId() === item.id || removingId() === item.id || batchBusy()"
                  [selected]="isSelected(item.id)"
                  [favorited]="isFavorite(item.productId)"
                  (selectedChange)="toggleItem(item.id, $event)"
                  (quantityChange)="changeQuantity(item, $event)"
                  (remove)="removeItem(item)"
                  (favorite)="favoriteItem(item)"
                />
              }

              <div class="list-foot sp-text-12 sp-muted">
                <span>共 {{ cart.items().length }} 种商品，{{ totalQuantity() }} 件</span>
                <span class="foot-right">
                  <span>已选 {{ selectedCount() }} 件</span>
                  <a class="sp-link" routerLink="/category/all">继续购物</a>
                </span>
              </div>
            </section>

            <app-coupon-picker
              [coupons]="availableCoupons()"
              [subtotal]="allMerchandise()"
              [loading]="couponsLoading()"
              [error]="couponsError()"
              [selectedId]="selectedCouponId()"
              (retry)="loadCoupons()"
              (select)="selectCoupon($event)"
            />

            <section class="sp-card extras-card" aria-labelledby="extras-title">
              <div class="extras-head">
                <div>
                  <span class="sp-eyebrow sp-eyebrow--muted">GIFT &amp; INVOICE</span>
                  <h2 id="extras-title">赠言与发票</h2>
                  <p>选填，结算时随订单一起确认。</p>
                </div>
                <span class="sp-badge" [class.sp-badge--accent]="extras().gift.length > 0">{{ extras().gift ? '已填写赠言' : '选填' }}</span>
              </div>

              <div class="extras-grid">
                <div class="gift">
                  <label class="sp-label" for="cart-gift">
                    赠言卡片
                    <span class="count">{{ extras().gift.length }}/50</span>
                  </label>
                  <textarea
                    id="cart-gift"
                    class="sp-textarea gift-input"
                    rows="3"
                    maxlength="50"
                    placeholder="写给收件人的一句话，会随包裹附上"
                    [value]="extras().gift"
                    (input)="onGift($event)"
                  ></textarea>
                  <div class="gift-chips" aria-label="赠言快捷短语">
                    @for (phrase of giftPhrases; track phrase) {
                      <button type="button" (click)="setGift(phrase)">{{ phrase }}</button>
                    }
                  </div>
                </div>

                <div class="invoice">
                  <span class="sp-label">发票</span>
                  <label class="switch-row">
                    <input type="checkbox" [checked]="extras().invoice" (change)="onInvoice($event)" />
                    <span class="switch" aria-hidden="true"></span>
                    <span class="switch-text">
                      <strong>电子普通发票</strong>
                      <small>个人抬头 · 订单完成后发送至邮箱</small>
                    </span>
                  </label>
                  <p class="invoice-note">
                    <app-icon name="info" [size]="14" />
                    发票内容为商品明细，可在订单详情中查看。
                  </p>
                </div>
              </div>
            </section>

            @if (recommendations().length > 0 || addonLoading()) {
              <section class="sp-card addon-card" aria-labelledby="addon-title">
                <div class="addon-head">
                  <div>
                    <span class="sp-eyebrow sp-eyebrow--muted">PAIR IT WITH</span>
                    <h2 id="addon-title">{{ shippingReached() ? '搭配推荐' : '凑单推荐' }}</h2>
                    <p>{{ shippingReached() ? '和已选商品一起用，刚刚好。' : '再选一件，轻松满 ' + (freeShippingThreshold | spMoney) + ' 包邮。' }}</p>
                  </div>
                  <span class="sp-badge sp-badge--accent">会员加购</span>
                </div>

                @if (addonLoading()) {
                  <div class="addon-grid" aria-busy="true">
                    @for (row of skeletonRows; track row) {
                      <div class="addon-skeleton"><app-skeleton variant="line" width="100%" /></div>
                    }
                  </div>
                } @else {
                  <div class="addon-grid">
                    @for (product of recommendations(); track product.id) {
                      <article class="addon">
                        <a class="addon-thumb" [routerLink]="['/product', product.id]" tabindex="-1" aria-hidden="true">
                          <img [src]="product.image" alt="" width="88" height="88" loading="lazy" (error)="onImageError($event)" />
                        </a>
                        <div class="addon-info">
                          <a class="addon-title sp-clamp-2" [routerLink]="['/product', product.id]">{{ product.title }}</a>
                          <p class="addon-meta"><app-icon name="star" [size]="12" /> {{ product.rating }} · 已售 {{ product.sales }}</p>
                          <div class="addon-foot">
                            <span class="addon-price sp-num">{{ product.price | spMoney }}</span>
                            <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" [disabled]="addonBusyId() === product.id" (click)="addRecommendation(product)">
                              {{ addonBusyId() === product.id ? '加购中…' : '加购' }}
                            </button>
                          </div>
                        </div>
                      </article>
                    }
                  </div>
                }
              </section>
            }
          </div>

          <aside class="cart-aside">
            <div class="sp-summary sticky">
              <div class="summary-head">
                <h2>订单摘要</h2>
                <span class="summary-count">{{ selectedCount() }} 件</span>
              </div>

              @if (summaryThumbs().length > 0) {
                <div class="summary-thumbs" aria-label="已选商品缩略图">
                  @for (item of summaryThumbs(); track item.id) {
                    <img [src]="item.image" [alt]="item.title" width="40" height="40" loading="lazy" (error)="onImageError($event)" />
                  }
                  @if (summaryMore() > 0) {
                    <span class="thumb-more">+{{ summaryMore() }}</span>
                  }
                </div>
              }

              <dl>
                <div><dt>商品金额</dt><dd>{{ merchandise() | spMoney }}</dd></div>
                <div><dt>运费</dt><dd class="free">免运费</dd></div>
                @if (selectedCoupon(); as coupon) {
                  <div><dt>优惠券</dt><dd class="coupon-line">-{{ couponDiscount() | spMoney }}</dd></div>
                }
                <div><dt>预计积分</dt><dd class="points">+{{ estimatedPoints() }}</dd></div>
                <div class="total"><dt>合计</dt><dd>{{ total() | spMoney }}</dd></div>
              </dl>

              @if (selectedCoupon()) {
                <p class="after-coupon">
                  用券后预计 <strong>{{ afterCoupon() | spMoney }}</strong>
                  <span>支付时抵扣</span>
                </p>
              }

              <div class="summary-pay">
                <span class="pay-label">支持支付</span>
                <app-payment-icons [compact]="true" />
              </div>

              @if (selectedCount() === 0) {
                <p class="pick-hint sp-text-12">请先勾选要结算的商品</p>
              }
              <button
                class="sp-btn sp-btn--accent sp-btn--lg sp-btn--block"
                type="button"
                [disabled]="selectedCount() === 0"
                (click)="goCheckout()"
              >
                <app-icon name="lock" [size]="16" />
                去结算（{{ selectedCount() }}）
              </button>
              <p class="sp-text-12 sp-muted summary-note">会员订单免运费；优惠券在支付时抵扣，本页合计为商品金额。</p>

              <ul class="trust-row">
                <li><app-icon name="shield" [size]="15" /> 正品保障</li>
                <li><app-icon name="refresh" [size]="15" /> 7 天无理由</li>
                <li><app-icon name="headset" [size]="15" /> 客服在线</li>
              </ul>

              <a class="sp-btn sp-btn--ghost sp-btn--block continue" routerLink="/category/all">继续购物</a>
            </div>
          </aside>
        </div>

        <div class="mobile-bar" role="region" aria-label="结算栏">
          <label class="bar-all">
            <input
              type="checkbox"
              [checked]="allSelected()"
              [indeterminate]="someSelected()"
              (change)="toggleAll($event)"
              aria-label="全选购物车商品"
            />
            <span>全选</span>
          </label>
          <div class="bar-total">
            <span class="sp-text-12 sp-muted">合计</span>
            <strong class="sp-num">{{ total() | spMoney }}</strong>
          </div>
          <button
            class="sp-btn sp-btn--accent"
            type="button"
            [disabled]="selectedCount() === 0"
            (click)="goCheckout()"
          >
            去结算（{{ selectedCount() }}）
          </button>
        </div>
        <div class="mobile-space" aria-hidden="true"></div>
      }
    </div>
  `,
  styles: [`
    .cart-page {
      padding-bottom: 48px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E");
      background-size: 160px 160px;
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 16px;
      font-size: 12px;
      color: var(--sp-text-muted);
    }
    .crumbs a { color: var(--sp-text-secondary); min-height: 32px; display: inline-flex; align-items: center; }
    .crumbs a:hover { color: var(--sp-primary); }
    .crumb-sep { color: var(--sp-border-strong); }
    .sp-page-head { align-items: flex-end; padding-top: 8px; }
    .sp-page-head h1 {
      font-family: var(--sp-serif);
      font-size: 36px;
      font-weight: 700;
      letter-spacing: .02em;
    }
    .head-side { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .head-eta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      font-size: 12px;
      color: var(--sp-text-secondary);
    }
    .head-eta app-icon { color: var(--sp-success); }
    .head-side .sp-btn { min-height: 44px; }

    .guest-card { padding: 28px; overflow: hidden; }
    .guest-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: center; }
    .guest-copy h2 { font-family: var(--sp-serif); font-size: 26px; margin-bottom: 8px; }
    .guest-copy > p { color: var(--sp-text-secondary); line-height: 1.7; }
    .guest-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
    .guest-actions .sp-btn { min-height: 44px; }
    .guest-register { margin-top: 12px; color: var(--sp-text-muted); }
    .guest-benefits {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .guest-benefits li {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      grid-template-rows: auto auto;
      column-gap: 12px;
      align-items: center;
      padding: 12px 14px;
      border: 1px solid var(--sp-border);
      border-radius: 8px;
      background: #FFFDF8;
    }
    .benefit-icon {
      grid-row: 1 / 3;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #FBF0DC;
      color: var(--sp-accent-text);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .guest-benefits strong { font-size: 13.5px; }
    .guest-benefits small { font-size: 12px; color: var(--sp-text-muted); }

    .load-hold { min-height: 320px; }
    .cart-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 348px;
      gap: 24px;
      align-items: start;
      margin-top: 8px;
    }
    .cart-main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
    .cart-aside { min-width: 0; }
    .sticky { position: sticky; top: calc(var(--sp-header-h) + 16px); }

    .ship-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 18px 20px;
      background: linear-gradient(135deg, #FFFDF8 0%, #FFFFFF 55%);
      border-color: #EADFCB;
    }
    .ship-main { display: flex; align-items: flex-start; gap: 12px; min-width: 0; flex: 1 1 auto; }
    .ship-icon {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #FBF0DC;
      color: var(--sp-accent-text);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }
    .ship-copy { flex: 1 1 auto; min-width: 0; }
    .ship-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .ship-title-row h2 { font-size: 15px; }
    .ship-badge {
      display: inline-flex;
      align-items: center;
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--sp-bg);
      color: var(--sp-text-secondary);
      font-size: 11px;
      font-weight: 600;
    }
    .ship-badge.is-on { background: var(--sp-success-soft); color: var(--sp-success); }
    .ship-copy p { font-size: 12px; color: var(--sp-text-secondary); margin-top: 3px; }
    .ship-copy p strong { color: var(--sp-accent-text); font-size: 13px; }
    .ship-bar {
      height: 6px;
      border-radius: 999px;
      background: var(--sp-paper-deep);
      overflow: hidden;
      margin-top: 10px;
    }
    .ship-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--sp-accent) 0%, var(--sp-accent-strong) 100%);
      transition: width .3s ease;
    }
    .ship-foot {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 5px;
      font-size: 11px;
      color: var(--sp-text-muted);
    }
    .ship-side {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 1px;
      padding-left: 20px;
      border-left: 1px dashed var(--sp-border-strong);
      text-align: right;
    }
    .ship-side-label { font-size: 11px; color: var(--sp-text-muted); }
    .ship-side strong { font-size: 14px; color: var(--sp-primary); }
    .ship-side small { font-size: 11px; color: var(--sp-text-muted); }

    .sp-summary { padding: 20px; }
    .summary-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .sp-summary h2 { font-size: 18px; margin-bottom: 10px; }
    .summary-count { font-size: 12px; color: var(--sp-text-muted); }
    .summary-thumbs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-bottom: 14px; margin-bottom: 4px; border-bottom: 1px solid var(--sp-border); }
    .summary-thumbs img { width: 40px; height: 40px; border-radius: 5px; object-fit: cover; border: 1px solid var(--sp-border); background: var(--sp-bg); }
    .thumb-more { font-size: 11px; color: var(--sp-text-muted); }
    .sp-summary .free { color: var(--sp-success); font-weight: 600; }
    .sp-summary .coupon-line { color: #9A4E2C; font-weight: 700; }
    .sp-summary .points { color: var(--sp-sage); font-weight: 600; }
    .sp-summary .sp-btn--accent { margin-top: 16px; }
    .after-coupon {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-top: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      background: #FFFBF3;
      color: var(--sp-text-secondary);
      font-size: 12px;
    }
    .after-coupon strong { color: #9A4E2C; font-size: 15px; }
    .after-coupon span { font-size: 11px; color: var(--sp-text-muted); }
    .summary-pay { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--sp-border); }
    .pay-label { display: block; margin-bottom: 4px; font-size: 11px; color: var(--sp-text-muted); }
    .pick-hint { color: var(--sp-warning); margin-top: 10px; }
    .summary-note { margin-top: 10px; line-height: 1.5; }
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
    .continue { margin-top: 12px; }

    .list-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 56px;
      padding: 8px 20px;
      border-bottom: 1px solid var(--sp-border);
      background: #FCFAF6;
      border-radius: 8px 8px 0 0;
      flex-wrap: wrap;
    }
    .select-all { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; min-height: 44px; }
    .select-all input { width: 16px; height: 16px; accent-color: var(--sp-primary); }
    .sel-count { white-space: nowrap; }
    .confirm-text { color: var(--sp-danger); font-weight: 600; }
    .tool-action, .remove-selected {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 44px;
      padding: 0 8px;
      border: 0;
      background: transparent;
      color: var(--sp-text-secondary);
      font-size: 13px;
      border-radius: 6px;
    }
    .tool-action:hover:not(:disabled) { color: var(--sp-terracotta-ink); background: #FBEFE9; }
    .remove-selected:hover:not(:disabled) { color: var(--sp-danger); background: var(--sp-danger-soft); }
    .tool-action:disabled, .remove-selected:disabled { opacity: .4; cursor: not-allowed; }
    .list-toolbar .sp-btn { min-height: 40px; }

    .list-head {
      display: grid;
      grid-template-columns: 24px 84px minmax(0, 1fr) 96px 124px 100px 92px;
      gap: 12px;
      padding: 10px 20px;
      border-bottom: 1px solid var(--sp-border);
      background: #F7F3EC;
      color: var(--sp-text-secondary);
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: .04em;
    }
    .h-info { grid-column: 1 / 4; }
    .h-unit { grid-column: 4; }
    .h-qty { grid-column: 5; }
    .h-sub { grid-column: 6; text-align: right; }
    .h-ops { grid-column: 7; text-align: right; }

    .list-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 20px;
      border-top: 1px solid var(--sp-border);
      background: #FCFAF6;
      border-radius: 0 0 8px 8px;
      flex-wrap: wrap;
    }
    .foot-right { display: inline-flex; align-items: center; gap: 16px; }
    .empty-card { padding: 8px 16px 24px; }
    .empty-links { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 13px; margin-top: -8px; }

    .extras-card { padding: 20px; }
    .extras-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .extras-head h2 { font-size: 18px; }
    .extras-head p { margin-top: 2px; font-size: 12px; color: var(--sp-text-muted); }
    .extras-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 24px; }
    .gift .sp-label, .invoice > .sp-label { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .count { font-size: 11px; color: var(--sp-text-muted); font-weight: 400; }
    .gift-input { min-height: 82px; background: #FFFDF8; }
    .gift-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .gift-chips button {
      min-height: 44px;
      padding: 0 9px;
      border: 1px solid var(--sp-border);
      border-radius: 999px;
      background: var(--sp-surface);
      color: var(--sp-text-secondary);
      font-size: 11.5px;
    }
    .gift-chips button:hover { border-color: var(--sp-accent); color: var(--sp-accent-text); background: #FFFBF3; }
    .invoice { display: flex; flex-direction: column; gap: 8px; padding-left: 24px; border-left: 1px dashed var(--sp-border); }
    .switch-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--sp-border);
      border-radius: 8px;
      background: var(--sp-bg);
      cursor: pointer;
    }
    .switch-row input { position: absolute; width: 1px; height: 1px; opacity: 0; margin: 0; }
    .switch {
      width: 38px;
      height: 22px;
      border-radius: 999px;
      background: var(--sp-border-strong);
      position: relative;
      flex: 0 0 auto;
      transition: background-color .15s ease;
    }
    .switch::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgba(16, 24, 40, .2);
      transition: transform .15s ease;
    }
    .switch-row input:checked + .switch { background: var(--sp-sage); }
    .switch-row input:checked + .switch::after { transform: translateX(16px); }
    .switch-row input:focus-visible + .switch { outline: 2px solid var(--sp-focus); outline-offset: 2px; }
    .switch-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .switch-text strong { font-size: 13px; }
    .switch-text small { font-size: 11px; color: var(--sp-text-muted); line-height: 1.45; }
    .invoice-note { display: flex; align-items: flex-start; gap: 4px; font-size: 11px; color: var(--sp-text-muted); line-height: 1.5; }
    .invoice-note app-icon { color: var(--sp-text-muted); flex: 0 0 auto; margin-top: 1px; }

    .addon-card { padding: 20px; }
    .addon-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .addon-head h2 { font-size: 18px; }
    .addon-head p { margin-top: 2px; font-size: 12px; color: var(--sp-text-muted); }
    .addon-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .addon {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border: 1px solid var(--sp-border);
      border-radius: 8px;
      background: #FFFDF8;
      min-width: 0;
    }
    .addon-thumb { display: block; width: 100%; aspect-ratio: 1 / 1; border-radius: 6px; overflow: hidden; background: var(--sp-bg); border: 1px solid var(--sp-border); }
    .addon-thumb img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
    .addon:hover .addon-thumb img { transform: scale(1.04); }
    .addon-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .addon-title { font-size: 12.5px; font-weight: 600; line-height: 1.4; min-height: 35px; }
    .addon-title:hover { color: var(--sp-accent-text); }
    .addon-meta { display: flex; align-items: center; gap: 3px; font-size: 10.5px; color: var(--sp-text-muted); }
    .addon-meta app-icon { color: var(--sp-accent); }
    .addon-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 2px; }
    .addon-price { font-size: 14px; font-weight: 700; color: var(--sp-accent-text); }
    .addon-foot .sp-btn { min-height: 36px; padding: 0 10px; }
    .addon-skeleton { min-height: 220px; border: 1px dashed var(--sp-border); border-radius: 8px; padding: 12px; }
    .empty-addon { margin-top: 20px; }

    .sp-page-head .sp-btn, .continue, .mobile-bar .sp-btn { min-height: 44px; }
    .mobile-bar { display: none; }

    @media (max-width: 1180px) {
      .cart-layout { grid-template-columns: minmax(0, 1fr) 320px; }
      .addon-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    /* The seven cart columns plus the 320px summary need ~1200px; below that
       the product-info column collapses to 0 and its title disappears. */
    @media (max-width: 1199px) {
      .cart-layout { grid-template-columns: 1fr; gap: 16px; }
      .list-head { display: none; }
      .sticky { position: static; }
    }
    @media (max-width: 1023px) {
      .guest-grid { grid-template-columns: 1fr; gap: 20px; }
      .extras-grid { grid-template-columns: 1fr; gap: 16px; }
      .invoice { padding-left: 0; border-left: 0; padding-top: 14px; border-top: 1px dashed var(--sp-border); }
    }
    @media (max-width: 767px) {
      .cart-page { padding-bottom: 96px; }
      .cart-page .sp-page-head .sp-btn { display: none; }
      .head-side { align-items: flex-start; }
      .head-eta { font-size: 11.5px; }
      .sp-page-head h1 { font-size: 30px; }
      .cart-aside .sp-btn--accent { display: none; }
      .guest-card { padding: 20px 16px; }
      .guest-copy h2 { font-size: 22px; }
      .list-toolbar { padding: 4px 16px; gap: 8px; }
      .sel-count { font-size: 12px; }
      .tool-action, .remove-selected { min-height: 44px; }
      .list-foot { padding: 10px 16px; }
      .ship-card { flex-direction: column; align-items: stretch; gap: 12px; padding: 16px; }
      .ship-side { align-items: flex-start; padding-left: 0; padding-top: 10px; border-left: 0; border-top: 1px dashed var(--sp-border); text-align: left; }
      .addon-grid { grid-template-columns: 1fr; }
      .addon { flex-direction: row; align-items: center; }
      .addon-thumb { width: 84px; height: 84px; flex: 0 0 auto; }
      .addon-title { min-height: 0; }
      .addon-foot { margin-top: 4px; }
      .mobile-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 90;
        padding: 8px 16px calc(8px + env(safe-area-inset-bottom));
        background: var(--sp-surface);
        border-top: 1px solid var(--sp-border);
        box-shadow: 0 -4px 16px rgba(16, 24, 40, .08);
      }
      .bar-all { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sp-text-secondary); min-height: 44px; cursor: pointer; flex: 0 0 auto; }
      .bar-all input { width: 16px; height: 16px; accent-color: var(--sp-primary); }
      .bar-total { display: flex; flex-direction: column; line-height: 1.25; margin-left: auto; text-align: right; }
      .bar-total strong { font-size: 19px; color: var(--sp-accent-text); }
      .mobile-bar .sp-btn { flex: 0 0 auto; padding: 0 16px; }
      .mobile-space { height: 8px; }
    }
    @media (max-width: 480px) {
      .sp-steps { gap: 4px; }
      .sp-steps li { gap: 6px; }
      .sp-steps li::after { width: 20px; margin-left: 4px; }
      .trust-row { flex-wrap: wrap; justify-content: flex-start; gap: 8px 14px; }
      .summary-thumbs img { width: 36px; height: 36px; }
    }
    @media (max-width: 360px) {
      .bar-all span { display: none; }
      .mobile-bar .sp-btn { padding: 0 12px; }
      .head-eta { display: none; }
    }
  `],
})
export class CartPage implements OnInit, OnDestroy {
  readonly auth = inject(AuthStore);
  readonly cart = inject(CartService);
  private readonly account = inject(AccountApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly showSkeleton = signal(false);
  readonly error = signal('');
  readonly requestId = signal<string | undefined>(undefined);
  readonly updatingId = signal<number | null>(null);
  readonly removingId = signal<number | null>(null);
  readonly selectedIds = signal<number[]>([]);
  readonly confirmRemove = signal(false);
  readonly batchBusy = signal(false);
  readonly coupons = signal<Coupon[]>([]);
  readonly couponsLoading = signal(false);
  readonly couponsError = signal(false);
  readonly selectedCouponId = signal<number | null>(null);
  readonly recommendations = signal<Product[]>([]);
  readonly addonLoading = signal(false);
  readonly addonBusyId = signal<number | null>(null);
  readonly favorites = signal<number[]>([]);
  readonly extras = signal<CheckoutExtras>(readCheckoutExtras());
  readonly skeletonRows = [1, 2, 3];
  readonly giftPhrases = ['生日快乐', '乔迁之喜', '谢谢惠顾'];
  readonly freeShippingThreshold = FREE_SHIPPING_THRESHOLD;
  readonly deliveryEstimate = computed(() => deliveryWindow(2, 4));

  readonly selectedItems = computed(() => {
    const ids = this.selectedIds();
    return this.cart.items().filter((item) => ids.includes(item.id));
  });
  readonly selectedCount = computed(() =>
    this.selectedItems().reduce((sum, item) => sum + item.quantity, 0),
  );
  readonly totalQuantity = computed(() =>
    this.cart.items().reduce((sum, item) => sum + item.quantity, 0),
  );
  readonly allSelected = computed(() => {
    const items = this.cart.items();
    return items.length > 0 && items.every((item) => this.selectedIds().includes(item.id));
  });
  readonly someSelected = computed(
    () => this.selectedIds().length > 0 && !this.allSelected(),
  );
  readonly merchandise = computed(() =>
    this.selectedItems().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
  readonly allMerchandise = computed(() =>
    this.cart.items().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
  readonly total = computed(() => this.merchandise());
  readonly availableCoupons = computed(() => this.coupons().filter((coupon) => !coupon.used));
  readonly selectedCoupon = computed(() => {
    const id = this.selectedCouponId();
    if (id === null) {
      return null;
    }
    const coupon = this.availableCoupons().find((entry) => entry.id === id);
    return coupon && this.merchandise() >= coupon.minSpend ? coupon : null;
  });
  readonly couponDiscount = computed(() => this.selectedCoupon()?.amount ?? 0);
  readonly afterCoupon = computed(() => Math.max(0, this.total() - this.couponDiscount()));
  readonly estimatedPoints = computed(() => Math.round(this.merchandise()));
  readonly shippingPercent = computed(() => shippingProgress(this.merchandise()));
  readonly shippingRemaining = computed(() =>
    Math.max(0, FREE_SHIPPING_THRESHOLD - this.merchandise()),
  );
  readonly shippingReached = computed(() => this.merchandise() >= FREE_SHIPPING_THRESHOLD);
  readonly summaryThumbs = computed(() => this.selectedItems().slice(0, 4));
  readonly summaryMore = computed(() => Math.max(0, this.selectedItems().length - 4));

  private skeletonTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.favorites.set(readFavorites(this.auth.user()));
    if (!this.auth.isLoggedIn()) {
      return;
    }
    this.loadCart();
    this.loadCoupons();
  }

  ngOnDestroy(): void {
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
    }
  }

  loadCart(): void {
    if (!this.auth.isLoggedIn()) {
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.requestId.set(undefined);
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
    }
    this.skeletonTimer = setTimeout(() => this.showSkeleton.set(true), 300);

    this.cart.refresh().subscribe({
      next: () => {
        this.finishLoading();
        this.restoreSelection();
        this.favorites.set(readFavorites(this.auth.user()));
        recordViewed(this.auth.user(), this.cart.items());
        this.loadRecommendations();
      },
      error: (err: unknown) => {
        this.finishLoading();
        this.error.set(this.message(err));
        this.requestId.set(errorRequestId(err));
      },
    });
  }

  loadCoupons(): void {
    if (!this.auth.isLoggedIn()) {
      return;
    }
    this.couponsLoading.set(true);
    this.couponsError.set(false);
    this.account.coupons().subscribe({
      next: (res) => {
        this.coupons.set(this.normalizeCoupons(res as unknown));
        this.couponsLoading.set(false);
      },
      error: () => {
        this.coupons.set([]);
        this.couponsLoading.set(false);
        this.couponsError.set(true);
      },
    });
  }

  loadRecommendations(): void {
    if (!this.auth.isLoggedIn()) {
      return;
    }
    this.addonLoading.set(this.recommendations().length === 0);
    this.productsApi.list({ page: 1, size: 10, sort: 'sales' }).subscribe({
      next: (result) => {
        const inCart = new Set(this.cart.items().map((item) => item.productId));
        this.recommendations.set(
          (result.items ?? []).filter((product) => !inCart.has(product.id)).slice(0, 3),
        );
        this.addonLoading.set(false);
      },
      error: () => {
        this.recommendations.set([]);
        this.addonLoading.set(false);
      },
    });
  }

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  isFavorite(productId: number): boolean {
    return this.favorites().includes(Number(productId));
  }

  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.set(checked ? this.cart.items().map((item) => item.id) : []);
    this.confirmRemove.set(false);
    this.persistSelection();
  }

  toggleItem(id: number, checked: boolean): void {
    const current = this.selectedIds();
    const next = checked
      ? current.includes(id) ? current : [...current, id]
      : current.filter((value) => value !== id);
    this.selectedIds.set(next);
    this.confirmRemove.set(false);
    this.persistSelection();
  }

  changeQuantity(item: CartItem, quantity: number): void {
    if (quantity === item.quantity || this.updatingId() !== null) {
      return;
    }
    this.updatingId.set(item.id);
    this.cart.update(item.id, quantity).subscribe({
      next: () => {
        this.updatingId.set(null);
      },
      error: (err: unknown) => {
        this.updatingId.set(null);
        this.toast.show(this.message(err), 'error');
      },
    });
  }

  removeItem(item: CartItem): void {
    if (this.removingId() !== null) {
      return;
    }
    this.removingId.set(item.id);
    this.cart.remove(item.id).subscribe({
      next: () => {
        this.removingId.set(null);
        this.selectedIds.update((ids) => ids.filter((id) => id !== item.id));
        this.persistSelection();
        this.toast.show('已从购物车删除 1 种商品', 'info');
        this.loadRecommendations();
      },
      error: (err: unknown) => {
        this.removingId.set(null);
        this.toast.show(this.message(err), 'error');
      },
    });
  }

  favoriteItem(item: CartItem): void {
    const next = toggleFavorite(this.auth.user(), item.productId);
    this.favorites.set(readFavorites(this.auth.user()));
    this.toast.show(next ? '已收藏，可在会员中心查看' : '已取消收藏', next ? 'success' : 'info');
  }

  favoriteSelected(): void {
    const ids = this.selectedItems().map((item) => item.productId);
    if (ids.length === 0) {
      return;
    }
    const added = addFavorites(this.auth.user(), ids);
    this.favorites.set(readFavorites(this.auth.user()));
    this.toast.show(
      added > 0 ? '已收藏 ' + added + ' 种商品' : '所选商品已在收藏夹中',
      added > 0 ? 'success' : 'info',
    );
  }

  selectCoupon(id: number | null): void {
    if (id === null) {
      this.selectedCouponId.set(null);
      return;
    }
    const coupon = this.availableCoupons().find((entry) => entry.id === id);
    if (!coupon || this.merchandise() < coupon.minSpend) {
      return;
    }
    this.selectedCouponId.set(id);
    this.toast.show('已选优惠券，支付时抵扣 ' + coupon.amount + ' 元', 'success');
  }

  onGift(event: Event): void {
    const gift = (event.target as HTMLTextAreaElement).value.slice(0, 50);
    this.updateExtras({ ...this.extras(), gift });
  }

  setGift(phrase: string): void {
    this.updateExtras({ ...this.extras(), gift: phrase });
  }

  onInvoice(event: Event): void {
    const invoice = (event.target as HTMLInputElement).checked;
    this.updateExtras({ ...this.extras(), invoice });
  }

  addRecommendation(product: Product): void {
    if (this.addonBusyId() !== null) {
      return;
    }
    this.addonBusyId.set(product.id);
    this.cart.addProduct(product, 1).subscribe({
      next: (cart) => {
        this.addonBusyId.set(null);
        const added = cart.items.find((item) => item.productId === product.id);
        if (added) {
          this.selectedIds.update((ids) => (ids.includes(added.id) ? ids : [...ids, added.id]));
          this.persistSelection();
        }
        this.toast.show('已加入购物车');
        this.loadRecommendations();
      },
      error: (err: unknown) => {
        this.addonBusyId.set(null);
        this.toast.show(this.message(err), 'error');
      },
    });
  }

  askRemoveSelected(): void {
    if (this.selectedIds().length === 0) {
      return;
    }
    this.confirmRemove.set(true);
  }

  cancelRemoveSelected(): void {
    this.confirmRemove.set(false);
  }

  confirmRemoveSelected(): void {
    const ids = [...this.selectedIds()];
    if (ids.length === 0 || this.batchBusy()) {
      return;
    }
    this.batchBusy.set(true);
    forkJoin(ids.map((id) => this.cart.remove(id))).subscribe({
      next: () => undefined,
      error: (err: unknown) => {
        this.batchBusy.set(false);
        this.confirmRemove.set(false);
        this.toast.show(this.message(err), 'error');
        this.loadCart();
      },
      complete: () => {
        this.batchBusy.set(false);
        this.confirmRemove.set(false);
        this.selectedIds.set([]);
        this.persistSelection();
        this.toast.show('已删除 ' + ids.length + ' 种商品', 'info');
        this.loadRecommendations();
      },
    });
  }

  goLogin(): void {
    this.router.navigate(['/login'], { queryParams: { next: '/cart' } });
  }

  goShopping(): void {
    this.router.navigate(['/category/all']);
  }

  goCheckout(): void {
    if (this.selectedCount() === 0) {
      return;
    }
    this.persistSelection();
    this.router.navigate(['/checkout']);
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(FALLBACK_IMAGE)) {
      image.src = FALLBACK_IMAGE;
    }
  }

  private updateExtras(extras: CheckoutExtras): void {
    this.extras.set(extras);
    writeCheckoutExtras(extras);
  }

  private finishLoading(): void {
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
      this.skeletonTimer = undefined;
    }
    this.loading.set(false);
    this.showSkeleton.set(false);
  }

  private restoreSelection(): void {
    const items = this.cart.items();
    const stored = readCartSelection();
    const ids = stored === null || stored.selected.length === 0
      ? items.map((item) => item.id)
      : items.filter((item) => stored.selected.includes(item.id)).map((item) => item.id);
    this.selectedIds.set(ids);
    this.persistSelection();
  }

  private persistSelection(): void {
    writeCartSelection(this.selectedIds(), this.cart.items().map((item) => item.id));
  }

  private normalizeCoupons(res: unknown): Coupon[] {
    const list = Array.isArray(res)
      ? res
      : ((res as { items?: unknown[] } | null)?.items ?? []);
    if (!Array.isArray(list)) {
      return [];
    }
    return list
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        return {
          id: Number(row['id'] ?? row['couponId'] ?? 0),
          title: String(row['title'] ?? '优惠券'),
          amount: Number(row['amount'] ?? row['value'] ?? 0),
          minSpend: Number(row['minSpend'] ?? row['threshold'] ?? 0),
          expiresAt: String(row['expiresAt'] ?? row['expires_at'] ?? ''),
          used: Boolean(row['used'] ?? row['status'] === 'used'),
        } as Coupon;
      })
      .filter((coupon) => coupon.id > 0);
  }

  private message(err: unknown): string {
    const status = (err as { status?: number } | null)?.status;
    return status === 0 ? '网络连接失败，请确认服务已启动后重试' : errorMessage(err);
  }
}
