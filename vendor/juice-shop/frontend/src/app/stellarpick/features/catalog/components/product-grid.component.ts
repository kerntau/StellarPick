import { Component, computed, input, output } from '@angular/core';
import { Product } from '../../../core/models';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { ProductCardComponent } from '../../../shared/ui/product-card/product-card.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { CatalogTileComponent } from './catalog-tile.component';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [CatalogTileComponent, ErrorStateComponent, ProductCardComponent, SkeletonComponent],
  template: `
    @if (error()) {
      <app-error-state [message]="error() ?? ''" [requestId]="requestId()" (retry)="retry.emit()" />
    } @else if (showSkeleton() && products().length === 0) {
      <div class="sp-grid-products" aria-hidden="true">
        @for (item of skeletons(); track item) {
          <app-skeleton variant="card" />
        }
      </div>
    } @else {
      <div class="sp-grid-products" [attr.aria-busy]="loading()">
        @for (product of products(); track product.id; let index = $index) {
          @if (variant() === 'tile') {
            <app-catalog-tile [product]="product" [priority]="index < 4" />
          } @else {
            <app-product-card [product]="product" />
          }
        }
      </div>
    }
  `,
})
export class ProductGridComponent {
  readonly products = input<Product[]>([]);
  readonly loading = input(false);
  readonly showSkeleton = input(false);
  readonly error = input<string | null>(null);
  readonly requestId = input<string | undefined>(undefined);
  readonly skeletonCount = input(8);
  /** 'card' keeps the shared product card; 'tile' is the denser search listing. */
  readonly variant = input<'card' | 'tile'>('card');
  readonly retry = output<void>();

  readonly skeletons = computed(() => Array.from({ length: this.skeletonCount() }, (_, index) => index));
}
