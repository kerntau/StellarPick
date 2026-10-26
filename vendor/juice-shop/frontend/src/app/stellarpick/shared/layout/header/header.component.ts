import { Component, DestroyRef, ElementRef, HostListener, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { CartService } from '../../../core/cart.service';
import { CATEGORIES } from '../../../core/catalog';
import { IconComponent } from '../../ui/icon/icon.component';

interface NavItem {
  label: string;
  path: string;
  fragment?: string;
}

const RECENT_KEY = 'sp.recent';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthStore);
  readonly authService = inject(AuthService);
  readonly cart = inject(CartService);

  readonly scrolled = signal(false);
  readonly searchOpen = signal(false);
  readonly accountOpen = signal(false);
  readonly mobileOpen = signal(false);
  readonly query = signal('');
  readonly recent = signal<string[]>([]);
  /** Path cached once per navigation so template calls don't re-split router.url. */
  readonly currentPath = signal(this.router.url.split('?')[0].split('#')[0]);

  /** Quick category rail under the main bar (seeded catalogue metadata). */
  readonly categories = CATEGORIES;

  /** Suggestions shown in the expanded search panel. */
  readonly hot = ['保温杯', '四件套', '充电器', '香薰', '登机箱'];

  readonly nav: NavItem[] = [
    { label: '首页', path: '/' },
    { label: '全部商品', path: '/category/all' },
    { label: '会员权益', path: '/about', fragment: 'member' },
    { label: '关于我们', path: '/about' },
    { label: '帮助中心', path: '/help' },
    { label: '联系客服', path: '/support/tickets' },
  ];

  constructor() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      this.recent.set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      this.recent.set([]);
    }
    effect(() => {
      document.body.style.overflow = this.mobileOpen() ? 'hidden' : '';
    });
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentPath.set(this.router.url.split('?')[0].split('#')[0]);
        // A route change must not leave the mobile drawer open (and the body
        // scroll-locked) on the destination page.
        this.closePanels();
      });
    if (typeof window !== 'undefined') {
      const desktop = window.matchMedia('(min-width: 1024px)');
      const onChange = (event: MediaQueryListEvent): void => {
        if (event.matches) {
          this.mobileOpen.set(false);
        }
      };
      desktop.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => desktop.removeEventListener('change', onChange));
    }
    if (this.auth.isLoggedIn()) {
      this.cart.refresh().subscribe({ error: () => undefined });
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target || this.host.nativeElement.contains(target)) {
      return;
    }
    this.closePanels();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePanels(true);
  }

  /** "/" focuses the search field, like most storefronts. */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return;
    }
    event.preventDefault();
    this.mobileOpen.set(false);
    this.accountOpen.set(false);
    if (!this.searchOpen()) {
      this.searchOpen.set(true);
    }
    setTimeout(() => {
      this.host.nativeElement.querySelector<HTMLInputElement>('#global-search')?.focus();
    });
  }

  closePanels(refocus = false): void {
    this.searchOpen.set(false);
    this.accountOpen.set(false);
    this.mobileOpen.set(false);
    if (refocus) {
      this.refocusOpener();
    }
  }

  /** Return keyboard focus to the button that opened the panel (Escape / outside click). */
  private refocusOpener(): void {
    const opener = this.host.nativeElement.querySelector<HTMLElement>('[data-panel-opener].is-open');
    opener?.focus();
  }

  /** Highlights the category strip for /category/:slug. */
  isCategoryActive(slug: string): boolean {
    const path = this.currentPath();
    if (slug === 'all') {
      return path === '/category' || path === '/category/all';
    }
    return path === '/category/' + slug;
  }

  isActive(item: NavItem): boolean {
    const path = this.currentPath();
    if (item.path === '/') {
      return path === '/';
    }
    if (path !== item.path && !path.startsWith(item.path + '/')) {
      return false;
    }
    if (item.fragment) {
      return this.router.url.includes('#' + item.fragment);
    }
    return !this.router.url.includes('#');
  }

  toggleSearch(): void {
    this.mobileOpen.set(false);
    this.accountOpen.set(false);
    this.searchOpen.update((open) => !open);
    if (this.searchOpen()) {
      setTimeout(() => {
        const input = this.host.nativeElement.querySelector<HTMLInputElement>('#global-search');
        input?.focus();
      });
    }
  }

  submitSearch(value?: string): void {
    const q = (value ?? this.query()).trim();
    if (!q) {
      return;
    }
    this.remember(q);
    this.query.set(q);
    this.searchOpen.set(false);
    this.mobileOpen.set(false);
    this.router.navigate(['/search'], { queryParams: { q } });
  }

  useRecent(q: string): void {
    this.query.set(q);
    this.submitSearch(q);
  }

  onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  toggleAccount(event: Event): void {
    event.stopPropagation();
    this.mobileOpen.set(false);
    this.searchOpen.set(false);
    this.accountOpen.update((open) => !open);
  }

  toggleMobile(): void {
    this.mobileOpen.update((open) => !open);
    this.searchOpen.set(false);
    this.accountOpen.set(false);
  }

  logout(): void {
    this.accountOpen.set(false);
    this.mobileOpen.set(false);
    this.authService.logout();
  }

  private remember(q: string): void {
    const next = [q, ...this.recent().filter((item) => item !== q)].slice(0, 5);
    this.recent.set(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // storage may be unavailable; search still works
    }
  }
}
