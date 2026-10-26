/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Component, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core'
import { NavigationEnd, Router, RouterOutlet } from '@angular/router'
import { Title } from '@angular/platform-browser'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { filter } from 'rxjs/operators'
import { HeaderComponent } from './stellarpick/shared/layout/header/header.component'
import { FooterComponent } from './stellarpick/shared/layout/footer/footer.component'
import { ToastHostComponent } from './stellarpick/shared/ui/toast-host/toast-host.component'

const TITLES: [string, string][] = [
  ['category', '分类 · 星澜优选'],
  ['search', '搜索结果 · 星澜优选'],
  ['product', '商品详情 · 星澜优选'],
  ['cart', '购物车 · 星澜优选'],
  ['checkout', '结算 · 星澜优选'],
  ['login', '登录 · 星澜优选'],
  ['register', '注册 · 星澜优选'],
  ['account/orders', '我的订单 · 星澜优选'],
  ['account/addresses', '收货地址 · 星澜优选'],
  ['account/reviews', '我的评价 · 星澜优选'],
  ['account', '个人中心 · 星澜优选'],
  ['support/tickets', '客服工单 · 星澜优选'],
  ['merchant/products', '商品管理 · 星澜优选'],
  ['merchant/orders', '订单管理 · 星澜优选'],
  ['merchant', '商家工作台 · 星澜优选'],
  ['admin/users', '用户管理 · 星澜优选'],
  ['admin/merchants', '商家审核 · 星澜优选'],
  ['admin', '平台后台 · 星澜优选'],
  ['about', '关于我们 · 星澜优选'],
  ['help', '帮助中心 · 星澜优选'],
  ['privacy', '隐私政策 · 星澜优选'],
  ['terms', '服务条款 · 星澜优选'],
  ['404', '页面走丢了 · 星澜优选'],
]

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [HeaderComponent, FooterComponent, ToastHostComponent, RouterOutlet]
})
export class AppComponent {
  private readonly router = inject(Router)
  private readonly title = inject(Title)
  private readonly destroyRef = inject(DestroyRef)
  private lastPath = ''

  constructor () {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.title.setTitle(this.titleFor(this.router.url))
        // Only a path change is a new page. Query/fragment-only navigations
        // (filters, sorting, pagination, anchors) must keep the user's focus
        // on the control they just used.
        const path = this.router.url.split('?')[0].split('#')[0]
        if (path === this.lastPath) {
          return
        }
        this.lastPath = path
        // Move keyboard/screen-reader focus to the new page's main landmark so
        // narration follows the route instead of the destroyed previous view.
        const main = document.getElementById('main-content')
        if (main) {
          main.setAttribute('tabindex', '-1')
          main.focus({ preventScroll: true })
        }
      })
  }

  private titleFor (url: string): string {
    const path = url.split('?')[0].split('#')[0].replace(/^\/+/, '')
    if (!path) {
      return '星澜优选 · 把日常，选得更好'
    }
    const match = TITLES.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'))
    return match ? match[1] : '页面走丢了 · 星澜优选'
  }
}
