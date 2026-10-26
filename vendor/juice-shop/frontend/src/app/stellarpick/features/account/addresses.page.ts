import { Component, computed, inject, signal } from '@angular/core';
import { AccountApi } from '../../core/api/account.api';
import { Address, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ConfirmDialogComponent } from './components/confirm-dialog.component';

interface AddressForm {
  name: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
}

interface AddressErrors {
  name?: string;
  phone?: string;
  region?: string;
  detail?: string;
}

const EMPTY_FORM: AddressForm = { name: '', phone: '', region: '', detail: '', isDefault: false };

@Component({
  selector: 'app-addresses-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    ErrorStateComponent,
    ModalComponent,
    SkeletonComponent,
    IconComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <div class="page-head">
      <div>
        <span class="sp-eyebrow">ADDRESS BOOK · 地址簿</span>
        <h1>收货地址</h1>
        <p class="sp-secondary">管理常用的收货信息，下单时可以直接选择。</p>
      </div>
      <div class="head-actions">
        @if (addresses().length > 0) {
          <span class="sp-text-13 sp-muted">共 {{ addresses().length }} 个地址</span>
        }
        <button class="sp-btn sp-btn--primary" type="button" (click)="openCreate()">
          <app-icon name="plus" [size]="18" /> 新增地址
        </button>
      </div>
    </div>

    @if (addresses().length > 0) {
      <p class="addr-note">
        <app-icon name="info" [size]="14" />
        默认地址会在结算时自动选中；地址仅用于配送，不会用于其他用途。
      </p>
    }

    @if (showSkeleton()) {
      <div class="addr-grid">
        @for (row of skeletonRows; track row) {
          <div class="sp-card sp-card--pad"><app-skeleton variant="line" width="70%" /></div>
        }
      </div>
    } @else if (error()) {
      <app-error-state
        [message]="error() ?? '加载失败，请稍后重试'"
        [requestId]="requestId()"
        (retry)="load()"
      />
    } @else if (addresses().length === 0) {
      <app-empty-state
        image="orders"
        title="还没有收货地址"
        description="新增一个收货地址，结算时就能直接选择，不用每次重复填写。"
        actionLabel="新增收货地址"
        (action)="openCreate()"
      />
    } @else {
      <div class="addr-grid">
        @for (address of addresses(); track address.id) {
          <article class="sp-card addr" [class.addr--default]="address.isDefault">
            <header class="addr-head">
              <span class="addr-avatar" aria-hidden="true">{{ address.name.slice(0, 1) }}</span>
              <div class="addr-id-block">
                <strong class="addr-name">{{ address.name }}</strong>
                <span class="addr-phone sp-num">{{ address.phone }}</span>
              </div>
              @if (address.isDefault) {
                <span class="sp-badge sp-badge--accent addr-default">默认地址</span>
              }
            </header>

            <p class="addr-region"><span class="addr-tag"><app-icon name="truck" [size]="12" /> 配送至</span>{{ address.region }}</p>
            <p class="addr-detail">{{ address.detail }}</p>

            <footer class="addr-actions">
              <span class="sp-text-12 sp-muted addr-id">地址编号 {{ address.id }}</span>
              @if (!address.isDefault) {
                <button
                  class="sp-btn sp-btn--ghost sp-btn--sm"
                  type="button"
                  [disabled]="busyId() === address.id"
                  (click)="setDefault(address)"
                >
                  <app-icon name="check" [size]="15" /> 设为默认
                </button>
              }
              <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="openEdit(address)">
                <app-icon name="edit" [size]="15" /> 编辑
              </button>
              <button
                class="sp-btn sp-btn--ghost sp-btn--sm danger-text"
                type="button"
                (click)="askDelete(address)"
              >
                <app-icon name="trash" [size]="15" /> 删除
              </button>
            </footer>
          </article>
        }
        <button class="addr-add" type="button" (click)="openCreate()">
          <span class="addr-add-icon" aria-hidden="true"><app-icon name="plus" [size]="18" /></span>
          <span class="addr-add-text"><strong>新增收货地址</strong><small>配送到新的地址</small></span>
        </button>
      </div>
    }

    <app-modal [open]="formOpen()" [title]="editingId() === null ? '新增收货地址' : '编辑收货地址'" (closed)="closeForm()">
      <form (submit)="save($event)" novalidate>
        @if (formError()) {
          <div class="sp-alert sp-alert--error" role="alert">{{ formError() }}</div>
        }

        <div class="sp-field">
          <label class="sp-label" for="addr-name">收件人<span class="sp-req">*</span></label>
          <input
            id="addr-name"
            class="sp-input"
            type="text"
            autocomplete="name"
            aria-required="true"
            [value]="form().name"
            (input)="setField('name', $event)"
            [attr.aria-invalid]="errors().name ? 'true' : null"
            [attr.aria-describedby]="errors().name ? 'addr-name-err' : null"
          />
          @if (errors().name) {
            <p class="sp-error" id="addr-name-err" role="alert">{{ errors().name }}</p>
          }
        </div>

        <div class="sp-field">
          <label class="sp-label" for="addr-phone">手机号<span class="sp-req">*</span></label>
          <input
            id="addr-phone"
            class="sp-input"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            maxlength="11"
            aria-required="true"
            placeholder="11 位手机号"
            [value]="form().phone"
            (input)="setField('phone', $event)"
            [attr.aria-invalid]="errors().phone ? 'true' : null"
            [attr.aria-describedby]="errors().phone ? 'addr-phone-err' : 'addr-phone-hint'"
          />
          @if (errors().phone) {
            <p class="sp-error" id="addr-phone-err" role="alert">{{ errors().phone }}</p>
          } @else {
            <p class="sp-hint" id="addr-phone-hint">请填写 11 位手机号，用于配送联系。</p>
          }
        </div>

        <div class="sp-field">
          <label class="sp-label" for="addr-region">省市区<span class="sp-req">*</span></label>
          <input
            id="addr-region"
            class="sp-input"
            type="text"
            autocomplete="address-level1"
            aria-required="true"
            placeholder="例如：上海市 星澜区"
            [value]="form().region"
            (input)="setField('region', $event)"
            [attr.aria-invalid]="errors().region ? 'true' : null"
            [attr.aria-describedby]="errors().region ? 'addr-region-err' : null"
          />
          @if (errors().region) {
            <p class="sp-error" id="addr-region-err" role="alert">{{ errors().region }}</p>
          }
        </div>

        <div class="sp-field">
          <label class="sp-label" for="addr-detail">详细地址<span class="sp-req">*</span></label>
          <input
            id="addr-detail"
            class="sp-input"
            type="text"
            autocomplete="street-address"
            aria-required="true"
            placeholder="街道、门牌号、楼层与房间号"
            [value]="form().detail"
            (input)="setField('detail', $event)"
            [attr.aria-invalid]="errors().detail ? 'true' : null"
            [attr.aria-describedby]="errors().detail ? 'addr-detail-err' : null"
          />
          @if (errors().detail) {
            <p class="sp-error" id="addr-detail-err" role="alert">{{ errors().detail }}</p>
          }
        </div>

        <label class="sp-check default-check">
          <input type="checkbox" [checked]="form().isDefault" (change)="toggleDefault($event)" />
          设为默认收货地址
        </label>

        <div class="form-actions">
          <button class="sp-btn sp-btn--secondary" type="button" (click)="closeForm()">取消</button>
          <button class="sp-btn sp-btn--primary" type="submit" [disabled]="saving()">
            {{ saving() ? '保存中…' : '保存地址' }}
          </button>
        </div>
      </form>
    </app-modal>

    <app-confirm-dialog
      [open]="deleteTarget() !== null"
      title="删除收货地址"
      [message]="deleteMessage()"
      confirmLabel="删除地址"
      [danger]="true"
      [busy]="deleting()"
      [error]="deleteError()"
      (confirmed)="confirmDelete()"
      (closed)="closeDelete()"
    />
  `,
  styles: [
    `
      .page-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 20px;
        flex-wrap: wrap;
      }
      .page-head h1 { font-family: var(--sp-serif); font-size: 32px; letter-spacing: .02em; }
      .page-head p { margin-top: 4px; }
      .addr-note {
        display: flex;
        align-items: flex-start;
        gap: 5px;
        margin: -8px 0 16px;
        font-size: 12px;
        color: var(--sp-text-muted);
        line-height: 1.5;
      }
      .addr-note app-icon { flex: 0 0 auto; margin-top: 1px; }

      .addr-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .addr {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 18px 20px;
        border-left: 3px solid transparent;
        min-width: 0;
      }
      .addr--default { border-left-color: var(--sp-accent); background: #FFFDF8; }
      .addr-head {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .addr-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: var(--sp-primary);
        color: var(--sp-accent-strong);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 700;
        flex: 0 0 auto;
      }
      .addr-id-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .addr-name { font-size: var(--sp-text-16); }
      .addr-phone { color: var(--sp-text-secondary); font-size: var(--sp-text-13); }
      .addr-default { margin-left: auto; }
      .addr-region { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: var(--sp-text-13); color: var(--sp-text-secondary); }
      .addr-tag { display: inline-flex; align-items: center; gap: 3px; padding: 0 5px; border-radius: 3px; background: var(--sp-success-soft); color: var(--sp-success); font-size: 10.5px; }
      .addr-detail { font-size: var(--sp-text-14); line-height: 1.6; overflow-wrap: anywhere; }
      .addr-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
        margin-top: auto;
        padding-top: 12px;
        border-top: 1px solid var(--sp-border);
      }
      .addr-actions .sp-btn { min-height: 44px; }
      .addr-id { margin-right: auto; }
      .addr-add {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 180px;
        padding: 20px;
        border: 1px dashed var(--sp-border-strong);
        border-radius: var(--sp-radius-md);
        background: transparent;
        color: var(--sp-text-secondary);
        text-align: left;
      }
      .addr-add:hover { border-color: var(--sp-primary); background: #FCFAF6; color: var(--sp-primary); }
      .addr-add-icon {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: var(--sp-bg);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
      }
      .addr-add-text { display: flex; flex-direction: column; gap: 1px; }
      .addr-add-text strong { font-size: 13px; }
      .addr-add-text small { font-size: 11px; color: var(--sp-text-muted); }
      .danger-text { color: var(--sp-danger); }
      .head-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

      .sp-alert { margin-bottom: 16px; }
      .default-check { margin: 4px 0 20px; }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      @media (max-width: 1023px) {
        .addr-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 767px) {
        .page-head h1 { font-size: 28px; }
        .addr-add { min-height: 96px; justify-content: flex-start; }
        .page-head .sp-btn { width: 100%; }
        .addr-actions .sp-btn { min-height: 44px; }
      }
      @media (max-width: 480px) {
        .form-actions { flex-direction: column-reverse; }
        .form-actions .sp-btn { width: 100%; }
      }
    `,
  ],
})
export class AddressesPage {
  private readonly api = inject(AccountApi);
  private readonly toast = inject(ToastService);

  readonly addresses = signal<Address[]>([]);
  readonly showSkeleton = signal(false);
  readonly error = signal<string | null>(null);
  readonly requestId = signal<string | undefined>(undefined);
  readonly busyId = signal<number | null>(null);

  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly form = signal<AddressForm>({ ...EMPTY_FORM });
  readonly errors = signal<AddressErrors>({});
  readonly formError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly deleteTarget = signal<Address | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  readonly skeletonRows = [1, 2, 3, 4];

  readonly deleteMessage = computed(() => {
    const target = this.deleteTarget();
    return target ? '确定删除「' + target.name + '」的收货地址吗？删除后无法恢复。' : '';
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.error.set(null);
    this.requestId.set(undefined);
    this.showSkeleton.set(false);
    const timer = setTimeout(() => this.showSkeleton.set(true), 300);
    this.api.addresses().subscribe({
      next: (items) => {
        clearTimeout(timer);
        this.showSkeleton.set(false);
        this.addresses.set(items ?? []);
      },
      error: (err) => {
        clearTimeout(timer);
        this.showSkeleton.set(false);
        this.error.set(errorMessage(err));
        this.requestId.set(errorRequestId(err));
      },
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.errors.set({});
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEdit(address: Address): void {
    this.editingId.set(address.id);
    this.form.set({
      name: address.name ?? '',
      phone: address.phone ?? '',
      region: address.region ?? '',
      detail: address.detail ?? '',
      isDefault: !!address.isDefault,
    });
    this.errors.set({});
    this.formError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.saving()) {
      return;
    }
    this.formOpen.set(false);
  }

  setField(field: 'name' | 'phone' | 'region' | 'detail', event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    if (field === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 11);
      input.value = value;
    }
    this.form.update((form) => ({ ...form, [field]: value }));
    this.errors.update((errors) => ({ ...errors, [field]: undefined }));
    this.formError.set(null);
  }

  toggleDefault(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.form.update((form) => ({ ...form, isDefault: checked }));
  }

  save(event: Event): void {
    event.preventDefault();
    const form = this.form();
    const errors: AddressErrors = {};
    if (!form.name.trim()) {
      errors.name = '请填写收件人姓名。';
    }
    if (!/^\d{11}$/.test(form.phone.trim())) {
      errors.phone = '手机号应为 11 位数字。';
    }
    if (!form.region.trim()) {
      errors.region = '请填写省市区，例如：上海市 星澜区。';
    }
    if (!form.detail.trim()) {
      errors.detail = '请填写详细地址，方便配送。';
    }
    this.errors.set(errors);

    const order: (keyof AddressErrors)[] = ['name', 'phone', 'region', 'detail'];
    const firstError = order.find((key) => errors[key]);
    if (firstError) {
      setTimeout(() => document.getElementById('addr-' + firstError)?.focus());
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      region: form.region.trim(),
      detail: form.detail.trim(),
      isDefault: form.isDefault,
    };

    this.saving.set(true);
    this.formError.set(null);
    const id = this.editingId();
    const request = id === null ? this.api.createAddress(payload) : this.api.updateAddress(id, payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.show(id === null ? '地址已添加' : '地址已更新');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }

  setDefault(address: Address): void {
    if (address.isDefault || this.busyId() !== null) {
      return;
    }
    this.busyId.set(address.id);
    this.api.updateAddress(address.id, { isDefault: true }).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.show('已设为默认地址');
        this.load();
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  askDelete(address: Address): void {
    this.deleteError.set(null);
    this.deleteTarget.set(address);
  }

  closeDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.deleteTarget.set(null);
    this.deleteError.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    this.deleting.set(true);
    this.deleteError.set(null);
    this.api.deleteAddress(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        const remaining = this.addresses().filter((item) => item.id !== target.id);
        const fallback = remaining.find((item) => !item.isDefault) ?? null;
        if (target.isDefault && fallback) {
          // Keep exactly one default address after deleting the current one.
          this.api.updateAddress(fallback.id, { isDefault: true }).subscribe({
            next: () => {
              this.toast.show('地址已删除，已自动将「' + fallback.name + '」设为默认');
              this.load();
            },
            error: () => this.load(),
          });
          return;
        }
        this.toast.show('地址已删除');
        this.load();
      },
      error: (err) => {
        this.deleting.set(false);
        this.deleteError.set(errorMessage(err));
      },
    });
  }
}