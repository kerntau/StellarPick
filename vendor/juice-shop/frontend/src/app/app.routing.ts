/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { RouterModule, type Routes, type UrlMatchResult, type UrlSegment } from '@angular/router'
import { AccountingGuard, LoginGuard } from './app.guard'
import { authGuard, merchantGuard } from './stellarpick/core/auth/auth.guard'

const loadFaucetModule = async () => {
  const module = await import('./faucet/faucet.module')
  return module.FaucetModule
}
const loadWeb3WalletModule = async () => {
  const module = await import('./wallet-web3/wallet-web3.module')
  return module.WalletWeb3Module
}

const loadWeb3SandboxModule = async () => {
  const module = await import('./web3-sandbox/web3-sandbox.module')
  return module.Web3SandboxModule
}

const loadCodingChallenge = async () => {
  const module = await import('./coding-challenge-page/coding-challenge-page.component')
  return module.CodingChallengePageComponent
}

const loadRecycleComponent = async () => {
  const module = await import('./recycle/recycle.component')
  return module.RecycleComponent
}

// vuln-code-snippet start adminSectionChallenge scoreBoardChallenge web3SandboxChallenge
const routes: Routes = [
  // ---- StellarPick storefront (ported from the reference implementation) ----
  {
    path: '',
    pathMatch: 'full',
    loadComponent: async () => (await import('./stellarpick/features/home/home.page')).HomePage
  },
  {
    path: 'category/:slug',
    loadComponent: async () => (await import('./stellarpick/features/catalog/category.page')).CategoryPage
  },
  {
    path: 'search',
    loadComponent: async () => (await import('./stellarpick/features/catalog/search.page')).SearchPage
  },
  {
    path: 'product/:id',
    loadComponent: async () => (await import('./stellarpick/features/catalog/product.page')).ProductPage
  },
  {
    path: 'cart',
    loadComponent: async () => (await import('./stellarpick/features/cart/cart.page')).CartPage
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: async () => (await import('./stellarpick/features/checkout/checkout.page')).CheckoutPage
  },
  {
    path: 'login',
    loadComponent: async () => (await import('./stellarpick/features/auth/login.page')).LoginPage
  },
  {
    path: 'register',
    loadComponent: async () => (await import('./stellarpick/features/auth/register.page')).RegisterPage
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: async () => (await import('./stellarpick/features/account/account.layout')).AccountLayout,
    children: [
      { path: '', pathMatch: 'full', loadComponent: async () => (await import('./stellarpick/features/account/profile.page')).ProfilePage },
      { path: 'profile', loadComponent: async () => (await import('./stellarpick/features/account/profile.page')).ProfilePage },
      { path: 'addresses', loadComponent: async () => (await import('./stellarpick/features/account/addresses.page')).AddressesPage },
      { path: 'orders', loadComponent: async () => (await import('./stellarpick/features/account/orders.page')).OrdersPage },
      { path: 'orders/:id', loadComponent: async () => (await import('./stellarpick/features/account/order-detail.page')).OrderDetailPage },
      { path: 'reviews', loadComponent: async () => (await import('./stellarpick/features/account/reviews.page')).ReviewsPage }
    ]
  },
  {
    path: 'support/tickets',
    loadComponent: async () => (await import('./stellarpick/features/support/tickets.page')).TicketsPage
  },
  {
    path: 'support/tickets/:id',
    loadComponent: async () => (await import('./stellarpick/features/support/ticket-detail.page')).TicketDetailPage
  },
  {
    path: 'merchant',
    canActivate: [merchantGuard],
    loadComponent: async () => (await import('./stellarpick/features/merchant/merchant.layout')).MerchantLayout,
    children: [
      { path: '', pathMatch: 'full', loadComponent: async () => (await import('./stellarpick/features/merchant/dashboard.page')).MerchantDashboardPage },
      { path: 'products', loadComponent: async () => (await import('./stellarpick/features/merchant/products.page')).MerchantProductsPage },
      { path: 'orders', loadComponent: async () => (await import('./stellarpick/features/merchant/orders.page')).MerchantOrdersPage }
    ]
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: async () => (await import('./stellarpick/features/admin/admin.layout')).AdminLayout,
    children: [
      { path: '', pathMatch: 'full', loadComponent: async () => (await import('./stellarpick/features/admin/dashboard.page')).AdminDashboardPage },
      { path: 'users', loadComponent: async () => (await import('./stellarpick/features/admin/users.page')).AdminUsersPage },
      { path: 'merchants', loadComponent: async () => (await import('./stellarpick/features/admin/merchants.page')).AdminMerchantsPage }
    ]
  },
  {
    path: 'about',
    loadComponent: async () => (await import('./stellarpick/features/static/about.page')).AboutPage
  },
  {
    path: 'help',
    loadComponent: async () => (await import('./stellarpick/features/static/help.page')).HelpPage
  },
  {
    path: 'privacy',
    loadComponent: async () => (await import('./stellarpick/features/static/privacy.page')).PrivacyPage
  },
  {
    path: 'terms',
    loadComponent: async () => (await import('./stellarpick/features/static/terms.page')).TermsPage
  },
  {
    path: '404',
    loadComponent: async () => (await import('./stellarpick/features/static/not-found.page')).NotFoundPage
  },
  {
    path: 'administration',
    redirectTo: '/admin/users',
    pathMatch: 'full'
  },
  {
    path: 'accounting',
    loadComponent: async () => (await import('./accounting/accounting.component')).AccountingComponent,
    canActivate: [AccountingGuard]
  },
  {
    path: 'address/select',
    loadComponent: async () => (await import('./address-select/address-select.component')).AddressSelectComponent,
    canActivate: [LoginGuard]
  },
  {
    path: 'address/saved',
    loadComponent: async () => (await import('./saved-address/saved-address.component')).SavedAddressComponent,
    canActivate: [LoginGuard]
  },
  {
    path: 'address/create',
    loadComponent: async () => (await import('./address-create/address-create.component')).AddressCreateComponent,
    canActivate: [LoginGuard]
  },
  {
    path: 'address/edit/:addressId',
    loadComponent: async () => (await import('./address-create/address-create.component')).AddressCreateComponent,
    canActivate: [LoginGuard]
  },
  {
    path: 'delivery-method',
    loadComponent: async () => (await import('./delivery-method/delivery-method.component')).DeliveryMethodComponent
  },
  {
    path: 'deluxe-membership',
    loadComponent: async () => (await import('./deluxe-user/deluxe-user.component')).DeluxeUserComponent,
    canActivate: [LoginGuard]
  },
  {
    path: 'saved-payment-methods',
    loadComponent: async () => (await import('./saved-payment-methods/saved-payment-methods.component')).SavedPaymentMethodsComponent
  },
  {
    path: 'basket',
    loadComponent: async () => (await import('./basket/basket.component')).BasketComponent
  },
  {
    path: 'order-completion/:id',
    loadComponent: async () => (await import('./order-completion/order-completion.component')).OrderCompletionComponent
  },
  {
    path: 'contact',
    loadComponent: async () => (await import('./contact/contact.component')).ContactComponent
  },
  {
    path: 'photo-wall',
    loadComponent: async () => (await import('./photo-wall/photo-wall.component')).PhotoWallComponent
  },
  {
    path: 'complain',
    loadComponent: async () => (await import('./complaint/complaint.component')).ComplaintComponent
  },
  {
    path: 'order-summary',
    loadComponent: async () => (await import('./order-summary/order-summary.component')).OrderSummaryComponent
  },
  {
    path: 'order-history',
    redirectTo: '/account/orders',
    pathMatch: 'full'
  },
  {
    // Historical alias: /product/:id/reviews opens the product page's review tab.
    path: 'product/:id/reviews',
    loadComponent: async () => (await import('./stellarpick/features/catalog/product.page')).ProductPage
  },
  {
    path: 'payment/:entity',
    loadComponent: async () => (await import('./payment/payment.component')).PaymentComponent
  },
  {
    path: 'wallet',
    loadComponent: async () => (await import('./wallet/wallet.component')).WalletComponent
  },
  {
    path: 'forgot-password',
    loadComponent: async () => (await import('./forgot-password/forgot-password.component')).ForgotPasswordComponent
  },
  {
    path: 'recycle',
    loadComponent: async () => await loadRecycleComponent()
  },
  {
    path: 'hacking-instructor',
    loadComponent: async () => (await import('./search-result/search-result.component')).SearchResultComponent
  },
  { // vuln-code-snippet neutral-line scoreBoardChallenge
    path: 'score-board', // vuln-code-snippet vuln-line scoreBoardChallenge
    loadComponent: async () => (await import('./score-board/score-board.component')).ScoreBoardComponent // vuln-code-snippet neutral-line scoreBoardChallenge
  }, // vuln-code-snippet neutral-line scoreBoardChallenge
  {
    path: 'track-result',
    loadComponent: async () => (await import('./track-result/track-result.component')).TrackResultComponent
  },
  {
    path: 'track-result/new',
    loadComponent: async () => (await import('./track-result/track-result.component')).TrackResultComponent,
    data: {
      type: 'new'
    }
  },
  {
    path: '2fa/enter',
    loadComponent: async () => (await import('./two-factor-auth-enter/two-factor-auth-enter.component')).TwoFactorAuthEnterComponent
  },
  {
    path: 'privacy-security',
    loadComponent: async () => (await import('./privacy-security/privacy-security.component')).PrivacySecurityComponent,
    children: [
      {
        path: 'privacy-policy',
        loadComponent: async () => (await import('./privacy-policy/privacy-policy.component')).PrivacyPolicyComponent
      },
      {
        path: 'change-password',
        loadComponent: async () => (await import('./change-password/change-password.component')).ChangePasswordComponent
      },
      {
        path: 'two-factor-authentication',
        loadComponent: async () => (await import('./two-factor-auth/two-factor-auth.component')).TwoFactorAuthComponent
      },
      {
        path: 'passkeys',
        loadComponent: async () => (await import('./manage-passkeys/manage-passkeys.component')).ManagePasskeysComponent,
        canActivate: [LoginGuard]
      },
      {
        path: 'data-export',
        loadComponent: async () => (await import('./data-export/data-export.component')).DataExportComponent
      },
      {
        path: 'last-login-ip',
        loadComponent: async () => (await import('./last-login-ip/last-login-ip.component')).LastLoginIpComponent
      }
    ]
  },
  {
    path: 'juicy-nft',
    loadComponent: async () => (await import('./nft-unlock/nft-unlock.component')).NFTUnlockComponent
  },
  {
    path: 'wallet-web3',
    loadChildren: async () => await loadWeb3WalletModule()
  },
  { // vuln-code-snippet neutral-line web3SandboxChallenge
    path: 'web3-sandbox', // vuln-code-snippet vuln-line web3SandboxChallenge
    loadChildren: async () => await loadWeb3SandboxModule() // vuln-code-snippet neutral-line web3SandboxChallenge
  }, // vuln-code-snippet neutral-line web3SandboxChallenge
  {
    path: 'chatbot',
    loadComponent: async () => (await import('./chatbot/chatbot.component')).ChatbotComponent,
    children: [
      { path: '', loadComponent: async () => (await import('./chatbot/chat-welcome-page/chat-welcome-page.component')).ChatWelcomePageComponent },
      { path: 'conversation/:id', loadComponent: async () => (await import('./chatbot/chat-conversation/chat-conversation.component')).ChatConversationComponent }
    ]
  },
  {
    path: 'bee-haven',
    loadChildren: async () => await loadFaucetModule()
  },
  // vuln-code-snippet start tokenSaleChallenge
  {
    matcher: oauthMatcher,
    data: { params: (window.location.href).substr(window.location.href.indexOf('#')) },
    loadComponent: async () => (await import('./oauth/oauth.component')).OAuthComponent
  },
  { // vuln-code-snippet neutral-line tokenSaleChallenge
    matcher: tokenMatcher, // vuln-code-snippet vuln-line tokenSaleChallenge
    loadComponent: async () => (await import('./token-sale/token-sale.component')).TokenSaleComponent // vuln-code-snippet neutral-line tokenSaleChallenge
  }, // vuln-code-snippet neutral-line tokenSaleChallenge
  {
    path: 'coding-challenge/:challengeKey',
    loadComponent: async () => await loadCodingChallenge()
  },
  {
    path: '403',
    loadComponent: async () => (await import('./error-page/error-page.component')).ErrorPageComponent
  },
  {
    path: '**',
    loadComponent: async () => (await import('./stellarpick/features/static/not-found.page')).NotFoundPage
  }
]
// vuln-code-snippet end adminSectionChallenge scoreBoardChallenge web3SandboxChallenge

