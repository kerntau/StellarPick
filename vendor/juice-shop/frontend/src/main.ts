/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { enableProdMode, importProvidersFrom, provideZoneChangeDetection } from '@angular/core'

import { environment } from './environments/environment'
import { AppComponent } from './app/app.component'
import { MatSnackBarModule } from '@angular/material/snack-bar'
import { MatDialogModule } from '@angular/material/dialog'
import { MatNativeDateModule } from '@angular/material/core'

import { TranslateModule, provideTranslateService } from '@ngx-translate/core'
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader'
import { Routing } from './app/app.routing'
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser'
import { AdminGuard, LoginGuard, AccountingGuard, DeluxeGuard } from './app/app.guard'
import { CookieService, CookieModule } from 'ngy-cookie'
import { RequestInterceptor } from './app/Services/request.interceptor'
import { HTTP_INTERCEPTORS, withInterceptors, withInterceptorsFromDi, provideHttpClient } from '@angular/common/http'
import { authInterceptor } from './app/stellarpick/core/interceptors/auth.interceptor'

if (environment.production) {
    enableProdMode()
}

// Root providers only carry what the eagerly bootstrapped shell and root-scoped
// services need. Legacy page/feature modules are route-level lazy components and
// import their own Angular Material modules, so they are intentionally not
// registered here. MatSnackBar/MatDialog/MatNativeDate stay because root-scoped
// services and several lazy pages inject those providers from the root injector.
bootstrapApplication(AppComponent, {
    providers: [
        provideZoneChangeDetection(),
        importProvidersFrom(BrowserModule, Routing, TranslateModule.forRoot(), CookieModule.forRoot(), MatSnackBarModule, MatDialogModule, MatNativeDateModule),
        {
            provide: HTTP_INTERCEPTORS,
            useClass: RequestInterceptor,
            multi: true
        },
        CookieService,
        AdminGuard,
        LoginGuard,
        AccountingGuard,
        DeluxeGuard,
        provideHttpClient(withInterceptorsFromDi(), withInterceptors([authInterceptor])),
        provideTranslateService({
          loader: provideTranslateHttpLoader({
            prefix: '/assets/i18n/',
            suffix: '.json'
          }),
          fallbackLang: 'en'
        })
    ]
})
    .catch((err: Error) => console.log(err))
