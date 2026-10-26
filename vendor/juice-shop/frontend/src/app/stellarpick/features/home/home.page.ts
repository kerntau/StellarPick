import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductsApi } from '../../core/api/products.api';
import { Category, Product, errorMessage, errorRequestId } from '../../core/models';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ProductCardComponent } from '../../shared/ui/product-card/product-card.component';
import { RatingStarsComponent } from '../../shared/ui/rating-stars/rating-stars.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

interface HeroSlide {
  id: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  link: string;
  image: string;
  alt: string;
  note: string;
}

interface CategoryTile {
  slug: string;
  name: string;
  en: string;
  icon: string;
  desc: string;
  image: string;
}

interface PromiseItem {
  icon: string;
  title: string;
  desc: string;
}

interface SceneCard {
  slug: string;
  image: string;
  label: string;
  title: string;
  copy: string;
  link: string;
}

interface ReviewQuote {
  id: number;
  name: string;
  avatar: string;
  rating: number;
  date: string;
  body: string;
  variant: string;
}

interface ServiceItem {
  icon: string;
  title: string;
  desc: string;
  link: string;
  action: string;
}

const AUTOPLAY_MS = 6000;

const CATEGORY_TILES: readonly CategoryTile[] = [
  { slug: 'kitchen', name: '厨房', en: 'Kitchen', icon: 'utensils', desc: '锅具 · 餐具 · 咖啡', image: '/assets/sp/img/categories/kitchen.svg' },
  { slug: 'home', name: '家居', en: 'Home', icon: 'sofa', desc: '床品 · 香薰 · 收纳', image: '/assets/sp/img/categories/home.svg' },
  { slug: 'personal', name: '个护', en: 'Personal', icon: 'droplet', desc: '洁面 · 护手 · 口腔', image: '/assets/sp/img/categories/personal.svg' },
  { slug: 'digital', name: '数码', en: 'Digital', icon: 'smartphone', desc: '充电 · 音频 · 桌面', image: '/assets/sp/img/categories/digital.svg' },
  { slug: 'travel', name: '出行', en: 'Travel', icon: 'briefcase', desc: '箱包 · 晴雨 · 颈枕', image: '/assets/sp/img/categories/travel.svg' },
  { slug: 'food', name: '食品', en: 'Food', icon: 'apple', desc: '咖啡 · 坚果 · 礼盒', image: '/assets/sp/img/categories/food.svg' },
];

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    ErrorStateComponent,
    IconComponent,
    MoneyPipe,
    ProductCardComponent,
    RatingStarsComponent,
    RouterLink,
    SkeletonComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly api = inject(ProductsApi);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly slides: readonly HeroSlide[] = [
    {
      id: 1,
      eyebrow: '新品首发',
      title: '把日常，选得更好',
      subtitle: '从厨房到出行，精选每一件值得长期使用的日常好物。',
      cta: '逛逛新品',
      link: '/category/all',
      image: '/assets/sp/img/hero/hero-1.svg',
      alt: '晨光下的厨房台面，摆着保温杯与手冲器具',
      note: '2026 秋季选品 · 12 件上新',
    },
    {
      id: 2,
      eyebrow: '会员日',
      title: '每满 300 减 40，全年包邮',
      subtitle: '会员专享折扣、积分回馈与专属客服，把会员日过成日常。',
      cta: '加入会员',
      link: '/register',
      image: '/assets/sp/img/hero/hero-2.svg',
      alt: '客厅一角，羊毛毯与香薰蜡烛',
      note: '每周三 00:00–24:00 · 会员专享',
    },
    {
      id: 3,
      eyebrow: '夏日精选',
      title: '清爽上新，轻一点过夏天',
      subtitle: '冷萃咖啡、雪松香薰与轻便出行装备，一起把夏天过得轻一点。',
      cta: '看看精选',
      link: '/category/all',
      image: '/assets/sp/img/hero/hero-3.svg',
      alt: '旅行箱与随身包袋摆在木地板上',
      note: '冷萃咖啡 · 雪松香薰 · 登机箱',
    },
  ];

  readonly categories: readonly CategoryTile[] = CATEGORY_TILES;

  readonly hotKeywords: readonly string[] = ['保温杯', '四件套', '充电器', '香薰'];

  /** 服务承诺条：真实电商的信任层，紧跟 Hero。 */
  readonly promises: readonly PromiseItem[] = [
    { icon: 'truck', title: '满 99 元包邮', desc: '会员全年包邮，工作日 16:00 前下单当日发货' },
    { icon: 'refresh', title: '7 天无理由', desc: '不影响二次销售即可退换，运费我们承担' },
    { icon: 'shield', title: '正品保障', desc: '品牌直供，支持批次与溯源查询' },
    { icon: 'headset', title: '客服在线', desc: '每日 9:00–21:00，工单当日跟进' },
  ];

  readonly scenes: readonly SceneCard[] = [
    {
      slug: 'kitchen',
      image: '/assets/sp/img/scenes/kitchen.svg',
      label: '在厨房',
      title: '一天从一杯手冲开始',
      copy: '手冲壶、保温杯与餐盘，台面上只留常用的几件。',
      link: '/category/kitchen',
    },
    {
      slug: 'home',
      image: '/assets/sp/img/scenes/living.svg',
      label: '在客厅',
      title: '把灯光和气味调低一点',
      copy: '香薰、羊毛毯与收纳筐，客厅安静下来。',
      link: '/category/home',
    },
    {
      slug: 'digital',
      image: '/assets/sp/img/scenes/desk.svg',
      label: '在书桌',
      title: '少一点线，多一点专注',
      copy: '65W 充电器、静音键鼠与显示器支架。',
      link: '/category/digital',
    },
  ];

  /** 评价文案为编辑撰写；右侧商品始终来自真实商品接口。 */
  readonly quotes: readonly ReviewQuote[] = [
    {
      id: 1,
      name: '林晓',
      avatar: '/assets/sp/img/avatars/1.svg',
      rating: 4.9,
      date: '2026-10-12',
      body: '保温杯放包里一天不洒，下午开会倒出来还是烫的。杯口收边打磨得很细，直接喝也不硌嘴。',
      variant: '银色 500ml',
    },
    {
      id: 2,
      name: '周远',
      avatar: '/assets/sp/img/avatars/3.svg',
      rating: 4.8,
      date: '2026-10-08',
      body: '四件套洗了三次没有起球，颜色比图片更耐看。包装是纸质的，拆开没有塑料味。',
      variant: '1.8m 床 · 燕麦色',
    },
    {
      id: 3,
      name: '苏晴',
      avatar: '/assets/sp/img/avatars/6.svg',
      rating: 4.7,
      date: '2026-09-29',
      body: '手冲壶水流很稳，第一次就冲出不苦的味道。客服还发了一份冲煮参数，挺意外。',
      variant: '600ml · 玻璃',
    },
  ];

  /** 会员权益：与顶部服务承诺区分开，讲会员专属的那部分。 */
  readonly benefits: readonly PromiseItem[] = [
    { icon: 'truck', title: '全年包邮', desc: '会员订单不限金额，全国包邮到家' },
    { icon: 'percent', title: '会员折扣', desc: '精选商品专享价，会员日每满 300 减 40' },
    { icon: 'medal', title: '积分抵现', desc: '每消费 1 元积 1 分，积分可直接抵现' },
    { icon: 'headset', title: '专属客服', desc: '会员专线优先响应，售后当日跟进' },
  ];

  readonly services: readonly ServiceItem[] = [
    { icon: 'headset', title: '客服热线', desc: '400-000-0000 · 每日 9:00–21:00', link: '/support/tickets', action: '提交工单' },
    { icon: 'info', title: '常见问题', desc: '配送、退换、发票与会员规则', link: '/help', action: '查看帮助中心' },
    { icon: 'map-pin', title: '门店自提', desc: '上海市徐汇区星澜路 88 号 · 10:00–22:00', link: '/about', action: '门店信息' },
  ];

  readonly featuredSkeletons = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly railSkeletons = [1, 2, 3, 4];

  readonly slide = signal(0);
  readonly autoplay = signal(!this.reducedMotion);
  readonly paused = signal(false);
  readonly heroQuery = signal('');
  /** Bumped on every (re)start so the progress bar animation replays. */
  readonly cycle = signal(0);

  readonly featured = signal<Product[]>([]);
  readonly featuredLoading = signal(true);
  readonly featuredSkeleton = signal(false);
  readonly featuredError = signal<string | null>(null);
  readonly featuredRequestId = signal<string | undefined>(undefined);

  readonly newest = signal<Product[]>([]);
  readonly newestLoading = signal(true);
  readonly newestError = signal<string | null>(null);
  readonly newestRequestId = signal<string | undefined>(undefined);
  readonly picks = signal<Product[]>([]);
  readonly picksError = signal<string | null>(null);
  readonly picksRequestId = signal<string | undefined>(undefined);

  readonly categoryCounts = signal<ReadonlyMap<string, number>>(new Map());
  /** Keys of illustrations that failed to load; the tile falls back to a paper swatch. */
  readonly imageFailed = signal<ReadonlySet<string>>(new Set());

  readonly categoryTiles = computed(() => {
    const counts = this.categoryCounts();
    // A representative product per category backs up a missing illustration.
    const pool = [...this.featured(), ...this.newest(), ...this.picks()];
    return this.categories.map((tile) => ({
      ...tile,
      count: counts.get(tile.slug) ?? null,
      sample: pool.find((product) => (product.categoryId ?? product.category) === tile.slug) ?? null,
    }));
  });

  readonly catalogTotal = computed(() => this.categoryCounts().get('all') ?? null);

  readonly heroPick = computed(() => this.featured()[0] ?? null);

  /** The rail falls back to the sales list so the section never collapses. */
  readonly railProducts = computed(() => (this.newest().length > 0 ? this.newest() : this.featured()));

  readonly editorialSource = computed(() =>
    this.picks().length > 0 ? this.picks() : this.featured(),
  );
  readonly editorLead = computed(() => this.editorialSource()[0] ?? null);
  readonly editorRest = computed(() => this.editorialSource().slice(1, 5));
  readonly leadSpecs = computed(() => this.editorLead()?.specs ?? []);

  /** Quotes paired with the real product the reviewer bought. */
  readonly reviewCards = computed(() => {
    const products = this.featured();
    return this.quotes
      .map((quote, index) => ({ quote, product: products[index + 4] ?? null }))
      .filter((entry) => entry.product !== null);
  });

  readonly sceneCards = computed(() => {
    const counts = this.categoryCounts();
    return this.scenes.map((scene) => ({ ...scene, count: counts.get(scene.slug) ?? null }));
  });


  private timer: ReturnType<typeof setTimeout> | null = null;
  private featuredTimer?: ReturnType<typeof setTimeout>;
  private featuredSub?: Subscription;
  private newestSub?: Subscription;
  private picksSub?: Subscription;
  private categoriesSub?: Subscription;
  private hidden = false;

  private readonly onVisibilityChange = (): void => {
    this.hidden = typeof document !== 'undefined' && document.hidden;
    if (this.hidden) {
      this.stopTimer();
    } else {
      this.restart();
    }
  };

  constructor() {
    this.title.setTitle('星澜优选 · 把日常，选得更好');

    this.restart();
    this.loadFeatured();
    this.loadNewest();
    this.loadPicks();
    this.loadCategories();

    if (typeof document !== 'undefined') {
      this.hidden = document.hidden;
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    this.destroyRef.onDestroy(() => {
      this.stopTimer();
      if (this.featuredTimer) {
        clearTimeout(this.featuredTimer);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
      }
      this.featuredSub?.unsubscribe();
      this.newestSub?.unsubscribe();
      this.picksSub?.unsubscribe();
      this.categoriesSub?.unsubscribe();
    });
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.slides.length) {
      return;
    }
    this.slide.set(index);
    this.restart();
  }

  next(): void {
    this.slide.update((index) => (index + 1) % this.slides.length);
    this.restart();
  }

  prev(): void {
    this.slide.update((index) => (index + this.slides.length - 1) % this.slides.length);
    this.restart();
  }

  pause(): void {
    this.paused.set(true);
    this.stopTimer();
  }

  resume(): void {
    this.paused.set(false);
    this.restart();
  }

  toggleAutoplay(): void {
    this.autoplay.update((value) => !value);
    this.restart();
  }

  /** 方向键 / Home / End 在轮播内切换；输入框里的方向键保持默认行为。 */
  onHeroKeydown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return;
    }
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        this.next();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.prev();
        break;
      case 'Home':
        event.preventDefault();
        this.goTo(0);
        break;
      case 'End':
        event.preventDefault();
        this.goTo(this.slides.length - 1);
        break;
      default:
        break;
    }
  }

  onHeroInput(event: Event): void {
    this.heroQuery.set((event.target as HTMLInputElement).value);
  }

  submitHeroSearch(event: Event): void {
    event.preventDefault();
    const keyword = this.heroQuery().trim();
    if (!keyword) {
      return;
    }
    this.router.navigate(['/search'], { queryParams: { q: keyword } });
  }

  searchKeyword(keyword: string): void {
    this.router.navigate(['/search'], { queryParams: { q: keyword } });
  }

  /** Illustration missing (asset not shipped yet): swap in a paper swatch. */
  onImageError(key: string): void {
    const next = new Set(this.imageFailed());
    next.add(key);
    this.imageFailed.set(next);
  }

  scrollToNewsletter(): void {
    document.getElementById('newsletter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  loadFeatured(): void {
    this.featuredSub?.unsubscribe();
    this.featuredLoading.set(true);
    this.featuredError.set(null);
    this.featuredRequestId.set(undefined);
    this.featuredSkeleton.set(false);
    if (this.featuredTimer) {
      clearTimeout(this.featuredTimer);
    }
    this.featuredTimer = setTimeout(() => {
      if (this.featuredLoading()) {
        this.featuredSkeleton.set(true);
      }
    }, 300);

    this.featuredSub = this.api.list({ size: 8, sort: 'sales' }).subscribe({
      next: (res) => {
        this.featured.set(res.items ?? []);
        this.finishFeatured();
      },
      error: (err) => {
        this.featured.set([]);
        this.featuredError.set(errorMessage(err));
        this.featuredRequestId.set(errorRequestId(err));
        this.finishFeatured();
      },
    });
  }

  loadNewest(): void {
    this.newestSub?.unsubscribe();
    this.newestLoading.set(true);
    this.newestError.set(null);
    this.newestRequestId.set(undefined);
    this.newestSub = this.api.list({ size: 6, sort: 'newest' }).subscribe({
      next: (res) => {
        this.newest.set(res.items ?? []);
        this.newestLoading.set(false);
      },
      error: (err) => {
        this.newest.set([]);
        this.newestError.set(errorMessage(err));
        this.newestRequestId.set(errorRequestId(err));
        this.newestLoading.set(false);
      },
    });
  }

  loadPicks(): void {
    this.picksSub?.unsubscribe();
    this.picksError.set(null);
    this.picksRequestId.set(undefined);
    this.picksSub = this.api.list({ size: 5 }).subscribe({
      next: (res) => {
        this.picks.set(res.items ?? []);
        this.picksError.set(null);
      },
      error: (err) => {
        this.picks.set([]);
        this.picksError.set(errorMessage(err));
        this.picksRequestId.set(errorRequestId(err));
      },
    });
  }

  private loadCategories(): void {
    this.categoriesSub?.unsubscribe();
    this.categoriesSub = this.api.categories().subscribe({
      next: (list: Category[]) => {
        const counts = new Map<string, number>();
        for (const category of list) {
          counts.set(category.slug, category.count);
        }
        this.categoryCounts.set(counts);
      },
      // 分类数量只是锦上添花，失败时不打断首页。
      error: () => this.categoryCounts.set(new Map()),
    });
  }

  private finishFeatured(): void {
    this.featuredLoading.set(false);
    this.featuredSkeleton.set(false);
    if (this.featuredTimer) {
      clearTimeout(this.featuredTimer);
      this.featuredTimer = undefined;
    }
  }

  private restart(): void {
    this.stopTimer();
    this.cycle.update((value) => value + 1);
    if (!this.autoplay() || this.paused() || this.hidden) {
      return;
    }
    this.timer = setTimeout(() => {
      this.slide.update((index) => (index + 1) % this.slides.length);
      this.restart();
    }, AUTOPLAY_MS);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