export const Routing = RouterModule.forRoot(routes, { useHash: true })

export function oauthMatcher (url: UrlSegment[]): UrlMatchResult {
  if (url.length === 0) {
    return null as unknown as UrlMatchResult
  }
  const path = window.location.href
  if (path.includes('#access_token=')) {
    return ({ consumed: url })
  }

  return null as unknown as UrlMatchResult
}

export function tokenMatcher (url: UrlSegment[]): UrlMatchResult { // vuln-code-snippet neutral-line tokenSaleChallenge
  if (url.length === 0) { // vuln-code-snippet neutral-line tokenSaleChallenge
    return null as unknown as UrlMatchResult // vuln-code-snippet neutral-line tokenSaleChallenge
  } // vuln-code-snippet neutral-line tokenSaleChallenge
 // vuln-code-snippet neutral-line tokenSaleChallenge
  const path = url[0].toString() // vuln-code-snippet neutral-line tokenSaleChallenge

  if (path.match((token1(25, 184, 174, 179, 182, 186) + (36669).toString(36).toLowerCase() + token2(13, 144, 87, 152, 139, 144, 83, 138) + (10).toString(36).toLowerCase()))) { // vuln-code-snippet vuln-line tokenSaleChallenge
    return ({ consumed: url }) // vuln-code-snippet neutral-line tokenSaleChallenge
  } // vuln-code-snippet neutral-line tokenSaleChallenge
 // vuln-code-snippet neutral-line tokenSaleChallenge
  return null as unknown as UrlMatchResult // vuln-code-snippet neutral-line tokenSaleChallenge
} // vuln-code-snippet neutral-line tokenSaleChallenge

