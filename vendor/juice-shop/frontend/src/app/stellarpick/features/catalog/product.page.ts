import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { ProductsApi } from '../../core/api/products.api';
import { memberPriceFor } from '../../core/catalog';
import { ReviewsApi } from '../../core/api/reviews.api';
import { AuthStore } from '../../core/auth/auth.store';
import { CartService } from '../../core/cart.service';
import { Product, Review, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { BreadcrumbComponent, Crumb } from '../../shared/ui/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { ProductCardComponent } from '../../shared/ui/product-card/product-card.component';
import { QuantityStepperComponent } from '../../shared/ui/quantity-stepper/quantity-stepper.component';
import { RatingStarsComponent } from '../../shared/ui/rating-stars/rating-stars.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

type TabKey = 'detail' | 'specs' | 'reviews';

interface ReviewView extends Review {
  /** V04: the body is rendered as raw HTML. */
  safeBody: SafeHtml;
  /** Buyer photo attached to a positive review (seeded feed). */
  photo?: string;
  /** Display date; seeded reviews carry no timestamp, so it is derived once. */
  dateLabel: string;
  /** Purchased variant shown under the author name. */
  specLabel: string;
  /** Stable "helpful" counter for the seeded feed. */
  likes: number;
}

const FAVORITES_KEY = 'sp.favorites';

/** Styling sets shipped with the catalog; keyed by category slug. */
const SCENE_BY_CATEGORY: Record<string, string> = {
  kitchen: 'kitchen',
  home: 'living',
  personal: 'bath',
  digital: 'desk',
  travel: 'travel',
  food: 'pantry',
};

const MACRO_BY_CATEGORY: Record<string, string> = {
  kitchen: 'detail-steel',
  home: 'detail-fabric',
  personal: 'detail-fabric',
  digital: 'detail-steel',
  travel: 'detail-poly',
  food: 'detail-grain',
};

const COLORS_BY_CATEGORY: Record<string, { name: string; hex: string }[]> = {
  kitchen: [
    { name: '雾蓝', hex: '#7C93A8' },
    { name: '奶白', hex: '#EFE7D8' },
    { name: '松绿', hex: '#5C6B5A' },
  ],
  home: [
    { name: '燕麦', hex: '#D9C9B2' },
    { name: '雾灰', hex: '#B7B3AB' },
    { name: '黛蓝', hex: '#3C5A78' },
  ],
  personal: [
    { name: '无香', hex: '#EFE7D8' },
    { name: '白茶', hex: '#D9C9B2' },
    { name: '雪松', hex: '#5C6B5A' },
  ],
  digital: [
    { name: '石墨黑', hex: '#2B2B2B' },
    { name: '月光银', hex: '#C7C3BC' },
    { name: '雾蓝', hex: '#7C93A8' },
  ],
  travel: [
    { name: '深海蓝', hex: '#2B4762' },
    { name: '砂岩', hex: '#C9B79C' },
    { name: '墨绿', hex: '#3E4B3C' },
  ],
  food: [
    { name: '原味', hex: '#C9A87C' },
    { name: '浅烘', hex: '#B4653F' },
    { name: '深烘', hex: '#5C3B1C' },
  ],
};

const HIGHLIGHTS_BY_CATEGORY: Record<string, { icon: string; title: string; text: string }[]> = {
  kitchen: [
    { icon: 'leaf', title: '食品级材质', text: '接触食物的部分均通过食品级检测。' },
    { icon: 'clock', title: '日常耐用', text: '按每天使用 3 次计算，可用 5 年以上。' },
    { icon: 'package', title: '好收纳', text: '尺寸经过测量，能放进常见橱柜与抽屉。' },
  ],
  home: [
    { icon: 'leaf', title: '亲肤材质', text: '通过婴幼儿级安全检测，贴肤也放心。' },
    { icon: 'clock', title: '越用越顺手', text: '可机洗、可拆洗，日常打理不费心。' },
    { icon: 'package', title: '开箱即用', text: '附收纳袋与使用说明，收到就能用。' },
  ],
  personal: [
    { icon: 'droplet', title: '温和配方', text: '不含皂基与酒精，敏感肌也可使用。' },
    { icon: 'shield', title: '成分透明', text: '全成分表印在包装上，不做模糊标注。' },
    { icon: 'package', title: '差旅友好', text: '容量符合随身携带规定。' },
  ],
  digital: [
    { icon: 'shield', title: '多重保护', text: '过压、过流、过温保护，整夜充电也安心。' },
    { icon: 'clock', title: '效率优先', text: '实测数据写在详情页，不夸大宣传。' },
    { icon: 'package', title: '配件齐全', text: '附赠常用线材与收纳袋。' },
  ],
  travel: [
    { icon: 'truck', title: '登机尺寸', text: '符合主流航司随身行李尺寸。' },
    { icon: 'shield', title: '耐磨抗压', text: '箱体通过 20 公里颠簸测试。' },
    { icon: 'package', title: '收纳合理', text: '五五分仓，开箱不翻箱倒柜。' },
  ],
  food: [
    { icon: 'leaf', title: '当季原料', text: '小批量烘焙，日期新鲜可查。' },
    { icon: 'clock', title: '锁鲜包装', text: '独立小包，开封后不易返潮。' },
    { icon: 'package', title: '送礼体面', text: '礼盒装附手提袋与贺卡。' },
  ],
};

const EDITORIAL_BY_CATEGORY: Record<string, string> = {
  kitchen: '每天都要用上几次的东西，值得多花一点心思。我们把它做得更轻、更好洗，也更耐看。',
  home: '家不需要一次装满。先从一件每天都会碰到的东西开始，让空间安静下来。',
  personal: '日常消耗品也值得认真挑。配方简单、气味克制，用完不会想念，也不会想换。',
  digital: '少一根线，桌面就清爽一分。把常用的接口和功率一次给足，几年内不用再换。',
  travel: '出门在外，行李是最先让人烦躁的部分。尺寸、重量和开合方式，都按真实旅程反复试过。',
  food: '办公室抽屉和家里柜子都该有一点存粮。小包装、日期新鲜，随时补给好状态。',
};

const QA_BY_CATEGORY: Record<string, { q: string; a: string; count: number }[]> = {
  kitchen: [
    { q: '可以用洗碗机清洗吗？', a: '可以，建议放在上层篮架，避免与尖锐餐具碰撞。', count: 42 },
    { q: '会不会有异味？', a: '首次使用前用温水加少量小苏打浸泡 10 分钟即可，之后正常清洗不会有异味。', count: 28 },
    { q: '适合几个人用？', a: '日常 1–2 人份最合适，做汤或炖菜也够用。', count: 17 },
  ],
  home: [
    { q: '尺寸怎么选？', a: '1.5m 床选 200×230cm，1.8m 床选 220×240cm，页面上方可以直接切换。', count: 36 },
    { q: '会掉色吗？', a: '首次清洗建议单独冷水洗涤，前两次有轻微浮色属于正常现象。', count: 21 },
    { q: '多久能发货？', a: '上海仓 48 小时内发出，江浙沪一般次日可达。', count: 12 },
  ],
  personal: [
    { q: '敏感肌能用吗？', a: '配方不含酒精与香精，敏感肌可用；建议先在耳后小面积试用。', count: 33 },
    { q: '可以带上飞机吗？', a: '单件容量符合随身携带规定，建议放在透明洗漱袋中。', count: 19 },
    { q: '孕妇可以用吗？', a: '成分温和，但孕期体质特殊，建议先咨询医生。', count: 8 },
  ],
  digital: [
    { q: '支持哪些快充协议？', a: '支持 PD3.0 / QC4+，可为手机、平板与轻薄本供电。', count: 51 },
    { q: '发热严重吗？', a: '满载时外壳温度约 45℃，属于正常范围，内部有多重温控保护。', count: 24 },
    { q: '质保多久？', a: '整机 12 个月质保，非人为损坏可换新。', count: 15 },
  ],
  travel: [
    { q: '能带上飞机吗？', a: '20 寸为登机箱尺寸，符合主流航司随身行李规定，具体以承运航司为准。', count: 47 },
    { q: '轮子静音吗？', a: '采用静音万向轮，机场地砖与酒店地毯上都比较安静。', count: 22 },
    { q: '密码锁怎么重置？', a: '出厂密码为 000，按住锁扣旋转拨盘即可设置新密码，详情页有图示。', count: 13 },
  ],
  food: [
    { q: '保质期多久？', a: '未开封 9 个月，开封后建议 30 天内喝完，存放于阴凉干燥处。', count: 26 },
    { q: '含糖吗？', a: '原味款不额外添加糖，配料表只有咖啡豆。', count: 18 },
    { q: '可以开发票吗？', a: '支持电子普票与专票，下单时在结算页填写抬头即可。', count: 9 },
  ],
};

const PACKS = [
  { name: '简装', note: '默认包装' },
  { name: '礼盒装', note: '含贺卡与手提袋' },
];

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [
    BreadcrumbComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    MoneyPipe,
    PaginationComponent,
    ProductCardComponent,
    QuantityStepperComponent,
    RatingStarsComponent,
    RouterLink,
    SkeletonComponent,
  ],
  templateUrl: './product.page.html',
  styleUrl: './product.page.scss',
})
export class ProductPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProductsApi);
  private readonly reviewsApi = inject(ReviewsApi);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthStore);

  readonly id = signal(this.route.snapshot.paramMap.get('id') ?? '');
  readonly product = signal<Product | null>(null);
  readonly loading = signal(true);
  readonly showSkeleton = signal(false);
  readonly error = signal<string | null>(null);
  readonly requestId = signal<string | undefined>(undefined);
  readonly notFound = signal(false);

  readonly activeImage = signal(0);
  readonly qty = signal(1);
  readonly saved = signal(false);
  readonly adding = signal(false);
  readonly activeTab = signal<TabKey>('detail');
  /** The mobile buy bar steps aside while the footer is on screen. */
  readonly footerVisible = signal(false);

  readonly reviews = signal<ReviewView[]>([]);
  readonly reviewTotal = signal(0);
  readonly reviewPage = signal(1);
  readonly reviewSize = signal(10);
  readonly reviewLoading = signal(false);
  readonly reviewError = signal<string | null>(null);
  readonly reviewRequestId = signal<string | undefined>(undefined);
  readonly reviewAvg = signal(0);

  readonly formRating = signal(5);
  readonly formBody = signal('');
  readonly bodyError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly related = signal<Product[]>([]);
  readonly relatedLoading = signal(false);

  readonly skeletonRows = [1, 2, 3];
  readonly skeletonCards = [1, 2, 3, 4];
  private readonly tabOrder: TabKey[] = ['detail', 'specs', 'reviews'];

  private productSub?: Subscription;
  private reviewsSub?: Subscription;
  private relatedSub?: Subscription;
  private fillRelatedSub?: Subscription;
  private skeletonTimer?: ReturnType<typeof setTimeout>;

  /**
   * The REST payload only carries the hero shot; the seeded catalog ships a
   * second angle (1001–1020), and every product gets a lifestyle scene plus a
   * material macro so the gallery reads like a real product shoot.
   */
  readonly sceneImage = computed(
    () => '/assets/sp/img/scenes/' + (SCENE_BY_CATEGORY[this.product()?.categoryId ?? ''] ?? 'kitchen') + '.svg',
  );
  readonly macroImage = computed(
    () => '/assets/sp/img/scenes/' + (MACRO_BY_CATEGORY[this.product()?.categoryId ?? ''] ?? 'detail-steel') + '.svg',
  );
  readonly gallery = computed<string[]>(() => {
    const product = this.product();
    if (!product) {
      return [];
    }
    const list: string[] = [];
    const push = (url: string | undefined): void => {
      if (url && !list.includes(url)) {
        list.push(url);
      }
    };
    push(product.image);
    for (const image of product.images ?? []) {
      push(image);
    }
    if (product.id >= 1001 && product.id <= 1020) {
      push('/assets/sp/img/products/' + product.id + '-2.svg');
    }
    push(this.sceneImage());
    push(this.macroImage());
    return list;
  });
  readonly galleryLabels = ['主图', '细节图', '场景图', '材质细节'];
  readonly currentImage = computed(() => this.gallery()[this.activeImage()] ?? this.product()?.image ?? '');
  /** Large editorial shots under the description. */
  readonly detailImages = computed(() => {
    if (!this.product()) {
      return [];
    }
    return [this.sceneImage(), this.macroImage()];
  });
  readonly maxQty = computed(() => Math.max(1, Math.min(this.product()?.stock ?? 1, 99)));

  // The API returns { label, value }; the shared Product model types { name, value }.
  readonly specs = computed(() =>
    (this.product()?.specs ?? []).map((spec) => {
      const raw = spec as unknown as { name?: string; label?: string; value?: string };
      return { name: raw.name ?? raw.label ?? '规格', value: raw.value ?? '' };
    }),
  );

  /** Product descriptions come from the catalog with stray markup (e.g. legacy "More..." links). */
  readonly descriptionParagraphs = computed<string[]>(() => {
    const product = this.product();
    const raw = product?.description ?? '';
    const text = raw
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s*More\.\.\.\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const source = text || product?.subtitle || '';
    return source
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0);
  });

  readonly categorySlug = computed(() => this.product()?.categoryId ?? '');
  readonly categoryName = computed(() => this.product()?.categoryName ?? '全部商品');
  readonly memberPrice = computed(() => {
    const product = this.product();
    return product ? memberPriceFor(product) : 0;
  });
  readonly memberSaving = computed(() => {
    const price = this.product()?.price ?? 0;
    return Math.round((price - this.memberPrice()) * 100) / 100;
  });
  readonly subtotal = computed(() => this.memberPrice() * this.qty());
  /** Shelf price; the member price is the actual selling price. */
  readonly listPrice = computed(() => this.product()?.price ?? 0);
  readonly listSaving = computed(() => Math.max(0, this.listPrice() - this.memberPrice()));
  /** Member price split into 3 interest-free instalments. */
  readonly installment = computed(() => Math.ceil((this.memberPrice() / 3) * 100) / 100);

  private readonly mountedAt = new Date();
  readonly delivery = computed(() => {
    const now = this.mountedAt;
    const beforeCutoff = now.getHours() < 15;
    const day = new Date(now);
    if (!beforeCutoff) {
      day.setDate(day.getDate() + 1);
    }
    const label = beforeCutoff ? '今日达' : '明日达';
    const date = day.getMonth() + 1 + '月' + day.getDate() + '日';
    return {
      label,
      date,
      text: beforeCutoff ? '现在下单，预计今天 18:00 前送达' : '现在下单，预计' + date + ' 18:00 前送达',
    };
  });

  /** Member-day allocation, stable per product so the counter does not jump. */
  readonly promoLeft = computed(() => 4 + ((this.product()?.id ?? 0) % 7));
  readonly soldPercent = computed(() => Math.min(96, 100 - this.promoLeft() * 3));

  readonly colors = computed(() => COLORS_BY_CATEGORY[this.product()?.categoryId ?? ''] ?? COLORS_BY_CATEGORY['home']);
  readonly packs = PACKS;
  readonly selectedColor = signal(0);
  readonly selectedPack = signal(0);
  readonly selectedLabel = computed(() => this.colors()[this.selectedColor()]?.name + ' · ' + this.packs[this.selectedPack()]?.name);

  readonly highlights = computed(
    () => HIGHLIGHTS_BY_CATEGORY[this.product()?.categoryId ?? ''] ?? HIGHLIGHTS_BY_CATEGORY['home'],
  );
  readonly editorial = computed(() => EDITORIAL_BY_CATEGORY[this.product()?.categoryId ?? ''] ?? '');
  readonly questions = computed(() => QA_BY_CATEGORY[this.product()?.categoryId ?? ''] ?? QA_BY_CATEGORY['home']);

  /** 5→1 star distribution derived from the average, filled to the review total. */
  readonly reviewStats = computed(() => {
    const total = this.reviewTotal();
    const average = this.reviewAvg() || this.product()?.rating || 4.8;
    const weights = [0.74, 0.17, 0.05, 0.02, 0.02];
    const counts = weights.map((weight) => Math.round(total * weight));
    counts[0] += total - counts.reduce((sum, value) => sum + value, 0);
    return counts.map((count, index) => ({
      stars: 5 - index,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      weight: weights[index],
    }));
  });
  readonly goodRate = computed(() => {
    const total = this.reviewTotal();
    if (total <= 0) {
      return 100;
    }
    return Math.round(((this.reviewStats()[0].count + this.reviewStats()[1].count) / total) * 100);
  });
  readonly photoReviews = computed(() => this.reviews().filter((review) => !!review.photo).slice(0, 4));

  readonly helpful = signal<Set<number>>(new Set());
  readonly bundleSelected = signal<Set<number>>(new Set());
  readonly bundle = computed(() => this.related().slice(0, 3));
  readonly bundleItems = computed(() => this.bundle().filter((item) => this.bundleSelected().has(item.id)));
  readonly bundleTotal = computed(() => this.bundleItems().reduce((sum, item) => sum + item.price, 0));
  readonly bundleSaving = computed(() => this.bundleItems().reduce((sum, item) => sum + Math.max(0, item.price - this.memberPriceOf(item)), 0));

  readonly canReview = computed(() => {
    const role = this.auth.role();
    return this.auth.isLoggedIn() && (role === 'member' || role === 'admin');
  });
  readonly crumbs = computed<Crumb[]>(() => {
    const product = this.product();
    return [
      { label: '首页', link: '/' },
      { label: this.categoryName(), link: '/category/' + (this.categorySlug() || 'all') },
      { label: product?.title ?? '商品详情' },
    ];
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id') ?? '';
      if (id === this.id() && this.product()) {
        return;
      }
      this.id.set(id);
      this.loadProduct();
    });

    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((fragment) => {
      if (fragment === 'reviews') {
        this.setTab('reviews');
        if (this.product()) {
          this.scrollToReviews();
        }
      }
    });

    afterNextRender(
      () => {
        const footer = document.querySelector('footer');
        if (!footer || typeof IntersectionObserver === 'undefined') {
          return;
        }
        const observer = new IntersectionObserver(
          (entries) => this.footerVisible.set(entries.some((entry) => entry.isIntersecting)),
          { rootMargin: '0px 0px -24px 0px' },
        );
        observer.observe(footer);
        this.destroyRef.onDestroy(() => observer.disconnect());
      },
      { injector: this.injector },
    );
  }

  loadProduct(): void {
    this.productSub?.unsubscribe();
    this.reviewsSub?.unsubscribe();
    this.relatedSub?.unsubscribe();
    this.fillRelatedSub?.unsubscribe();

    this.loading.set(true);
    this.error.set(null);
    this.requestId.set(undefined);
    this.notFound.set(false);
    this.product.set(null);
    this.related.set([]);
    this.reviews.set([]);
    this.reviewTotal.set(0);
    this.reviewError.set(null);
    this.reviewRequestId.set(undefined);
    this.activeTab.set(this.reviewsRequested() ? 'reviews' : 'detail');
    this.showSkeleton.set(false);
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
    }
    this.skeletonTimer = setTimeout(() => {
      if (this.loading()) {
        this.showSkeleton.set(true);
      }
    }, 300);

    this.productSub = this.api.get(this.id()).subscribe({
      next: (product) => {
        this.product.set(product);
        this.qty.set(1);
        this.activeImage.set(0);
        this.saved.set(false);
        this.selectedColor.set(0);
        this.selectedPack.set(0);
        this.helpful.set(new Set());
        this.finishLoading();
        this.loadFavorite();
        this.title.setTitle(product.title + ' · 星澜优选');
        this.loadReviews(1);
        this.loadRelated(product);
        if (this.reviewsRequested()) {
          this.scrollToReviews();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.finishLoading();
        if (err.status === 404) {
          this.notFound.set(true);
          this.title.setTitle('商品不存在 · 星澜优选');
          return;
        }
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
      },
    });
  }

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }

  /** Jump from the rating row to the review list. */
  showReviews(): void {
    this.setTab('reviews');
    this.scrollToReviews();
  }

  onTabKey(event: KeyboardEvent, current: TabKey): void {
    const index = this.tabOrder.indexOf(current);
    let nextIndex = index;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % this.tabOrder.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index + this.tabOrder.length - 1) % this.tabOrder.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = this.tabOrder.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const next = this.tabOrder[nextIndex];
    this.setTab(next);
    setTimeout(() => {
      document.getElementById('tab-' + next)?.focus();
    });
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (image.dataset['spFallback'] === '1') {
      return;
    }
    image.dataset['spFallback'] = '1';
    const fallback = this.product()?.image || '/assets/sp/img/products/1001.svg';
    if (image.getAttribute('src') !== fallback) {
      image.src = fallback;
    }
  }

  addToCart(goCheckout = false): void {
    const product = this.product();
    if (!product || product.stock === 0 || this.adding()) {
      return;
    }
    if (!this.auth.isLoggedIn()) {
      this.toast.show('登录后即可加入购物车', 'info');
      this.router.navigate(['/login'], { queryParams: { next: this.router.url } });
      return;
    }
    this.adding.set(true);
    this.cart.addProduct(product, this.qty()).subscribe({
      next: (cart) => {
        this.adding.set(false);
        this.toast.show('已加入购物车 · 共 ' + cart.count + ' 件');
        if (goCheckout) {
          this.router.navigate(['/checkout']);
        }
      },
      error: (err) => {
        this.adding.set(false);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  buyNow(): void {
    this.addToCart(true);
  }

  favorite(): void {
    const id = Number(this.id());
    const key = this.favoriteKey();
    let ids: number[] = [];
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      ids = Array.isArray(parsed) ? parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value)) : [];
    } catch {
      ids = [];
    }
    const has = ids.includes(id);
    const next = has ? ids.filter((value) => value !== id) : [...ids, id];
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // storage can be unavailable; the toggle still gives feedback
    }
    this.saved.set(!has);
    this.toast.show(has ? '已取消收藏' : '已收藏', has ? 'info' : 'success');
  }

  focusReviewForm(): void {
    document.getElementById('review-form')?.scrollIntoView({ block: 'center' });
    document.getElementById('review-body')?.focus();
  }

  goWriteReview(): void {
    if (!this.auth.isLoggedIn()) {
      this.toast.show('登录后即可发表评价', 'info');
      this.router.navigate(['/login'], {
        queryParams: { next: '/product/' + this.id() + '#reviews' },
      });
      return;
    }
    this.focusReviewForm();
  }

  onBodyInput(event: Event): void {
    this.formBody.set((event.target as HTMLTextAreaElement).value);
    if (this.bodyError()) {
      this.bodyError.set(null);
    }
  }

  submitReview(event: Event): void {
    event.preventDefault();
    if (this.submitting()) {
      return;
    }
    const body = this.formBody();
    if (!body.trim()) {
      this.bodyError.set('请填写评价内容');
      document.getElementById('review-body')?.focus();
      return;
    }
    this.bodyError.set(null);
    this.submitError.set(null);
    this.submitting.set(true);

    // V04: the body is submitted exactly as typed.
    this.reviewsApi.create(Number(this.id()), this.formRating(), body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.formBody.set('');
        this.formRating.set(5);
        this.toast.show('评价已提交');
        this.setTab('reviews');
        this.loadReviews(1);
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(errorMessage(err));
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  onReviewPage(page: number): void {
    this.loadReviews(page);
  }

  onReviewSize(size: number): void {
    this.reviewSize.set(size);
    this.loadReviews(1);
  }

  loadReviews(page: number): void {
    this.reviewsSub?.unsubscribe();
    this.reviewLoading.set(true);
    this.reviewError.set(null);
    this.reviewRequestId.set(undefined);

    this.reviewsSub = this.reviewsApi.list(this.id(), page, this.reviewSize()).subscribe({
      next: (res) => {
        const spec = this.specs()[0];
        const views = (res.items ?? []).map((review, index) => ({
          ...review,
          avatar: review.avatar || this.avatarFor(review.userName),
          // V04: the review body is bound with bypassSecurityTrustHtml + innerHTML.
          safeBody: this.sanitizer.bypassSecurityTrustHtml(review.body),
          photo: this.photoFor(review.rating, index),
          dateLabel: review.createdAt ? this.formatDay(new Date(review.createdAt)) : this.seededReviewDate(review.id, index),
          specLabel: spec ? spec.name + '：' + spec.value : '默认规格',
          likes: 3 + ((review.id * 7 + index * 5) % 24),
        }));
        this.reviews.set(views);
        this.reviewTotal.set(res.total ?? 0);
        this.reviewPage.set(page);
        const average = (res as unknown as { avgRating?: number }).avgRating;
        this.reviewAvg.set(
          typeof average === 'number' && Number.isFinite(average) && average > 0
            ? average
            : (this.product()?.rating ?? 0),
        );
        this.reviewLoading.set(false);
      },
      error: (err) => {
        this.reviewError.set(errorMessage(err));
        this.reviewRequestId.set(errorRequestId(err));
        this.reviewLoading.set(false);
      },
    });
  }

  selectColor(index: number): void {
    this.selectedColor.set(index);
  }

  selectPack(index: number): void {
    this.selectedPack.set(index);
  }

  memberPriceOf(product: Product): number {
    return memberPriceFor(product);
  }

  helpfulCount(review: ReviewView): number {
    return review.likes + (this.helpful().has(review.id) ? 1 : 0);
  }

  toggleHelpful(review: ReviewView): void {
    const next = new Set(this.helpful());
    if (next.has(review.id)) {
      next.delete(review.id);
    } else {
      next.add(review.id);
    }
    this.helpful.set(next);
  }

  toggleBundle(id: number): void {
    const next = new Set(this.bundleSelected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.bundleSelected.set(next);
  }

  toggleAllBundle(): void {
    if (this.bundleItems().length === this.bundle().length) {
      this.bundleSelected.set(new Set());
      return;
    }
    this.bundleSelected.set(new Set(this.bundle().map((item) => item.id)));
  }

  addBundle(): void {
    if (!this.auth.isLoggedIn()) {
      this.toast.show('登录后即可加入购物车', 'info');
      this.router.navigate(['/login'], { queryParams: { next: this.router.url } });
      return;
    }
    const items = this.bundleItems();
    if (items.length === 0 || this.adding()) {
      return;
    }
    this.adding.set(true);
    forkJoin(items.map((item) => this.cart.addProduct(item, 1))).subscribe({
      next: (carts) => {
        const cart = carts[carts.length - 1];
        this.adding.set(false);
        this.toast.show('已加入 ' + items.length + ' 件搭配商品 · 共 ' + cart.count + ' 件');
      },
      error: (err) => {
        this.adding.set(false);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  private photoFor(rating: number, index: number): string | undefined {
    if (rating < 4 || index > 1) {
      return undefined;
    }
    const product = this.product();
    if (index === 0 && product && product.id >= 1001 && product.id <= 1020) {
      return '/assets/sp/img/products/' + product.id + '-3.svg';
    }
    return this.sceneImage();
  }

  private formatDay(date: Date): string {
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (value: number) => String(value).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /** Seeded reviews carry no timestamp; keep a stable, recent-looking date. */
  private seededReviewDate(reviewId: number, index: number): string {
    const offset = 3 + ((Number(this.id()) + reviewId * 11 + index * 7) % 88);
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return this.formatDay(date);
  }

  reviewName(name: string): string {
    const local = (name || '').split('@')[0].trim();
    return local || '匿名用户';
  }

  private avatarFor(name: string): string {
    let hash = 0;
    for (const char of name || '') {
      hash = (hash * 31 + char.charCodeAt(0)) % 9973;
    }
    return '/assets/sp/img/avatars/' + (hash % 8 + 1) + '.svg';
  }

  private favoriteKey(): string {
    const user = this.auth.user();
    return FAVORITES_KEY + '.' + (user?.email || user?.id || 'guest');
  }

  private loadFavorite(): void {
    const id = Number(this.id());
    try {
      const raw = localStorage.getItem(this.favoriteKey());
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const ids = Array.isArray(parsed) ? parsed.map((value) => Number(value)) : [];
      this.saved.set(ids.includes(id));
    } catch {
      this.saved.set(false);
    }
  }

  private loadRelated(product: Product): void {
    this.relatedLoading.set(true);
    this.relatedSub?.unsubscribe();
    this.fillRelatedSub?.unsubscribe();
    this.relatedSub = this.api
      .list({ category: product.categoryId, size: 8, sort: 'sales' })
      .subscribe({
        next: (res) => {
          const items = (res.items ?? []).filter((item) => item.id !== product.id).slice(0, 4);
          this.related.set(items);
          this.bundleSelected.set(new Set(items.slice(0, 2).map((item) => item.id)));
          this.relatedLoading.set(false);
          if (items.length < 4) {
            this.fillRelated(product, items);
          }
        },
        error: () => {
          this.related.set([]);
          this.relatedLoading.set(false);
        },
      });
  }

  private fillRelated(product: Product, existing: Product[]): void {
    this.fillRelatedSub?.unsubscribe();
    this.fillRelatedSub = this.api
      .list({ size: 12, sort: 'sales' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          // A product switch may have started a newer request; never write the
          // previous product's fallback recommendations into the new page.
          if (this.product()?.id !== product.id) {
            return;
          }
          const merged = [...existing];
          const seen = new Set(merged.map((item) => item.id));
          seen.add(product.id);
          for (const item of res.items ?? []) {
            if (merged.length >= 4) {
              break;
            }
            if (seen.has(item.id)) {
              continue;
            }
            merged.push(item);
            seen.add(item.id);
          }
          this.related.set(merged);
        },
        error: () => undefined,
      });
  }

  /** Both /product/1003/reviews and /product/1003#reviews open the review tab. */
  private reviewsRequested(): boolean {
    const snapshot = this.route.snapshot;
    return snapshot.fragment === 'reviews' || snapshot.url.some((segment) => segment.path === 'reviews');
  }

  private finishLoading(): void {
    this.loading.set(false);
    this.showSkeleton.set(false);
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
      this.skeletonTimer = undefined;
    }
  }

  private scrollToReviews(): void {
    // The reviews panel only exists after the tab switch is rendered, so wait
    // for the next render instead of a fixed timeout.
    afterNextRender(
      () => {
        // Land on the tab strip so the tab labels stay visible below the sticky header.
        document.getElementById('product-tabs')?.scrollIntoView({ block: 'start' });
      },
      { injector: this.injector },
    );
  }
}