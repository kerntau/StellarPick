import { Component, inject } from '@angular/core'
import { Router, RouterLink } from '@angular/router'

@Component({
  selector: 'app-sp-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sp-404">
      <p class="code">404</p>
      <h1>页面走丢了</h1>
      <p class="hint">你访问的页面不存在，或者已经被移走。回首页看看，或搜索你想要的商品。</p>
      <form class="search" (submit)="$event.preventDefault(); search($event)">
        <input name="q" placeholder="搜索保温杯、四件套、充电器…" aria-label="搜索商品" />
        <button type="submit">搜索</button>
      </form>
      <div class="actions">
        <a class="btn" routerLink="/">回首页</a>
        <a class="btn secondary" routerLink="/account/orders">我的订单</a>
      </div>
      <p class="legal">星澜优选 Demo · 演示备案号 XLP-DEMO-2026 · 客服 400-000-0000</p>
    </div>
  `,
  styles: [`
    .sp-404 { max-width: 640px; margin: 80px auto; padding: 40px; background: #fff; border: 1px solid #E4E7EC; border-radius: 12px; text-align: center; font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif; color: #0F1720; }
    .code { color: #8A5A00; font-size: 64px; font-weight: 800; line-height: 1; margin: 0 0 8px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    .hint { color: #475467; margin: 0 0 24px; }
    .search { display: flex; gap: 8px; margin: 0 auto 20px; max-width: 420px; }
    .search input { flex: 1; height: 42px; border: 1px solid #D0D5DD; border-radius: 6px; padding: 0 12px; font-size: 14px; }
    .search button { height: 42px; padding: 0 18px; border: 0; border-radius: 6px; background: #0B2545; color: #fff; cursor: pointer; }
    .actions { display: flex; gap: 12px; justify-content: center; }
    .btn { display: inline-flex; align-items: center; height: 40px; padding: 0 20px; border-radius: 6px; background: #0B2545; color: #fff; text-decoration: none; font-size: 14px; }
    .btn.secondary { background: #fff; color: #0B2545; border: 1px solid #D0D5DD; }
    .legal { margin-top: 32px; color: #667085; font-size: 12px; }
  `]
})
export class SpNotFoundComponent {
  private readonly router = inject(Router)
  search (event: Event): void {
    const input = (event.target as HTMLFormElement).querySelector('input') as HTMLInputElement
    const q = input.value.trim()
    if (q) this.router.navigate(['/search'], { queryParams: { q } })
  }
}