export function token1 (...args: number[]) { // vuln-code-snippet neutral-line tokenSaleChallenge
  const L = Array.prototype.slice.call(args) // vuln-code-snippet neutral-line tokenSaleChallenge
  const D = L.shift() // vuln-code-snippet neutral-line tokenSaleChallenge
  return L.reverse().map(function (C, A) { // vuln-code-snippet neutral-line tokenSaleChallenge
    return String.fromCharCode(C - D - 45 - A) // vuln-code-snippet neutral-line tokenSaleChallenge
  }).join('') // vuln-code-snippet neutral-line tokenSaleChallenge
} // vuln-code-snippet neutral-line tokenSaleChallenge

export function token2 (...args: number[]) { // vuln-code-snippet neutral-line tokenSaleChallenge
  const T = Array.prototype.slice.call(arguments) // vuln-code-snippet neutral-line tokenSaleChallenge
  const M = T.shift() // vuln-code-snippet neutral-line tokenSaleChallenge
  return T.reverse().map(function (m, H) { // vuln-code-snippet neutral-line tokenSaleChallenge
    return String.fromCharCode(m - M - 24 - H) // vuln-code-snippet neutral-line tokenSaleChallenge
  }).join('') // vuln-code-snippet neutral-line tokenSaleChallenge
} // vuln-code-snippet neutral-line tokenSaleChallenge
// vuln-code-snippet end tokenSaleChallenge
