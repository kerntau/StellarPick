import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MerchantApi } from '../../core/api/merchant.api';
import { MerchantProduct, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { MerchantIconComponent } from './components/merchant-icon.component';
import { OPS_CSS } from './ops-ui';

interface ProductForm {
  title: string;
  price: string;
  image: string;
  status: string;
}

interface FormErrors {
  title?: string;
  price?: string;
}

interface SavedView {
  id: string;
  name: string;
  q: string;
  status: string;
  category: string;
}

const FALLBACK_IMAGE = '/assets/sp/img/products/1001.svg';
const IMAGE_BASE = '/assets/public/images/products/';
const VIEWS_KEY = 'sp.merchant.products.views.v1';

const CATEGORY_LABELS: Record<string, string> = {
  all: '其他',
  kitchen: '厨房',
  home: '家居',
  personal: '个护',
  digital: '数码',
  travel: '出行',
  food: '食品',
};

/** 商家商品管理：保存筛选视图 + 批量上下架 + 紧凑表格 + 右侧编辑抽屉。 */
@Component({
  selector: 'app-merchant-products',
  standalone: true,
  imports: [
    MerchantIconComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ModalComponent,
    PaginationComponent,
    MoneyPipe,
  ],
  template: `
    <section class="ops-page">
      <header class="ops-head">
        <div>
          <p class="ops-eyebrow">Catalog · 商品运营</p>
          <h2>商品管理</h2>
          <p class="ops-sub">维护商品标题、价格、主图与上下架状态，保存后即时生效。</p>
          <div class="ops-meta">
            <span>共 <b class="sp-num">{{ products().length }}</b> 件</span>
            <span>在售 <b class="sp-num">{{ onSaleCount() }}</b></span>
            <span>已下架 <b class="sp-num">{{ offSaleCount() }}</b></span>
            <span>最近同步 <b class="sp-num">{{ syncedAt() || '—' }}</b></span>
          </div>
        </div>
        <div class="ops-actions">
          <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="load()" [disabled]="loading()">
            <app-merchant-icon name="refresh" [size]="16" />
            {{ loading() ? '刷新中…' : '刷新' }}
          </button>
          <button class="sp-btn sp-btn--primary sp-btn--sm" type="button" (click)="openCreate()">
            <app-merchant-icon name="plus" [size]="16" />
            新增商品
          </button>
        </div>
      </header>

      @if (error()) {
        <app-error-state [message]="error()" [requestId]="requestId()" (retry)="load()" />
      }

      <div class="ops-card">
        <div class="ops-toolbar">
          <div class="ops-search">
            <app-merchant-icon name="search" [size]="16" />
            <input
              id="product-q"
              class="sp-input"
              type="search"
              autocomplete="off"
              placeholder="搜索商品名称或编号"
              aria-label="搜索商品名称或编号"
              [value]="q()"
              (input)="onQueryInput($event)"
            />
          </div>
          <select class="sp-select" aria-label="按状态筛选" (change)="onStatusFilter($event)">
            @for (option of statusOptions; track option.value) {
              <option [value]="option.value" [selected]="statusFilter() === option.value">{{ option.label }}</option>
            }
          </select>
          <select class="sp-select" aria-label="按分类筛选" (change)="onCategoryFilter($event)">
            @for (option of categoryOptions; track option.value) {
              <option [value]="option.value" [selected]="categoryFilter() === option.value">{{ option.label }}</option>
            }
          </select>
          <div class="ops-toolbar-end">
            <span class="ops-count sp-num">{{ total() }} / {{ products().length }} 件</span>
            <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="resetFilters()" [disabled]="!hasFilters()">
              清空筛选
            </button>
          </div>
        </div>

        <div class="ops-chips">
          <span class="chips-label">筛选</span>
          @if (q().trim()) {
            <span class="ops-chip"><span>关键词 <strong>{{ q().trim() }}</strong></span>
              <button type="button" aria-label="清除关键词筛选" (click)="clearQuery()">
                <app-merchant-icon name="x" [size]="13" />
              </button>
            </span>
          }
          @if (statusFilter()) {
            <span class="ops-chip"><span>状态 <strong>{{ statusLabel(statusFilter()) }}</strong></span>
              <button type="button" aria-label="清除状态筛选" (click)="clearStatus()">
                <app-merchant-icon name="x" [size]="13" />
              </button>
            </span>
          }
          @if (categoryFilter()) {
            <span class="ops-chip"><span>分类 <strong>{{ categoryName(categoryFilter()) }}</strong></span>
              <button type="button" aria-label="清除分类筛选" (click)="clearCategory()">
                <app-merchant-icon name="x" [size]="13" />
              </button>
            </span>
          }
          @if (!hasFilters()) {
            <span class="chips-empty">未设置筛选</span>
          }

          <span class="chips-divider" aria-hidden="true"></span>
          <span class="chips-label">已保存</span>
          @for (view of views(); track view.id) {
            <span class="ops-chip ops-chip--view" [class.is-active]="isViewActive(view)">
              <button type="button" (click)="applyView(view)" [attr.aria-pressed]="isViewActive(view)">
                {{ view.name }}
              </button>
              <button type="button" [attr.aria-label]="'删除筛选视图 ' + view.name" (click)="removeView(view)">
                <app-merchant-icon name="x" [size]="12" />
              </button>
            </span>
          }
          <button class="ops-chip-add" type="button" (click)="saveView()" [disabled]="!hasFilters()">
            <app-merchant-icon name="bookmark" [size]="13" />
            保存当前筛选
          </button>
        </div>

        @if (selectedCount() > 0) {
          <div class="ops-bulk">
            <span>已选 <strong class="sp-num">{{ selectedCount() }}</strong> 件商品</span>
            <div class="ops-toolbar-end">
              <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" [disabled]="bulkBusy()" (click)="bulkUpdate('on_sale')">
                {{ bulkBusy() ? '处理中…' : '批量上架' }}
              </button>
              <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" [disabled]="bulkBusy()" (click)="bulkUpdate('off_sale')">
                批量下架
              </button>
              <button class="sp-btn sp-btn--ghost sp-btn--sm" type="button" (click)="clearSelection()">取消选择</button>
            </div>
          </div>
        }

        @if (showSkeleton()) {
          <div class="skeleton-rows" aria-hidden="true">
            @for (row of skeletonRows; track row) {
              <div class="sp-skeleton ops-skeleton-row"></div>
            }
          </div>
        } @else if (total() > 0) {
          <div class="ops-table-wrap">
            <table class="ops-table product-table">
              <caption>本店商品，共 {{ total() }} 件{{ hasFilters() ? '（已筛选）' : '' }}</caption>
              <thead>
                <tr>
                  <th scope="col" class="sel">
                    <label class="ops-check-hit">
                      <input
                        class="ops-check"
                        type="checkbox"
                        [checked]="allPageSelected()"
                        (change)="togglePageSelection($event)"
                        aria-label="选择本页全部商品"
                      />
                    </label>
                  </th>
                  <th scope="col">商品</th>
                  <th scope="col" class="num">售价</th>
                  <th scope="col" class="num">库存</th>
                  <th scope="col" class="num">销量</th>
                  <th scope="col">状态</th>
                  <th scope="col" class="actions">操作</th>
                </tr>
              </thead>
              <tbody>
                @for (product of pagedProducts(); track product.id) {
                  <tr [class.is-selected]="isSelected(product.id)">
                    <td class="sel">
                      <label class="ops-check-hit">
                        <input
                          class="ops-check"
                          type="checkbox"
                          [checked]="isSelected(product.id)"
                          (change)="toggleSelect(product.id)"
                          [attr.aria-label]="'选择商品 ' + product.title"
                        />
                      </label>
                    </td>
                    <td>
                      <div class="ops-cell-main">
                        <img
                          class="ops-thumb"
                          [src]="product.image"
                          alt=""
                          width="36"
                          height="36"
                          loading="lazy"
                          decoding="async"
                          (error)="fallbackImage($event)"
                        />
                        <span class="ops-cell-text">
                          <strong [title]="product.title">{{ product.title }}</strong>
                          <small>#{{ product.id }} · {{ categoryName(product.category) }}</small>
                        </span>
                      </div>
                    </td>
                    <td class="num price">{{ product.price | spMoney }}</td>
                    <td class="num">{{ product.stock }}</td>
                    <td class="num">{{ product.sales }}</td>
                    <td>
                      <span class="state" [class.state--on]="product.status === 'on_sale'">
                        <span class="state-dot" aria-hidden="true"></span>
                        {{ product.status === 'on_sale' ? '在售' : '已下架' }}
                      </span>
                    </td>
                    <td class="actions">
                      <div class="ops-row-actions">
                        <button class="sp-btn sp-btn--ghost sp-btn--sm" type="button" (click)="openEdit(product)">编辑</button>
                        <button
                          class="sp-btn sp-btn--ghost sp-btn--sm"
                          type="button"
                          [disabled]="togglingId() === product.id"
                          (click)="toggleStatus(product)"
                        >
                          {{ product.status === 'on_sale' ? '下架' : '上架' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (!error()) {
          @if (products().length === 0) {
            <app-empty-state
              image="search"
              title="还没有商品"
              description="新增第一件商品后，它会立即出现在前台店铺中。"
              actionLabel="新增商品"
              (action)="openCreate()"
            />
          } @else {
            <app-empty-state
              image="search"
              title="没有匹配的商品"
              description="换个关键词，或清空状态与分类筛选后再试。"
              actionLabel="清空筛选"
              (action)="resetFilters()"
            />
          }
        }
      </div>

      @if (total() > 0) {
        <p class="ops-scroll-hint">左右滑动可查看完整表格</p>
        <app-pagination
          [page]="page()"
          [size]="size()"
          [total]="total()"
          (pageChange)="changePage($event)"
          (sizeChange)="changeSize($event)"
        />
      }
    </section>

    <app-modal [open]="modalOpen()" [title]="editing() ? '编辑商品' : '新增商品'" variant="right" (closed)="closeModal()">
      <form class="ops-drawer" (submit)="save($event)">
        @if (editing(); as product) {
          <div class="preview">
            <img [src]="form().image || fallbackImageUrl" alt="" width="64" height="64" loading="lazy" (error)="fallbackImage($event)" />
            <div class="preview-text">
              <strong>{{ form().title || product.title }}</strong>
              <small>#{{ product.id }} · {{ categoryName(product.category) }} · 销量 {{ product.sales }}</small>
              <span class="state" [class.state--on]="form().status === 'on_sale'">
                <span class="state-dot" aria-hidden="true"></span>
                {{ form().status === 'on_sale' ? '在售 · 前台可见' : '已下架 · 前台隐藏' }}
              </span>
            </div>
          </div>
        } @else {
          <div class="preview">
            <img [src]="form().image || fallbackImageUrl" alt="" width="64" height="64" loading="lazy" (error)="fallbackImage($event)" />
            <div class="preview-text">
              <strong>{{ form().title || '新商品' }}</strong>
              <small>保存后立即进入商品列表</small>
              <span class="state" [class.state--on]="form().status === 'on_sale'">
                <span class="state-dot" aria-hidden="true"></span>
                {{ form().status === 'on_sale' ? '在售 · 前台可见' : '已下架 · 前台隐藏' }}
              </span>
            </div>
          </div>
        }

        <section class="ops-section">
          <h3>基础信息</h3>
          <div class="sp-field">
            <label class="sp-label" for="p-title">商品名称<span class="sp-req">*</span></label>
            <input
              id="p-title"
              class="sp-input"
              type="text"
              autocomplete="off"
              [value]="form().title"
              (input)="onField('title', $event)"
              [attr.aria-invalid]="formErrors().title ? 'true' : null"
              [attr.aria-describedby]="formErrors().title ? 'p-title-error' : null"
              placeholder="例如：星澜轻量不粘炒锅 28cm"
            />
            @if (formErrors().title) {
              <p class="sp-error" id="p-title-error">{{ formErrors().title }}</p>
            }
          </div>

          <div class="sp-field">
            <label class="sp-label" for="p-price">价格（元）<span class="sp-req">*</span></label>
            <input
              id="p-price"
              class="sp-input sp-num"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              [value]="form().price"
              (input)="onField('price', $event)"
              [attr.aria-invalid]="formErrors().price ? 'true' : null"
              [attr.aria-describedby]="formErrors().price ? 'p-price-error' : null"
            />
            @if (formErrors().price) {
              <p class="sp-error" id="p-price-error">{{ formErrors().price }}</p>
            }
          </div>
        </section>

        <section class="ops-section">
          <h3>上架状态</h3>
          <div class="status-switch" role="group" aria-label="上架状态">
            <button
              type="button"
              [class.on]="form().status === 'off_sale'"
              [attr.aria-pressed]="form().status === 'off_sale'"
              (click)="setFormStatus('off_sale')"
            >
              <app-merchant-icon name="archive" [size]="16" />
              <span><strong>已下架</strong><small>前台隐藏，可随时恢复</small></span>
            </button>
            <span class="switch-arrow" aria-hidden="true">
              <app-merchant-icon name="arrow-right" [size]="14" />
            </span>
            <button
              type="button"
              [class.on]="form().status === 'on_sale'"
              [attr.aria-pressed]="form().status === 'on_sale'"
              (click)="setFormStatus('on_sale')"
            >
              <app-merchant-icon name="check-circle" [size]="16" />
              <span><strong>在售</strong><small>前台可搜索、可购买</small></span>
            </button>
          </div>
        </section>

        <section class="ops-section">
          <h3>商品主图</h3>
          <div class="image-row">
            <img
              class="preview-lg"
              [src]="form().image || fallbackImageUrl"
              alt="商品主图预览"
              width="72"
              height="72"
              loading="lazy"
              (error)="fallbackImage($event)"
            />
            <div class="image-picker" role="group" aria-labelledby="p-image-label">
              @for (src of imageOptions; track src; let index = $index) {
                <button
                  class="image-option"
                  type="button"
                  [class.on]="form().image === src"
                  [attr.aria-pressed]="form().image === src"
                  [attr.aria-label]="'选择商品主图 ' + (index + 1)"
                  (click)="pickImage(src)"
                >
                  <img [src]="src" alt="" width="36" height="36" loading="lazy" />
                </button>
              }
            </div>
          </div>
          <span class="sp-label" id="p-image-label">主图地址</span>
          <input
            id="p-image"
            class="sp-input"
            type="text"
            [value]="form().image"
            (input)="onField('image', $event)"
            placeholder="/assets/public/images/products/sp-1001.svg"
            aria-label="商品主图地址"
            aria-describedby="p-image-hint"
          />
          <p class="sp-hint" id="p-image-hint">从商品图库中选择，或填写可访问的图片地址。</p>
        </section>

        @if (editing(); as product) {
          <section class="ops-section">
          <h3>同步信息</h3>
            <dl class="ops-meta-grid">
              <div><dt>商品编号</dt><dd class="sp-num">#{{ product.id }}</dd></div>
              <div><dt>所属分类</dt><dd>{{ categoryName(product.category) }}</dd></div>
              <div><dt>库存</dt><dd class="sp-num">{{ product.stock }} 件</dd></div>
              <div><dt>累计销量</dt><dd class="sp-num">{{ product.sales }} 件</dd></div>
            </dl>
            <p class="sp-hint">分类与库存由平台目录与仓储系统同步，本页不可修改。</p>
          </section>
        }

        @if (saveError()) {
          <p class="sp-alert sp-alert--error" role="alert">{{ saveError() }}</p>
        }

        <div class="modal-actions">
          <button class="sp-btn sp-btn--secondary" type="button" (click)="closeModal()">取消</button>
          <button class="sp-btn sp-btn--primary" type="submit" [disabled]="saving()">
            {{ saving() ? '保存中…' : '保存商品' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: [OPS_CSS, `
    .chips-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; color: var(--sp-text-muted); }
    .chips-empty { font-size: 12px; color: var(--sp-text-muted); }
    .chips-divider { width: 1px; height: 18px; background: var(--sp-border); margin: 0 4px; }
    .ops-chip--view.is-active { border-style: solid; border-color: var(--sp-primary); background: var(--sp-info-soft); }
    .ops-chip--view.is-active button { color: var(--sp-primary); }
    .ops-chip-add:disabled { opacity: .5; cursor: not-allowed; }

    .product-table { min-width: 760px; }
    .price { color: var(--sp-accent-text); font-weight: 600; }
    .state { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sp-text-secondary); white-space: nowrap; }
    .state-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sp-border-strong); flex: none; }
    .state--on { color: var(--sp-text); }
    .state--on .state-dot { background: var(--sp-success); box-shadow: 0 0 0 3px rgba(31, 122, 92, .12); }
    .skeleton-rows { padding: 6px 0; }

    .preview { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--sp-border); border-radius: 8px; background: #FDFCFA; }
    .preview img { width: 64px; height: 64px; border-radius: 6px; border: 1px solid var(--sp-border); background: var(--sp-bg); object-fit: cover; flex: none; }
    .preview-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .preview-text strong { font-size: 14px; }
    .preview-text small { font-size: 12px; color: var(--sp-text-muted); }

    .status-switch { display: flex; align-items: stretch; gap: 8px; }
    .status-switch button {
      flex: 1 1 0; min-width: 0; min-height: 56px; padding: 8px 12px;
      display: flex; align-items: center; gap: 8px; text-align: left;
      border: 1px solid var(--sp-border-strong); border-radius: 8px;
      background: var(--sp-surface); color: var(--sp-text-secondary);
    }
    .status-switch button:hover { border-color: var(--sp-primary); }
    .status-switch button.on { border-color: var(--sp-primary); background: #F6F9FE; color: var(--sp-primary); box-shadow: inset 0 0 0 1px var(--sp-primary); }
    .status-switch strong { display: block; font-size: 13px; color: var(--sp-text); }
    .status-switch button.on strong { color: var(--sp-primary); }
    .status-switch small { display: block; font-size: 11px; color: var(--sp-text-muted); margin-top: 1px; }
    .switch-arrow { display: inline-flex; align-items: center; color: var(--sp-border-strong); flex: none; }

    .image-row { display: flex; gap: 12px; align-items: flex-start; }
    .preview-lg { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid var(--sp-border); flex: none; background: var(--sp-bg); }
    .image-picker { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; flex: 1 1 auto; }
    .image-option { padding: 2px; min-height: 44px; border: 1px solid var(--sp-border); border-radius: 6px; background: var(--sp-surface); line-height: 0; }
    .image-option:hover { border-color: var(--sp-primary); }
    .image-option.on { border-color: var(--sp-primary); box-shadow: 0 0 0 2px rgba(45, 108, 223, .18); }
    .image-option img { width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 3px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

    @media (max-width: 767px) {
      .image-picker { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      .status-switch { flex-direction: column; }
      .switch-arrow { transform: rotate(90deg); align-self: center; }
    }
  `],
})
export class MerchantProductsPage implements OnDestroy {
  private readonly api = inject(MerchantApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly fallbackImageUrl = FALLBACK_IMAGE;
  readonly products = signal<MerchantProduct[]>([]);
  readonly loading = signal(false);
  readonly showSkeleton = signal(false);
  readonly error = signal('');
  readonly requestId = signal<string | undefined>(undefined);
  readonly q = signal('');
  readonly statusFilter = signal('');
  readonly categoryFilter = signal('');
  readonly page = signal(1);
  readonly size = signal(10);
  readonly modalOpen = signal(false);
  readonly editing = signal<MerchantProduct | null>(null);
  readonly form = signal<ProductForm>(this.emptyForm());
  readonly formErrors = signal<FormErrors>({});
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly togglingId = signal<number | null>(null);
  readonly selected = signal<Set<number>>(new Set());
  readonly bulkBusy = signal(false);
  readonly views = signal<SavedView[]>([]);
  readonly syncedAt = signal('');
  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  readonly statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'on_sale', label: '在售' },
    { value: 'off_sale', label: '已下架' },
  ];
  readonly categoryOptions = [
    { value: '', label: '全部分类' },
    { value: 'kitchen', label: '厨房' },
    { value: 'home', label: '家居' },
    { value: 'personal', label: '个护' },
    { value: 'digital', label: '数码' },
    { value: 'travel', label: '出行' },
    { value: 'food', label: '食品' },
    { value: 'all', label: '其他' },
  ];
  readonly imageOptions = Array.from({ length: 20 }, (_, index) => IMAGE_BASE + 'sp-' + (1001 + index) + '.svg');

  readonly filtered = computed(() => {
    const query = this.q().trim().toLowerCase();
    const status = this.statusFilter();
    const category = this.categoryFilter();
    return this.products().filter(
      (product) =>
        (!query || product.title.toLowerCase().includes(query) || String(product.id).includes(query)) &&
        (!status || product.status === status) &&
        (!category || product.category === category),
    );
  });

  readonly total = computed(() => this.filtered().length);
  readonly pagedProducts = computed(() => {
    const start = (this.page() - 1) * this.size();
    return this.filtered().slice(start, start + this.size());
  });
  readonly onSaleCount = computed(() => this.products().filter((product) => product.status === 'on_sale').length);
  readonly offSaleCount = computed(() => this.products().filter((product) => product.status === 'off_sale').length);
  readonly hasFilters = computed(() => !!this.q().trim() || !!this.statusFilter() || !!this.categoryFilter());
  readonly selectedCount = computed(() => this.selected().size);
  readonly allPageSelected = computed(
    () => this.pagedProducts().length > 0 && this.pagedProducts().every((product) => this.selected().has(product.id)),
  );

  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    if (status) {
      this.statusFilter.set(status);
    }
    this.views.set(this.readViews());
    this.load();
    if (params.get('new') === '1') {
      this.openCreate();
    }
  }

  load(): void {
    const seq = ++this.seq;
    this.error.set('');
    this.requestId.set(undefined);
    this.loading.set(true);
    this.clearTimer();
    this.timer = setTimeout(() => {
      if (seq === this.seq) {
        this.showSkeleton.set(true);
      }
    }, 300);

    this.api.products().subscribe({
      next: (items) => {
        if (seq !== this.seq) {
          return;
        }
        this.products.set(items ?? []);
        this.selected.set(new Set());
        this.clampPage();
        this.syncedAt.set(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
        this.finish();
      },
      error: (err: unknown) => {
        if (seq !== this.seq) {
          return;
        }
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
        this.finish();
      },
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  onQueryInput(event: Event): void {
    this.q.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  onStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
  }

  onCategoryFilter(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
  }

  clearQuery(): void {
    this.q.set('');
    this.page.set(1);
  }

  clearStatus(): void {
    this.statusFilter.set('');
    this.page.set(1);
  }

  clearCategory(): void {
    this.categoryFilter.set('');
    this.page.set(1);
  }

  resetFilters(): void {
    this.q.set('');
    this.statusFilter.set('');
    this.categoryFilter.set('');
    this.page.set(1);
  }

  statusLabel(value: string): string {
    return this.statusOptions.find((option) => option.value === value)?.label ?? value;
  }

  categoryName(category: string): string {
    return CATEGORY_LABELS[category] ?? '其他';
  }

  isSelected(id: number): boolean {
    return this.selected().has(id);
  }

  toggleSelect(id: number): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected.set(next);
  }

  togglePageSelection(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selected());
    for (const product of this.pagedProducts()) {
      if (checked) {
        next.add(product.id);
      } else {
        next.delete(product.id);
      }
    }
    this.selected.set(next);
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  bulkUpdate(status: 'on_sale' | 'off_sale'): void {
    const ids = [...this.selected()];
    if (ids.length === 0 || this.bulkBusy()) {
      return;
    }
    this.bulkBusy.set(true);
    forkJoin(ids.map((id) => this.api.updateProduct(id, { status }))).subscribe({
      next: () => {
        this.bulkBusy.set(false);
        this.toast.show('已' + (status === 'on_sale' ? '上架' : '下架') + ' ' + ids.length + ' 件商品', 'success');
        this.selected.set(new Set());
        this.load();
      },
      error: (err: unknown) => {
        this.bulkBusy.set(false);
        this.toast.show(errorMessage(err), 'error');
        this.load();
      },
    });
  }

  // ---- 保存筛选视图（localStorage，仅当前浏览器） ----
  saveView(): void {
    if (!this.hasFilters()) {
      this.toast.show('请先设置关键词、状态或分类筛选', 'info');
      return;
    }
    const parts = [
      this.q().trim(),
      this.statusFilter() ? this.statusLabel(this.statusFilter()) : '',
      this.categoryFilter() ? this.categoryName(this.categoryFilter()) : '',
    ].filter(Boolean);
    const name = parts.join(' · ') || '全部商品';
    const exists = this.views().some(
      (view) =>
        view.q === this.q().trim() &&
        view.status === this.statusFilter() &&
        view.category === this.categoryFilter(),
    );
    if (exists) {
      this.toast.show('该筛选组合已保存', 'info');
      return;
    }
    const view: SavedView = {
      id: 'v' + Date.now(),
      name,
      q: this.q().trim(),
      status: this.statusFilter(),
      category: this.categoryFilter(),
    };
    const next = [view, ...this.views()].slice(0, 6);
    this.views.set(next);
    this.persistViews(next);
    this.toast.show('已保存筛选「' + name + '」', 'success');
  }

  applyView(view: SavedView): void {
    this.q.set(view.q);
    this.statusFilter.set(view.status);
    this.categoryFilter.set(view.category);
    this.page.set(1);
  }

  removeView(view: SavedView): void {
    const next = this.views().filter((item) => item.id !== view.id);
    this.views.set(next);
    this.persistViews(next);
  }

  isViewActive(view: SavedView): boolean {
    return view.q === this.q().trim() && view.status === this.statusFilter() && view.category === this.categoryFilter();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.set(this.emptyForm());
    this.formErrors.set({});
    this.saveError.set('');
    this.saving.set(false);
    this.modalOpen.set(true);
  }

  openEdit(product: MerchantProduct): void {
    this.editing.set(product);
    this.form.set({
      title: product.title,
      price: String(product.price),
      image: product.image || FALLBACK_IMAGE,
      status: product.status || 'on_sale',
    });
    this.formErrors.set({});
    this.saveError.set('');
    this.saving.set(false);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (this.saving()) {
      return;
    }
    this.modalOpen.set(false);
  }

  onField(field: 'title' | 'price' | 'image', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.form.update((form) => ({ ...form, [field]: value }));
    if (field !== 'image') {
      this.formErrors.update((errors) => ({ ...errors, [field]: undefined }));
    }
  }

  setFormStatus(status: string): void {
    this.form.update((form) => ({ ...form, status }));
  }

  pickImage(src: string): void {
    this.form.update((form) => ({ ...form, image: src }));
  }

  fallbackImage(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.dataset['fallback'] === '1') {
      return;
    }
    img.dataset['fallback'] = '1';
    img.src = FALLBACK_IMAGE;
  }

  save(event: Event): void {
    event.preventDefault();
    if (this.saving()) {
      return;
    }
    const form = this.form();
    const errors: FormErrors = {};
    if (!form.title.trim()) {
      errors.title = '请填写商品名称。';
    }
    const price = Number(form.price);
    if (form.price.trim() === '' || !Number.isFinite(price) || price < 0) {
      errors.price = '请填写不小于 0 的价格。';
    }
    this.formErrors.set(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload = {
      title: form.title.trim(),
      price,
      image: form.image.trim() || FALLBACK_IMAGE,
      status: form.status,
    };
    const editing = this.editing();
    this.saving.set(true);
    this.saveError.set('');

    const request = editing
      ? this.api.updateProduct(editing.id, payload)
      : this.api.createProduct(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.show(editing ? '商品已更新' : '商品已创建', 'success');
        if (!editing) {
          this.page.set(1);
        }
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.saveError.set(errorMessage(err));
      },
    });
  }

  toggleStatus(product: MerchantProduct): void {
    if (this.togglingId() !== null) {
      return;
    }
    const next = product.status === 'on_sale' ? 'off_sale' : 'on_sale';
    this.togglingId.set(product.id);
    this.api.updateProduct(product.id, { status: next }).subscribe({
      next: () => {
        this.togglingId.set(null);
        this.toast.show(next === 'on_sale' ? '商品已上架' : '商品已下架', 'success');
        this.load();
      },
      error: (err: unknown) => {
        this.togglingId.set(null);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  changePage(page: number): void {
    this.page.set(page);
  }

  changeSize(size: number): void {
    this.size.set(size);
    this.page.set(1);
  }

  private readViews(): SavedView[] {
    try {
      const raw = localStorage.getItem(VIEWS_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as SavedView[];
      return Array.isArray(parsed)
        ? parsed.filter((view) => view && typeof view.name === 'string' && typeof view.id === 'string').slice(0, 6)
        : [];
    } catch {
      return [];
    }
  }

  private persistViews(views: SavedView[]): void {
    try {
      localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
    } catch {
      /* 存储不可用时仅保留本次会话的视图 */
    }
  }

  private clampPage(): void {
    const maxPage = Math.max(1, Math.ceil(this.filtered().length / this.size()));
    if (this.page() > maxPage) {
      this.page.set(maxPage);
    }
  }

  private emptyForm(): ProductForm {
    return {
      title: '',
      price: '',
      image: IMAGE_BASE + 'sp-1001.svg',
      status: 'on_sale',
    };
  }

  private finish(): void {
    this.loading.set(false);
    this.showSkeleton.set(false);
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}