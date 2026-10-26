import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountApi } from '../../core/api/account.api';
import { OrdersApi } from '../../core/api/orders.api';
import { ProductsApi } from '../../core/api/products.api';
import { AuthStore } from '../../core/auth/auth.store';
import { Address, Coupon, Order, Product, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { SpDatePipe } from '../../shared/pipes/date.pipe';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { AvatarUploadComponent } from './components/avatar-upload.component';
import { DEFAULT_AVATAR, normalizeAvatar } from './components/account-avatar';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { readFavorites, readViewed, toggleFavorite } from '../cart/cart-extras';
import type { ViewedItem } from '../cart/cart-extras';

const NICKNAME_KEY = 'sp.nickname';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OrderStep {
  key: string;
  label: string;
}

interface TierTarget {
  name: string;
  need: number;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    RouterLink,
    MoneyPipe,
    SpDatePipe,
    StatusBadgeComponent,
    SkeletonComponent,
    AvatarUploadComponent,
    IconComponent,
  ],
  template: `
    <div class="page-head">
      <div>
        <span class="sp-eyebrow">MY STELLAR · 会员中心</span>
        <h1>个人中心</h1>
        <p class="sp-secondary">管理账户资料、安全设置与会员权益。</p>
      </div>
      <div class="head-side">
        <span class="sp-badge sp-badge--accent">{{ level() }}</span>
        <span class="member-since">加入于 {{ createdAt() | spDate: false }}</span>
      </div>
    </div>

    <section class="member-hero sp-on-dark" aria-labelledby="member-title">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="hero-grid">
        <div class="hero-identity">
          <div class="hero-avatar">
            <img [src]="avatar()" [alt]="displayName() + '的头像'" width="72" height="72" loading="lazy" />
            <span class="tier-chip">{{ level() }}</span>
          </div>
          <div class="hero-copy">
            <span class="hero-kicker">STELLAR MEMBER</span>
            <h2 id="member-title">{{ displayName() }}</h2>
            <p class="hero-mail">{{ accountEmail() || '未绑定邮箱' }}</p>
            <p class="hero-meta">会员编号 <span class="sp-num">{{ memberNo() }}</span> · 加入于 {{ createdAt() | spDate: false }}</p>
            <div class="hero-badges">
              <span><app-icon name="check" [size]="13" /> 账户正常</span>
              @if (accountEmail()) {
                <span><app-icon name="mail" [size]="13" /> 邮箱已绑定</span>
              }
              <span><app-icon name="shield" [size]="13" /> 7 天无理由</span>
            </div>
          </div>
        </div>

        <div class="growth">
          <div class="growth-head">
            <span>成长值</span>
            <strong class="sp-num">{{ growthLabel() }}</strong>
          </div>
          <div
            class="growth-bar"
            role="progressbar"
            aria-label="会员成长值进度"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-valuenow]="growthPercent()"
          >
            <span [style.width.%]="growthPercent()"></span>
          </div>
          <p class="growth-hint">
            @if (nextTier(); as tier) {
              再获得 <strong>{{ tier.need - growthPoints() }}</strong> 成长值升级 {{ tier.name }}
            } @else {
              已达最高等级，感谢一路同行
            }
          </p>
          <div class="benefits">
            <span>全年包邮</span>
            <span>会员日 9 折</span>
            <span>专属客服</span>
            <span>积分抵现</span>
          </div>
        </div>
      </div>

      <dl class="hero-stats">
        <div><dt>累计订单</dt><dd class="sp-num">{{ ordersTotal() }}</dd></div>
        <div><dt>累计消费</dt><dd class="sp-num">{{ lifetimeSpend() | spMoney }}</dd></div>
        <div><dt>可用优惠券</dt><dd class="sp-num">{{ availableCoupons().length }}</dd></div>
        <div><dt>收藏商品</dt><dd class="sp-num">{{ favoriteProducts().length }}</dd></div>
      </dl>
    </section>

    <div class="dash-grid">
      <section class="sp-card sp-card--pad profile" aria-labelledby="profile-title">
        <div class="card-head">
          <div>
            <span class="sp-eyebrow sp-eyebrow--muted">PROFILE</span>
            <h2 id="profile-title">账户资料</h2>
          </div>
          <span class="completeness"><strong class="sp-num">{{ profileCompleteness() }}%</strong> 资料完整度</span>
        </div>

        <div class="profile-grid">
          <div class="avatar-col">
            <app-avatar-upload
              [avatar]="avatar()"
              [name]="displayName()"
              (uploaded)="onAvatar($event)"
            />
          </div>

          <div class="identity">
            <div class="sp-field nickname-field">
              <label class="sp-label" for="profile-nickname">昵称</label>
              <div class="nickname-row">
                <input
                  id="profile-nickname"
                  class="sp-input"
                  type="text"
                  autocomplete="nickname"
                  [value]="nickname()"
                  (input)="onNickname($event)"
                  [attr.aria-invalid]="nicknameError() ? 'true' : null"
                  [attr.aria-describedby]="nicknameError() ? 'profile-nickname-err' : 'profile-nickname-hint'"
                />
                <button class="sp-btn sp-btn--primary" type="button" (click)="saveProfile()">
                  保存资料
                </button>
              </div>
              @if (nicknameError()) {
                <p class="sp-error" id="profile-nickname-err" role="alert">{{ nicknameError() }}</p>
              } @else {
                <p class="sp-hint" id="profile-nickname-hint">昵称在本机生效；等级与注册时间由会员系统维护。</p>
              }
            </div>

            <dl class="meta">
              <div><dt>邮箱</dt><dd class="sp-clamp-1">{{ accountEmail() || '—' }}</dd></div>
              <div><dt>会员等级</dt><dd><span class="sp-badge sp-badge--accent">{{ level() }}</span></dd></div>
              <div><dt>会员编号</dt><dd class="sp-num">{{ memberNo() }}</dd></div>
              <div><dt>注册时间</dt><dd class="sp-num">{{ createdAt() | spDate: false }}</dd></div>
              <div>
                <dt>账号状态</dt>
                <dd>
                  <span class="sp-badge" [class.sp-badge--success]="active()" [class.sp-badge--danger]="!active()">
                    {{ active() ? '正常' : '已停用' }}
                  </span>
                </dd>
              </div>
              <div><dt>资料完整度</dt><dd class="sp-num">{{ profileCompleteness() }}%</dd></div>
            </dl>

            <div
              class="profile-progress"
              role="progressbar"
              aria-label="资料完整度"
              aria-valuemin="0"
              aria-valuemax="100"
              [attr.aria-valuenow]="profileCompleteness()"
            >
              <span [style.width.%]="profileCompleteness()"></span>
            </div>
            <p class="sp-hint">完善头像、昵称与手机号，可提升账户安全评分。</p>
          </div>
        </div>
      </section>

      <div class="dash-rail">
        <section class="sp-card sp-card--pad address-card" aria-labelledby="address-card-title">
          <div class="card-head">
            <div>
              <span class="sp-eyebrow sp-eyebrow--muted">DELIVERY</span>
              <h2 id="address-card-title">默认收货地址</h2>
            </div>
            <a class="sp-link sp-text-12" routerLink="/account/addresses">管理</a>
          </div>
          @if (defaultAddress(); as address) {
            <div class="address-body">
              <span class="address-icon" aria-hidden="true"><app-icon name="map-pin" [size]="18" /></span>
              <div class="address-copy">
                <strong>{{ address.name }} <span class="sp-num phone">{{ maskPhone(address.phone) }}</span></strong>
                <p>{{ address.region }}</p>
                <p>{{ address.detail }}</p>
              </div>
            </div>
            <div class="address-foot">
              <span class="sp-badge sp-badge--accent">默认</span>
              <span class="sp-text-12 sp-muted">预计 2–4 天送达</span>
            </div>
          } @else {
            <div class="address-empty">
              <app-icon name="map-pin" [size]="22" />
              <p>还没有收货地址，添加后结算更方便。</p>
              <a class="sp-btn sp-btn--secondary sp-btn--sm" routerLink="/account/addresses">新增地址</a>
            </div>
          }
        </section>

        <section class="sp-card sp-card--pad score-card" aria-labelledby="score-title">
          <div class="card-head">
            <div>
              <span class="sp-eyebrow sp-eyebrow--muted">SECURITY</span>
              <h2 id="score-title">账户安全</h2>
            </div>
            <span class="score-label">{{ securityLabel() }}</span>
          </div>
          <div class="score-body">
            <div class="score-ring" aria-hidden="true">
              <svg viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" class="ring-track" />
                <circle cx="40" cy="40" r="32" class="ring-value" [attr.stroke-dasharray]="securityDash()" />
              </svg>
              <span class="score-num sp-num">{{ securityScore() }}<small>分</small></span>
            </div>
            <ul class="score-list">
              @for (item of securityItems(); track item.label) {
                <li [class.is-off]="!item.ok">
                  <span class="score-dot" aria-hidden="true"></span>
                  <span class="score-item-label">{{ item.label }}</span>
                  <span class="score-state">{{ item.state }}</span>
                </li>
              }
            </ul>
          </div>
          <a class="score-link" routerLink="/account/profile" fragment="security">
            去完善安全设置 <app-icon name="arrow-right" [size]="13" />
          </a>
        </section>
      </div>
    </div>

    <section class="block" id="security" aria-labelledby="security-title">
      <div class="section-head">
        <div>
          <span class="sp-eyebrow sp-eyebrow--muted">SECURITY</span>
          <h2 id="security-title">安全设置</h2>
        </div>
        <p class="sp-text-13 sp-muted">修改后立即生效，请妥善保管账号信息。</p>
      </div>

      <div class="security-grid">
        <form class="sp-card sp-card--pad" (submit)="saveEmail($event)" novalidate>
          <h3 class="card-title"><app-icon name="mail" [size]="18" /> 修改邮箱</h3>
          <p class="card-desc">邮箱用于接收订单通知与账号提醒，修改后立即生效。</p>

          <div class="current-line">
            <span class="sp-text-12 sp-muted">当前邮箱</span>
            <strong class="sp-clamp-1">{{ accountEmail() || '未绑定' }}</strong>
          </div>

          <div class="sp-field">
            <label class="sp-label" for="account-email">新邮箱<span class="sp-req">*</span></label>
            <input
              id="account-email"
              class="sp-input"
              type="email"
              autocomplete="email"
              placeholder="name@example.com"
              [value]="email()"
              (input)="onEmail($event)"
              [attr.aria-invalid]="emailError() ? 'true' : null"
              [attr.aria-describedby]="emailError() ? 'account-email-err' : null"
            />
            @if (emailError()) {
              <p class="sp-error" id="account-email-err" role="alert">{{ emailError() }}</p>
            }
          </div>

          <div class="mail-state">
            <span class="sp-text-12 sp-muted">绑定状态</span>
            <span class="sp-badge sp-badge--success">已绑定</span>
            <span class="sp-text-12 sp-muted">用于接收订单通知与安全提醒</span>
          </div>

          @if (emailServerError()) {
            <div class="sp-alert sp-alert--error" role="alert">{{ emailServerError() }}</div>
          }

          <button class="sp-btn sp-btn--primary" type="submit" [disabled]="savingEmail()">
            {{ savingEmail() ? '保存中…' : '保存邮箱' }}
          </button>
        </form>

        <form class="sp-card sp-card--pad" (submit)="savePassword($event)" novalidate>
          <h3 class="card-title"><app-icon name="lock" [size]="18" /> 修改密码</h3>
          <p class="card-desc">建议使用字母、数字与符号组合，至少 6 位。</p>

          <div class="sp-field">
            <label class="sp-label" for="pwd-current">当前密码<span class="sp-req">*</span></label>
            <input
              id="pwd-current"
              class="sp-input"
              type="password"
              autocomplete="current-password"
              [value]="currentPassword()"
              (input)="onPassword('current', $event)"
              [attr.aria-invalid]="passwordErrors().current ? 'true' : null"
              [attr.aria-describedby]="passwordErrors().current ? 'pwd-current-err' : null"
            />
            @if (passwordErrors().current) {
              <p class="sp-error" id="pwd-current-err" role="alert">{{ passwordErrors().current }}</p>
            }
          </div>

          <div class="sp-field">
            <label class="sp-label" for="pwd-next">新密码<span class="sp-req">*</span></label>
            <div class="password-row">
              <input
                id="pwd-next"
                class="sp-input"
                [type]="showNewPassword() ? 'text' : 'password'"
                autocomplete="new-password"
                [value]="newPassword()"
                (input)="onPassword('next', $event)"
                [attr.aria-invalid]="passwordErrors().next ? 'true' : null"
                [attr.aria-describedby]="passwordErrors().next ? 'pwd-next-err' : 'pwd-strength'"
              />
              <button
                class="reveal"
                type="button"
                [attr.aria-pressed]="showNewPassword()"
                [attr.aria-label]="showNewPassword() ? '隐藏新密码' : '显示新密码'"
                (click)="showNewPassword.set(!showNewPassword())"
              >
                {{ showNewPassword() ? '隐藏' : '显示' }}
              </button>
            </div>
            @if (passwordErrors().next) {
              <p class="sp-error" id="pwd-next-err" role="alert">{{ passwordErrors().next }}</p>
            }
            <div class="strength" id="pwd-strength">
              <span class="strength-bars" aria-hidden="true">
                @for (bar of strengthBars; track bar) {
                  <span [class.on]="passwordStrength().score >= bar"></span>
                }
              </span>
              <span class="strength-label">{{ passwordStrength().label }}</span>
            </div>
          </div>

          <div class="sp-field">
            <label class="sp-label" for="pwd-confirm">确认新密码<span class="sp-req">*</span></label>
            <input
              id="pwd-confirm"
              class="sp-input"
              type="password"
              autocomplete="new-password"
              [value]="confirmPassword()"
              (input)="onPassword('confirm', $event)"
              [attr.aria-invalid]="passwordErrors().confirm ? 'true' : null"
              [attr.aria-describedby]="passwordErrors().confirm ? 'pwd-confirm-err' : null"
            />
            @if (passwordErrors().confirm) {
              <p class="sp-error" id="pwd-confirm-err" role="alert">{{ passwordErrors().confirm }}</p>
            }
          </div>

          @if (passwordServerError()) {
            <div class="sp-alert sp-alert--error" role="alert">{{ passwordServerError() }}</div>
          }

          <button class="sp-btn sp-btn--primary" type="submit" [disabled]="savingPassword()">
            {{ savingPassword() ? '提交中…' : '更新密码' }}
          </button>
        </form>
      </div>
    </section>

    <section class="block" aria-labelledby="recent-orders-title">
      <div class="section-head">
        <div>
          <span class="sp-eyebrow sp-eyebrow--muted">ORDERS</span>
          <h2 id="recent-orders-title">最近订单</h2>
        </div>
        <a class="sp-link" routerLink="/account/orders">查看全部订单（{{ ordersTotal() }}）</a>
      </div>

      <div class="sp-card orders-card">
        @if (ordersSkeleton()) {
          <div class="skeleton-rows">
            @for (row of skeletonRows; track row) {
              <app-skeleton variant="line" width="100%" />
            }
          </div>
        } @else if (ordersError()) {
          <div class="sp-alert sp-alert--error" role="alert">
            <span class="sp-grow">{{ ordersError() }}</span>
            <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="loadOrders()">重试</button>
          </div>
        } @else if (orders().length === 0) {
          <div class="inline-empty">
            <p class="sp-secondary">还没有订单，去挑几件喜欢的吧。</p>
            <a class="sp-btn sp-btn--primary sp-btn--sm" routerLink="/category/all">去逛逛</a>
          </div>
        } @else {
          @for (order of orders(); track order.id) {
            <a class="order-row" [routerLink]="['/account/orders', order.id]">
              <div class="thumbs">
                @for (item of order.items.slice(0, 3); track item.productId) {
                  <img [src]="item.image" [alt]="item.title" width="44" height="44" loading="lazy" />
                }
              </div>
              <div class="order-meta">
                <span class="order-top">
                  <span class="order-no sp-num">订单 {{ order.id }}</span>
                  <span class="order-date sp-text-12 sp-muted">{{ order.createdAt | spDate }}</span>
                </span>
                <span class="order-items sp-clamp-1">{{ orderSummary(order) }}</span>
                @if (orderStepIndex(order.status) >= 0) {
                  <ol class="mini-timeline" [attr.aria-label]="'订单 ' + order.id + ' 进度'">
                    @for (step of orderSteps; track step.key; let i = $index) {
                      <li [class.on]="orderStepIndex(order.status) >= i">
                        <span class="mini-dot" aria-hidden="true"></span>{{ step.label }}
                      </li>
                    }
                  </ol>
                }
              </div>
              <div class="order-side">
                <app-status-badge [status]="order.status" />
                <span class="order-total sp-num">{{ order.total | spMoney }}</span>
              </div>
              <app-icon name="chevron-right" [size]="16" />
            </a>
          }
        }
      </div>
    </section>

    <section class="block" aria-labelledby="coupons-title">
      <div class="section-head">
        <div>
          <span class="sp-eyebrow sp-eyebrow--muted">COUPON WALLET</span>
          <h2 id="coupons-title">优惠券钱包</h2>
        </div>
        <span class="sp-text-13 sp-muted">{{ availableCoupons().length }} 张可用</span>
      </div>

      <div class="wallet-head">
        <div class="wallet-total">
          <span>可用券面额</span>
          <strong class="sp-num">{{ couponTotalValue() | spMoney }}</strong>
        </div>
        <div class="wallet-tabs" role="group" aria-label="优惠券筛选">
          <button type="button" [attr.aria-pressed]="couponTab() === 'available'" (click)="couponTab.set('available')">
            可用 {{ availableCoupons().length }}
          </button>
          <button type="button" [attr.aria-pressed]="couponTab() === 'used'" (click)="couponTab.set('used')">
            已使用 {{ usedCoupons().length }}
          </button>
        </div>
      </div>

      @if (couponsSkeleton()) {
        <div class="coupon-grid">
          @for (row of skeletonRows; track row) {
            <div class="sp-card sp-card--pad"><app-skeleton variant="line" width="80%" /></div>
          }
        </div>
      } @else if (couponsError()) {
        <div class="sp-alert sp-alert--error" role="alert">
          <span class="sp-grow">{{ couponsError() }}</span>
          <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="loadCoupons()">重试</button>
        </div>
      } @else if (visibleCoupons().length === 0) {
        <div class="sp-card inline-empty">
          <p class="sp-secondary">{{ couponTab() === 'used' ? '还没有已使用的优惠券。' : '还没有可用的优惠券，会员日记得来领。' }}</p>
          <a class="sp-btn sp-btn--secondary sp-btn--sm" routerLink="/about" fragment="member">了解会员权益</a>
        </div>
      } @else {
        <div class="coupon-grid">
          @for (coupon of visibleCoupons(); track coupon.id) {
            <article class="coupon" [class.coupon--used]="coupon.used">
              <div class="coupon-value sp-num">{{ couponValue(coupon) }}</div>
              <div class="coupon-body">
                <div class="coupon-top">
                  <strong>{{ coupon.title }}</strong>
                  @if (coupon.used) {
                    <span class="sp-badge coupon-badge">已使用</span>
                  } @else {
                    <span class="sp-badge sp-badge--success coupon-badge">可使用</span>
                  }
                </div>
                <p class="sp-text-12 sp-muted">{{ couponThreshold(coupon) }}</p>
                @if (coupon.description) {
                  <p class="sp-text-12 sp-muted">{{ coupon.description }}</p>
                }
                <p class="sp-text-12 sp-muted">有效期至 {{ coupon.expiresAt | spDate: false }}</p>
                <div class="coupon-foot">
                  <span class="coupon-code sp-num">{{ couponCode(coupon) }}</span>
                  @if (!coupon.used) {
                    <a class="coupon-use" routerLink="/cart">去使用</a>
                  }
                </div>
              </div>
            </article>
          }
        </div>
      }
    </section>

    <section class="block" aria-labelledby="activity-title">
      <div class="section-head">
        <div>
          <span class="sp-eyebrow sp-eyebrow--muted">YOUR PICKS</span>
          <h2 id="activity-title">最近浏览与收藏</h2>
        </div>
        <a class="sp-link sp-text-13" routerLink="/category/all">继续逛</a>
      </div>

      <div class="sp-card activity-card">
        <div class="activity-tabs" role="group" aria-label="浏览与收藏筛选">
          <button type="button" [attr.aria-pressed]="activityTab() === 'viewed'" (click)="activityTab.set('viewed')">
            最近浏览 {{ viewed().length }}
          </button>
          <button type="button" [attr.aria-pressed]="activityTab() === 'favorites'" (click)="activityTab.set('favorites')">
            我的收藏 {{ favoriteProducts().length }}
          </button>
        </div>

        @if (activityTab() === 'viewed') {
          @if (viewed().length === 0) {
            <div class="activity-empty">
              <app-icon name="clock" [size]="22" />
              <p>还没有浏览记录，去逛逛把喜欢的商品带回来。</p>
              <a class="sp-btn sp-btn--secondary sp-btn--sm" routerLink="/category/all">去逛逛</a>
            </div>
          } @else {
            <ul class="activity-grid">
              @for (item of viewed().slice(0, 4); track item.productId) {
                <li class="activity-item">
                  <a class="activity-link" [routerLink]="['/product', item.productId]">
                    <img [src]="item.image" alt="" width="72" height="72" loading="lazy" />
                    <span class="activity-title sp-clamp-2">{{ item.title }}</span>
                    <small>最近查看</small>
                  </a>
                </li>
              }
            </ul>
          }
        } @else {
          @if (favoriteProducts().length === 0) {
            <div class="activity-empty">
              <app-icon name="heart" [size]="22" />
              <p>还没有收藏商品，点商品卡上的心形即可收藏。</p>
              <a class="sp-btn sp-btn--secondary sp-btn--sm" routerLink="/category/all">去逛逛</a>
            </div>
          } @else {
            <ul class="activity-grid">
              @for (product of favoriteProducts().slice(0, 4); track product.id) {
                <li class="activity-item">
                  <a class="activity-link" [routerLink]="['/product', product.id]">
                    <img [src]="product.image" alt="" width="72" height="72" loading="lazy" />
                    <span class="activity-title sp-clamp-2">{{ product.title }}</span>
                  </a>
                  <div class="activity-foot">
                    <span class="activity-price sp-num">{{ product.price | spMoney }}</span>
                    <button
                      class="activity-remove"
                      type="button"
                      [attr.aria-label]="'取消收藏 ' + product.title"
                      (click)="removeFavorite(product)"
                    >
                      <app-icon name="heart" [size]="14" /> 已收藏
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        }
      </div>
    </section>
  `,
  styles: [
    `
      .page-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px 16px;
        padding-bottom: 20px;
        flex-wrap: wrap;
      }
      .page-head h1 { font-family: var(--sp-serif); font-size: 34px; letter-spacing: .02em; }
      .page-head p { margin-top: 4px; }
      .head-side { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .member-since { font-size: 12px; color: var(--sp-text-muted); }

      .member-hero {
        position: relative;
        overflow: hidden;
        border-radius: var(--sp-radius-lg);
        background: var(--sp-primary);
        color: #fff;
        padding: 24px 26px 0;
        box-shadow: var(--sp-shadow-md);
      }
      .hero-glow {
        position: absolute;
        right: -120px;
        top: -150px;
        width: 340px;
        height: 340px;
        border-radius: 50%;
        border: 1px solid rgba(232, 163, 61, .22);
        box-shadow: 0 0 0 40px rgba(232, 163, 61, .05), 0 0 0 90px rgba(232, 163, 61, .03);
        pointer-events: none;
      }
      .hero-grid {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(250px, .85fr);
        gap: 32px;
        align-items: center;
      }
      .hero-identity { display: flex; align-items: center; gap: 18px; min-width: 0; }
      .hero-avatar { position: relative; flex: 0 0 auto; }
      .hero-avatar img {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid rgba(255, 255, 255, .32);
        background: var(--sp-bg);
      }
      .tier-chip {
        position: absolute;
        left: 50%;
        bottom: -8px;
        transform: translateX(-50%);
        padding: 1px 8px;
        border-radius: var(--sp-radius-pill);
        background: var(--sp-accent);
        color: var(--sp-primary);
        font-size: 10px;
        font-weight: 800;
        white-space: nowrap;
      }
      .hero-copy { min-width: 0; }
      .hero-kicker { font-size: 9.5px; letter-spacing: .2em; color: rgba(255, 255, 255, .62); }
      .hero-copy h2 { color: #fff; font-family: var(--sp-serif); font-size: 26px; margin-top: 2px; }
      .hero-mail { font-size: 12px; color: rgba(255, 255, 255, .78); margin-top: 2px; }
      .hero-meta { font-size: 11px; color: rgba(255, 255, 255, .64); margin-top: 2px; }
      .hero-badges { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px; margin-top: 12px; }
      .hero-badges span { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: rgba(255, 255, 255, .82); }
      .hero-badges app-icon { color: var(--sp-accent-strong); }

      .growth { padding-left: 28px; border-left: 1px solid rgba(255, 255, 255, .16); }
      .growth-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 12px; color: rgba(255, 255, 255, .72); }
      .growth-head strong { font-size: 24px; color: var(--sp-accent-strong); line-height: 1.1; }
      .growth-bar { height: 6px; margin-top: 8px; border-radius: 999px; background: rgba(255, 255, 255, .16); overflow: hidden; }
      .growth-bar span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--sp-accent) 0%, var(--sp-accent-strong) 100%); }
      .growth-hint { font-size: 11px; color: rgba(255, 255, 255, .7); margin-top: 7px; }
      .growth-hint strong { color: var(--sp-accent-strong); }
      .benefits { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
      .benefits span {
        padding: 2px 8px;
        border-radius: 3px;
        border: 1px solid rgba(255, 255, 255, .18);
        color: rgba(255, 255, 255, .8);
        font-size: 10.5px;
      }
      .hero-stats {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0;
        margin: 22px -26px 0;
        padding: 14px 26px;
        border-top: 1px solid rgba(255, 255, 255, .14);
        background: rgba(0, 0, 0, .12);
      }
      .hero-stats > div { display: flex; flex-direction: column; gap: 1px; padding-left: 18px; border-left: 1px solid rgba(255, 255, 255, .12); }
      .hero-stats > div:first-child { padding-left: 0; border-left: 0; }
      .hero-stats dt { font-size: 10.5px; color: rgba(255, 255, 255, .62); }
      .hero-stats dd { margin: 0; font-size: 18px; font-weight: 700; color: #fff; }

      .dash-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.45fr) minmax(280px, .8fr);
        gap: 20px;
        align-items: stretch;
        margin-top: 20px;
      }
      .dash-rail { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
      .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
      .card-head h2 { font-size: var(--sp-text-18); }
      .completeness { font-size: 11px; color: var(--sp-text-muted); white-space: nowrap; }
      .completeness strong { color: var(--sp-accent-text); font-size: 14px; }

      .profile-grid {
        display: grid;
        grid-template-columns: minmax(190px, 230px) minmax(0, 1fr);
        gap: 24px;
        align-items: start;
      }
      .avatar-col { padding-top: 2px; }
      .identity { min-width: 0; }
      .nickname-row { display: flex; gap: 12px; align-items: center; }
      .nickname-row .sp-input { flex: 1 1 auto; min-width: 0; }
      .nickname-row .sp-btn { flex: 0 0 auto; min-height: 44px; }
      .meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 20px;
        margin: 8px 0 0;
        padding-top: 14px;
        border-top: 1px solid var(--sp-border);
      }
      .meta > div { min-width: 0; }
      .meta dt { font-size: var(--sp-text-12); color: var(--sp-text-muted); }
      .meta dd { margin: 2px 0 0; font-size: var(--sp-text-13); font-weight: 600; }
      .profile-progress { height: 5px; margin-top: 14px; border-radius: 999px; background: var(--sp-paper-deep); overflow: hidden; }
      .profile-progress span { display: block; height: 100%; background: var(--sp-sage); border-radius: inherit; }
      .identity > .sp-hint { margin-top: 5px; }

      .address-card, .score-card { display: flex; flex-direction: column; }
      .address-body { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
      .address-icon { width: 34px; height: 34px; border-radius: 50%; background: #FBF0DC; color: var(--sp-accent-text); display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
      .address-copy { min-width: 0; }
      .address-copy strong { font-size: 13.5px; }
      .address-copy p { font-size: 12px; color: var(--sp-text-secondary); line-height: 1.5; overflow-wrap: anywhere; }
      .address-copy .phone { margin-left: 4px; font-weight: 400; color: var(--sp-text-muted); }
      .address-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--sp-border); }
      .address-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; color: var(--sp-text-muted); font-size: 12px; }
      .address-empty app-icon { color: var(--sp-text-muted); }
      .address-empty .sp-btn { min-height: 40px; }

      .score-label { font-size: 11px; font-weight: 700; color: var(--sp-sage); padding: 1px 7px; border-radius: 999px; background: var(--sp-success-soft); }
      .score-body { display: flex; align-items: center; gap: 16px; }
      .score-ring { position: relative; width: 80px; height: 80px; flex: 0 0 auto; }
      .score-ring svg { width: 80px; height: 80px; transform: rotate(-90deg); }
      .ring-track { fill: none; stroke: var(--sp-paper-deep); stroke-width: 7; }
      .ring-value { fill: none; stroke: var(--sp-sage); stroke-width: 7; stroke-linecap: round; }
      .score-num { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: var(--sp-primary); }
      .score-num small { font-size: 10px; font-weight: 600; color: var(--sp-text-muted); margin-left: 1px; }
      .score-list { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; min-width: 0; flex: 1 1 auto; }
      .score-list li { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--sp-text-secondary); }
      .score-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sp-sage); flex: 0 0 auto; }
      .score-list li.is-off .score-dot { background: var(--sp-border-strong); }
      .score-item-label { min-width: 0; flex: 1 1 auto; }
      .score-state { color: var(--sp-sage); font-size: 10.5px; white-space: nowrap; }
      .score-list li.is-off .score-state { color: var(--sp-text-muted); }
      .score-link { display: inline-flex; align-items: center; gap: 4px; margin-top: auto; padding-top: 10px; min-height: 44px; font-size: 12px; font-weight: 600; color: var(--sp-info); }
      .score-link:hover { text-decoration: underline; }

      .block { margin-top: 32px; }
      .section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      .section-head h2 { font-size: var(--sp-text-18); }

      .security-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
        align-items: stretch;
      }
      .security-grid form { display: flex; flex-direction: column; min-width: 0; }
      .security-grid form > .sp-btn { margin-top: auto; align-self: flex-start; min-height: 44px; }
      .card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--sp-text-16);
        margin-bottom: 4px;
      }
      .card-title app-icon { color: var(--sp-accent-text); }
      .card-desc { font-size: var(--sp-text-13); color: var(--sp-text-secondary); margin-bottom: 16px; }
      .current-line {
        display: flex;
        flex-direction: column;
        min-width: 0;
        gap: 2px;
        padding: 10px 12px;
        margin-bottom: 16px;
        border: 1px dashed var(--sp-border-strong);
        border-radius: var(--sp-radius-sm);
        background: var(--sp-bg);
      }
      .current-line strong { font-size: var(--sp-text-14); min-width: 0; }
      .mail-state { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
      .sp-alert { margin-bottom: 12px; }
      .password-row { display: flex; align-items: center; gap: 8px; }
      .password-row .sp-input { flex: 1 1 auto; min-width: 0; }
      .reveal { min-height: 44px; padding: 0 8px; border: 0; background: transparent; color: var(--sp-info); font-size: 12px; font-weight: 600; flex: 0 0 auto; }
      .reveal:hover { text-decoration: underline; }
      .strength { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
      .strength-bars { display: flex; gap: 3px; flex: 0 0 auto; }
      .strength-bars span { width: 26px; height: 4px; border-radius: 999px; background: var(--sp-paper-deep); }
      .strength-bars span.on { background: var(--sp-sage); }
      .strength-label { font-size: 11px; color: var(--sp-text-muted); }

      .orders-card { overflow: hidden; }
      .skeleton-rows { display: flex; flex-direction: column; gap: 16px; padding: 20px 24px; }
      .inline-empty { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 24px; flex-wrap: wrap; }
      .order-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 16px;
        padding: 14px 20px;
        border-bottom: 1px solid var(--sp-border);
        color: var(--sp-text);
      }
      .order-row:last-child { border-bottom: 0; }
      .order-row:hover { background: #FCFAF6; }
      .thumbs { display: flex; gap: 6px; }
      .thumbs img {
        width: 44px; height: 44px; border-radius: var(--sp-radius-sm);
        object-fit: cover; background: var(--sp-bg); border: 1px solid var(--sp-border);
      }
      .order-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .order-top { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
      .order-no { font-weight: 600; font-size: var(--sp-text-13); }
      .order-date { white-space: nowrap; }
      .order-items { font-size: var(--sp-text-12); color: var(--sp-text-secondary); }
      .mini-timeline { display: flex; align-items: center; gap: 0; margin: 3px 0 0; padding: 0; list-style: none; }
      .mini-timeline li { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--sp-text-muted); white-space: nowrap; }
      .mini-timeline li + li::before { content: ''; width: 14px; height: 1px; background: var(--sp-border); margin: 0 3px; }
      .mini-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sp-border-strong); }
      .mini-timeline li.on { color: var(--sp-text-secondary); }
      .mini-timeline li.on .mini-dot { background: var(--sp-sage); }
      .order-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: 0 0 auto; }
      .order-total { color: var(--sp-accent-text); font-weight: 700; }

      .wallet-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
        padding: 12px 16px;
        border: 1px solid var(--sp-border);
        border-radius: var(--sp-radius-md);
        background: #FFFDF8;
      }
      .wallet-total { display: flex; align-items: baseline; gap: 8px; }
      .wallet-total span { font-size: 11px; color: var(--sp-text-muted); }
      .wallet-total strong { font-size: 20px; color: var(--sp-accent-text); }
      .wallet-tabs { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--sp-border); border-radius: 6px; background: var(--sp-surface); }
      .wallet-tabs button { min-height: 44px; padding: 0 10px; border: 0; border-radius: 4px; background: transparent; color: var(--sp-text-secondary); font-size: 12px; font-weight: 600; }
      .wallet-tabs button[aria-pressed='true'] { background: var(--sp-primary); color: #fff; }

      .coupon-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .coupon {
        display: flex;
        align-items: stretch;
        gap: 0;
        background: var(--sp-surface);
        border: 1px solid var(--sp-border);
        border-radius: var(--sp-radius-md);
        box-shadow: var(--sp-shadow-sm);
        overflow: hidden;
      }
      .coupon--used { opacity: .72; }
      .coupon-value {
        display: flex; align-items: center; justify-content: center;
        min-width: 94px; padding: 0 10px;
        color: var(--sp-accent-text); font-size: 25px; font-weight: 800;
        background: #FFFBF3;
        border-right: 1px dashed var(--sp-border-strong);
      }
      .coupon--used .coupon-value { color: var(--sp-text-muted); background: var(--sp-bg); }
      .coupon-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 14px; flex: 1 1 auto; }
      .coupon-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .coupon-title { font-size: var(--sp-text-14); }
      .coupon-badge { align-self: flex-start; flex: 0 0 auto; }
      .coupon-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--sp-border); }
      .coupon-code { font-size: 10.5px; letter-spacing: .04em; color: var(--sp-text-muted); }
      .coupon-use { display: inline-flex; align-items: center; min-height: 44px; font-size: var(--sp-text-12); font-weight: 700; color: var(--sp-info); }
      .coupon-use:hover { text-decoration: underline; }

      .activity-card { padding: 16px 20px 20px; }
      .activity-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--sp-border); margin-bottom: 14px; }
      .activity-tabs button {
        min-height: 44px;
        padding: 0 12px;
        border: 0;
        border-bottom: 2px solid transparent;
        background: transparent;
        color: var(--sp-text-secondary);
        font-size: 13px;
        font-weight: 600;
      }
      .activity-tabs button[aria-pressed='true'] { color: var(--sp-primary); border-bottom-color: var(--sp-accent); }
      .activity-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
      .activity-item { border: 1px solid var(--sp-border); border-radius: 8px; background: #FFFDF8; padding: 10px; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
      .activity-link { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .activity-link img { width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 6px; border: 1px solid var(--sp-border); background: #F1EEE8; }
      .activity-title { font-size: 12px; font-weight: 600; line-height: 1.4; min-height: 34px; }
      .activity-link small { font-size: 10.5px; color: var(--sp-text-muted); }
      .activity-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
      .activity-price { font-size: 13px; font-weight: 700; color: var(--sp-accent-text); }
      .activity-remove { display: inline-flex; align-items: center; gap: 2px; min-height: 44px; padding: 0 4px; border: 0; background: transparent; color: #9A4E2C; font-size: 10.5px; font-weight: 600; }
      .activity-remove:hover { text-decoration: underline; }
      .activity-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 0 4px; color: var(--sp-text-muted); font-size: 12px; }
      .activity-empty app-icon { color: var(--sp-text-muted); }
      .activity-empty .sp-btn { min-height: 40px; }

      @media (max-width: 1180px) {
        .dash-grid { grid-template-columns: 1fr; }
        .dash-rail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; }
      }
      @media (max-width: 1023px) {
        .hero-grid { grid-template-columns: 1fr; gap: 18px; }
        .growth { padding-left: 0; padding-top: 16px; border-left: 0; border-top: 1px solid rgba(255, 255, 255, .16); }
        .profile-grid { grid-template-columns: minmax(0, 1fr); gap: 20px; }
        .security-grid { grid-template-columns: minmax(0, 1fr); }
        .coupon-grid { grid-template-columns: minmax(0, 1fr); }
        .activity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 767px) {
        .page-head h1 { font-size: 28px; }
        .member-hero { padding: 20px 18px 0; }
        .hero-copy h2 { font-size: 22px; }
        .hero-stats { margin: 18px -18px 0; padding: 12px 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 0; }
        .hero-stats > div:nth-child(3) { padding-left: 0; border-left: 0; }
        .dash-rail { grid-template-columns: 1fr; }
        .meta { grid-template-columns: 1fr; gap: 8px; }
        .order-row { grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; padding: 14px 16px; }
        .order-side { grid-column: 3; grid-row: 1; align-items: flex-end; }
        .order-row > app-icon { display: none; }
        .wallet-head { flex-direction: column; align-items: flex-start; }
        .wallet-tabs { width: 100%; }
        .wallet-tabs button { flex: 1 1 0; }
        .activity-card { padding: 12px 14px 16px; }
        .activity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .nickname-row { flex-direction: column; align-items: stretch; }
      }
      @media (max-width: 480px) {
        .page-head { flex-direction: column; }
        .hero-identity { align-items: flex-start; gap: 12px; }
        .hero-avatar img { width: 60px; height: 60px; }
        .hero-badges { gap: 4px 10px; }
        .hero-stats dd { font-size: 16px; }
        .coupon-value { min-width: 78px; font-size: 21px; }
        .activity-grid { grid-template-columns: 1fr; }
        .activity-title { min-height: 0; }
      }
    `,
  ],
})
export class ProfilePage {
  readonly auth = inject(AuthStore);
  private readonly accountApi = inject(AccountApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly toast = inject(ToastService);

  readonly displayName = computed(() => this.auth.user()?.name || '星澜会员');
  readonly level = computed(() => this.auth.user()?.level || '星澜会员');
  readonly avatar = computed(() => normalizeAvatar(this.auth.user()?.avatar));
  readonly createdAt = signal<string | undefined>(undefined);
  readonly active = signal(true);
  readonly ordersTotal = signal(0);
  private readonly profileEmail = signal<string | null>(null);
  readonly accountEmail = computed(() => this.profileEmail() || this.auth.user()?.email || '');
  readonly memberNo = computed(() => 'SP-' + String(this.auth.user()?.id ?? 0).padStart(6, '0'));

  readonly nickname = signal('');
  readonly nicknameError = signal<string | null>(null);
  private readonly nicknameTouched = signal(false);

  readonly email = signal('');
  readonly emailError = signal<string | null>(null);
  readonly emailServerError = signal<string | null>(null);
  readonly savingEmail = signal(false);
  private readonly emailTouched = signal(false);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly showNewPassword = signal(false);
  readonly passwordErrors = signal<{ current?: string; next?: string; confirm?: string }>({});
  readonly passwordServerError = signal<string | null>(null);
  readonly savingPassword = signal(false);
  readonly strengthBars = [1, 2, 3, 4];

  readonly orders = signal<Order[]>([]);
  readonly ordersSkeleton = signal(false);
  readonly ordersError = signal<string | null>(null);
  readonly ordersRequestId = signal<string | undefined>(undefined);

  readonly allOrders = signal<Order[]>([]);
  readonly addresses = signal<Address[]>([]);
  readonly viewed = signal<ViewedItem[]>([]);
  readonly favoriteProducts = signal<Product[]>([]);
  readonly favoriteIds = signal<number[]>([]);
  readonly activityTab = signal<'viewed' | 'favorites'>('viewed');

  readonly coupons = signal<Coupon[]>([]);
  readonly couponsSkeleton = signal(false);
  readonly couponsError = signal<string | null>(null);
  readonly couponsRequestId = signal<string | undefined>(undefined);
  readonly couponTab = signal<'available' | 'used'>('available');

  readonly skeletonRows = [1, 2, 3];
  readonly orderSteps: OrderStep[] = [
    { key: 'pending_payment', label: '待付款' },
    { key: 'pending_shipment', label: '待发货' },
    { key: 'shipped', label: '已发货' },
    { key: 'completed', label: '已完成' },
  ];

  readonly lifetimeSpend = computed(() =>
    this.allOrders()
      .filter((order) => order.status !== 'cancelled' && order.status !== 'pending_payment')
      .reduce((sum, order) => sum + Number(order.total ?? 0), 0),
  );
  readonly growthPoints = computed(() => Math.round(this.lifetimeSpend()));
  readonly growthLabel = computed(() => this.growthPoints().toLocaleString('zh-CN'));
  readonly nextTier = computed<TierTarget | null>(() => {
    const points = this.growthPoints();
    if (points < 1000) {
      return { name: '银卡会员', need: 1000 };
    }
    if (points < 3000) {
      return { name: '金卡会员', need: 3000 };
    }
    if (points < 8000) {
      return { name: '黑卡会员', need: 8000 };
    }
    return null;
  });
  readonly growthPercent = computed(() => {
    const tier = this.nextTier();
    if (!tier) {
      return 100;
    }
    return Math.max(0, Math.min(100, Math.round((this.growthPoints() / tier.need) * 100)));
  });
  readonly profileCompleteness = computed(() => {
    let score = 40;
    if (this.accountEmail()) {
      score += 20;
    }
    if (this.nickname().trim()) {
      score += 15;
    }
    if (this.avatar() !== DEFAULT_AVATAR) {
      score += 15;
    }
    if (this.auth.user()?.phone) {
      score += 10;
    }
    return Math.min(100, score);
  });
  readonly securityScore = computed(() => {
    let score = 40;
    if (this.accountEmail()) {
      score += 30;
    }
    if (this.auth.user()?.phone) {
      score += 20;
    }
    if (this.avatar() !== DEFAULT_AVATAR) {
      score += 10;
    }
    return Math.min(100, score);
  });
  readonly securityLabel = computed(() => {
    const score = this.securityScore();
    if (score >= 90) {
      return '优秀';
    }
    if (score >= 70) {
      return '良好';
    }
    return '待提升';
  });
  readonly securityDash = computed(() => {
    const circumference = 2 * Math.PI * 32;
    return ((this.securityScore() / 100) * circumference).toFixed(2) + ' ' + circumference.toFixed(2);
  });
  readonly securityItems = computed(() => [
    { label: '邮箱绑定', state: this.accountEmail() ? '已绑定' : '未绑定', ok: !!this.accountEmail() },
    { label: '登录密码', state: '已设置', ok: true },
    { label: '手机绑定', state: this.auth.user()?.phone ? '已绑定' : '未绑定', ok: !!this.auth.user()?.phone },
    { label: '二次验证', state: '未开启', ok: false },
  ]);
  readonly passwordStrength = computed(() => {
    const value = this.newPassword();
    if (!value) {
      return { score: 0, label: '至少 6 位' };
    }
    let score = 0;
    if (value.length >= 6) {
      score += 1;
    }
    if (value.length >= 10) {
      score += 1;
    }
    if (/[A-Za-z]/.test(value) && /\d/.test(value)) {
      score += 1;
    }
    if (/[^A-Za-z0-9]/.test(value)) {
      score += 1;
    }
    const labels = ['偏弱', '偏弱', '一般', '较强', '很强'];
    return { score, label: labels[score] };
  });
  readonly defaultAddress = computed(
    () => this.addresses().find((address) => address.isDefault) ?? this.addresses()[0] ?? null,
  );
  readonly availableCoupons = computed(() => this.coupons().filter((coupon) => !coupon.used));
  readonly usedCoupons = computed(() => this.coupons().filter((coupon) => coupon.used));
  readonly visibleCoupons = computed(() =>
    this.couponTab() === 'available' ? this.availableCoupons() : this.usedCoupons(),
  );
  readonly couponTotalValue = computed(() =>
    this.availableCoupons().reduce(
      (sum, coupon) => sum + (coupon.type === 'percent' ? 0 : Number(coupon.amount ?? 0)),
      0,
    ),
  );

  constructor() {
    const storedNickname = this.readStoredNickname(this.auth.user()?.id);
    if (storedNickname) {
      this.auth.merge({ name: storedNickname });
    }
    const user = this.auth.user();
    this.nickname.set(user?.name ?? '');
    this.email.set(user?.email ?? '');

    effect(() => {
      const current = this.auth.user();
      if (!current) {
        return;
      }
      if (!this.nicknameTouched()) {
        this.nickname.set(current.name ?? '');
      }
      if (!this.emailTouched()) {
        this.email.set(current.email ?? '');
      }
    });

    this.loadProfile();
    this.loadOrders();
    this.loadAllOrders();
    this.loadCoupons();
    this.loadAddresses();
    this.loadActivity();
  }

  loadProfile(): void {
    const id = this.auth.user()?.id;
    if (!id) {
      return;
    }
    this.accountApi.profile(id).subscribe({
      next: (profile) => {
        this.createdAt.set(profile.createdAt);
        this.active.set(profile.active);
        this.profileEmail.set(profile.email || null);
        const avatar = normalizeAvatar(profile.avatar);
        if (profile.avatar && avatar !== this.auth.user()?.avatar) {
          this.auth.merge({ avatar });
        }
        if (!this.emailTouched() && profile.email) {
          this.email.set(profile.email);
        }
      },
      error: () => undefined,
    });
  }

  loadAllOrders(): void {
    this.ordersApi.list(undefined, 1, 100).subscribe({
      next: (result) => this.allOrders.set(result.items ?? []),
      error: () => undefined,
    });
  }

  loadAddresses(): void {
    this.accountApi.addresses().subscribe({
      next: (items) => this.addresses.set(items ?? []),
      error: () => this.addresses.set([]),
    });
  }

  loadActivity(): void {
    this.viewed.set(readViewed(this.auth.user()));
    const ids = readFavorites(this.auth.user());
    this.favoriteIds.set(ids);
    if (ids.length === 0) {
      this.favoriteProducts.set([]);
      return;
    }
    this.productsApi.list({ page: 1, size: 100 }).subscribe({
      next: (result) => {
        const byId = new Map((result.items ?? []).map((product) => [product.id, product]));
        this.favoriteProducts.set(
          ids.map((id) => byId.get(id)).filter((product): product is Product => !!product),
        );
      },
      error: () => this.favoriteProducts.set([]),
    });
  }

  removeFavorite(product: Product): void {
    toggleFavorite(this.auth.user(), product.id);
    this.favoriteIds.set(readFavorites(this.auth.user()));
    this.favoriteProducts.update((list) => list.filter((entry) => entry.id !== product.id));
    this.toast.show('已取消收藏', 'info');
  }

  onNickname(event: Event): void {
    this.nicknameTouched.set(true);
    this.nickname.set((event.target as HTMLInputElement).value);
    this.nicknameError.set(null);
  }

  saveProfile(): void {
    const name = this.nickname().trim();
    if (!name) {
      this.nicknameError.set('昵称不能为空，请填写一个称呼。');
      return;
    }
    try {
      const userId = this.auth.user()?.id;
      localStorage.setItem(userId ? NICKNAME_KEY + '.' + userId : NICKNAME_KEY, name);
    } catch {
      // storage can be unavailable; the in-memory profile still updates
    }
    this.auth.merge({ name });
    this.nickname.set(name);
    this.nicknameTouched.set(false);
    this.toast.show('资料已保存');
  }

  onAvatar(url: string): void {
    this.auth.merge({ avatar: url });
  }

  onEmail(event: Event): void {
    this.emailTouched.set(true);
    this.email.set((event.target as HTMLInputElement).value);
    this.emailError.set(null);
    this.emailServerError.set(null);
  }

  saveEmail(event: Event): void {
    event.preventDefault();
    const email = this.email().trim();
    if (!EMAIL_RE.test(email)) {
      this.emailError.set('邮箱格式不正确，例如 name@example.com');
      return;
    }
    this.emailError.set(null);
    this.emailServerError.set(null);
    this.savingEmail.set(true);
    // V08: plain POST to /api/account/email, no CSRF token, no Origin check.
    this.accountApi.updateEmail(email).subscribe({
      next: (token) => {
        this.savingEmail.set(false);
        this.emailTouched.set(false);
        this.profileEmail.set(email);
        if (token) {
          this.auth.applyToken(token);
        } else {
          this.auth.merge({ email });
        }
        this.toast.show('邮箱已更新');
      },
      error: (err) => {
        this.savingEmail.set(false);
        this.emailServerError.set(errorMessage(err));
      },
    });
  }

  onPassword(field: 'current' | 'next' | 'confirm', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'current') {
      this.currentPassword.set(value);
    } else if (field === 'next') {
      this.newPassword.set(value);
    } else {
      this.confirmPassword.set(value);
    }
    this.passwordErrors.update((errors) => ({ ...errors, [field]: undefined }));
    this.passwordServerError.set(null);
  }

