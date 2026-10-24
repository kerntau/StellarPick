import { Component, inject, signal } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { ActivatedRoute, RouterLink } from '@angular/router'

interface Review { id?: string; author: string; message: string; likesCount?: number }

@Component({
  selector: 'app-sp-reviews',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sp-reviews">
      <a class="back" routerLink="/">← 返回商城</a>
      <header>
        <p class="eyebrow">商品评价</p>
        <h1>全部评价</h1>
        <p class="sub">评价正文按原始 HTML 渲染（V04）。</p>
      </header>

      @if (loading()) {
        <p class="muted">正在加载评价…</p>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (reviews().length === 0) {
        <div class="notice">还没有评价。</div>
      } @else {
        <ul class="list">
          @for (review of reviews(); track review.author + $index) {
            <li class="card">
              <div class="meta"><strong>{{ review.author }}</strong><span>{{ review.likesCount || 0 }} 人觉得有用</span></div>
              <div class="body" [innerHTML]="safe(review.message)"></div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .sp-reviews { max-width: 820px; margin: 32px auto 64px; padding: 0 24px; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .back { color: #475467; text-decoration: none; font-size: 13px; }
    .eyebrow { color: #8A5A00; font-size: 12px; font-weight: 700; letter-spacing: .12em; margin: 20px 0 4px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #475467; margin: 0 0 20px; font-size: 13px; }
    .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
    .card { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 18px 20px; }
    .meta { display: flex; justify-content: space-between; color: #667085; font-size: 12px; margin-bottom: 8px; }
    .meta strong { color: #0F1720; font-size: 14px; }
    .body { font-size: 14px; line-height: 1.7; }
    .notice, .error { background: #fff; border: 1px solid #E4E7EC; border-radius: 8px; padding: 20px; }
    .error { background: #FBEAE8; color: #8E2A20; }
    .muted { color: #667085; }
  `]
})
export class SpReviewsComponent {
  private readonly http = inject(HttpClient)
  private readonly route = inject(ActivatedRoute)
  private readonly sanitizer = inject(DomSanitizer)
  readonly reviews = signal<Review[]>([])
  readonly loading = signal(true)
  readonly error = signal('')

  constructor () {
    const id = this.route.snapshot.paramMap.get('id')
    this.http.get<{ data: Review[] }>('/rest/products/' + id + '/reviews').subscribe({
      next: (res) => { this.reviews.set(res.data ?? []); this.loading.set(false) },
      error: () => { this.error.set('评价加载失败，请稍后重试'); this.loading.set(false) }
    })
  }

  // V04: raw HTML, no sanitization.
  safe (body: string): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(body) }
}