  savePassword(event: Event): void {
    event.preventDefault();
    const errors: { current?: string; next?: string; confirm?: string } = {};
    if (!this.currentPassword()) {
      errors.current = '请输入当前密码。';
    }
    if (this.newPassword().length < 6) {
      errors.next = '新密码至少 6 位。';
    }
    if (this.confirmPassword() !== this.newPassword()) {
      errors.confirm = '两次输入的新密码不一致。';
    }
    this.passwordErrors.set(errors);
    if (errors.current || errors.next || errors.confirm) {
      return;
    }

    this.passwordServerError.set(null);
    this.savingPassword.set(true);
    this.accountApi.changePassword(this.currentPassword(), this.newPassword()).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.passwordErrors.set({});
        this.toast.show('密码已更新');
      },
      error: (err) => {
        this.savingPassword.set(false);
        this.passwordServerError.set(errorMessage(err));
      },
    });
  }

  loadOrders(): void {
    this.ordersError.set(null);
    this.ordersRequestId.set(undefined);
    this.ordersSkeleton.set(false);
    const timer = setTimeout(() => this.ordersSkeleton.set(true), 300);
    this.ordersApi.list(undefined, 1, 3).subscribe({
      next: (result) => {
        clearTimeout(timer);
        this.ordersSkeleton.set(false);
        this.orders.set(result.items ?? []);
        this.ordersTotal.set(result.total ?? 0);
      },
      error: (err) => {
        clearTimeout(timer);
        this.ordersSkeleton.set(false);
        this.ordersError.set(errorMessage(err));
        this.ordersRequestId.set(errorRequestId(err));
      },
    });
  }

  loadCoupons(): void {
    this.couponsError.set(null);
    this.couponsRequestId.set(undefined);
    this.couponsSkeleton.set(false);
    const timer = setTimeout(() => this.couponsSkeleton.set(true), 300);
    this.accountApi.coupons().subscribe({
      next: (coupons) => {
        clearTimeout(timer);
        this.couponsSkeleton.set(false);
        this.coupons.set(coupons ?? []);
      },
      error: (err) => {
        clearTimeout(timer);
        this.couponsSkeleton.set(false);
        this.couponsError.set(errorMessage(err));
        this.couponsRequestId.set(errorRequestId(err));
      },
    });
  }

  orderSummary(order: Order): string {
    const first = order.items[0];
    const count = this.countItems(order);
    if (!first) {
      return '共 ' + count + ' 件商品';
    }
    return first.title + ' · 共 ' + count + ' 件';
  }

  countItems(order: Order): number {
    return (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
  }

  orderStepIndex(status: string): number {
    switch (status) {
      case 'pending_payment':
        return 0;
      case 'pending_shipment':
        return 1;
      case 'shipped':
        return 2;
      case 'completed':
        return 3;
      default:
        return -1;
    }
  }

  couponValue(coupon: Coupon): string {
    if (coupon.type === 'percent') {
      const raw = coupon.value ?? 0;
      const discount = raw <= 1 ? Math.round(raw * 100) / 10 : raw;
      return discount + '折';
    }
    return '¥' + coupon.amount;
  }

  couponThreshold(coupon: Coupon): string {
    return coupon.minSpend > 0 ? '满 ¥' + coupon.minSpend + ' 可用' : '无门槛，直接可用';
  }

  couponCode(coupon: Coupon): string {
    return 'SP' + String(coupon.id).padStart(4, '0');
  }

  maskPhone(phone: string): string {
    const value = String(phone ?? '');
    return value.length >= 7 ? value.slice(0, 3) + '****' + value.slice(-4) : value;
  }

  private readStoredNickname(userId?: number): string | null {
    try {
      return localStorage.getItem(userId ? NICKNAME_KEY + '.' + userId : NICKNAME_KEY);
    } catch {
      return null;
    }
  }
}
