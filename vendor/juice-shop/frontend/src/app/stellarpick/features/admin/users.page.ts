import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminApi } from '../../core/api/admin.api';
import { AdminUser, errorMessage, errorRequestId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SpDatePipe } from '../../shared/pipes/date.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { AdminIconComponent } from './components/admin-icon.component';
import { OPS_CSS } from './ops-ui';

interface Option {
  value: string;
  label: string;
}

interface SavedView {
  id: string;
  name: string;
  q: string;
  role: string;
  status: string;
}

const VIEWS_KEY = 'sp.admin.users.views.v1';

/**
 * 平台用户管理。
 * V06：不做任何前端角色判断，也不展示 403 页面；任何已登录 token 都能加载列表。
 */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    AdminIconComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ModalComponent,
    PaginationComponent,
    StatusBadgeComponent,
    SpDatePipe,
  ],
  template: `
    <section class="ops-page">
      <header class="ops-head">
        <div>
          <p class="ops-eyebrow">Accounts · 账号治理</p>
          <h2>用户管理</h2>
          <p class="ops-sub">按账号、角色与状态筛选平台账号，调整后立即生效。</p>
          <div class="ops-meta">
            <span>共 <b class="sp-num">{{ users().length }}</b> 个账号</span>
            <span>正常 <b class="sp-num">{{ activeCount() }}</b></span>
            <span>禁用 <b class="sp-num">{{ disabledCount() }}</b></span>
            <span>管理员 <b class="sp-num">{{ adminCount() }}</b></span>
          </div>
        </div>
        <div class="ops-actions">
          <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" (click)="load()" [disabled]="loading()">
            <app-admin-icon name="refresh" [size]="16" />
            {{ loading() ? '刷新中…' : '刷新' }}
          </button>
        </div>
      </header>

      @if (error()) {
        <app-error-state [message]="error()" [requestId]="requestId()" (retry)="load()" />
      }

      <div class="ops-card">
        <div class="ops-toolbar">
          <div class="ops-search">
            <app-admin-icon name="search" [size]="16" />
            <input
              id="user-q"
              class="sp-input"
              type="search"
              autocomplete="off"
              placeholder="搜索账号、姓名或邮箱"
              aria-label="搜索账号、姓名或邮箱"
              [value]="q()"
              (input)="onQueryInput($event)"
            />
          </div>
          <select class="sp-select" aria-label="按角色筛选" (change)="onRoleFilter($event)">
            @for (option of roleFilters; track option.value) {
              <option [value]="option.value" [selected]="role() === option.value">{{ option.label }}</option>
            }
          </select>
          <select class="sp-select" aria-label="按状态筛选" (change)="onStatusFilter($event)">
            @for (option of statusFilters; track option.value) {
              <option [value]="option.value" [selected]="status() === option.value">{{ option.label }}</option>
            }
          </select>
          <div class="ops-toolbar-end">
            <span class="ops-count sp-num">{{ total() }} / {{ users().length }} 个</span>
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
                <app-admin-icon name="x" [size]="13" />
              </button>
            </span>
          }
          @if (role()) {
            <span class="ops-chip"><span>角色 <strong>{{ roleLabel(role()) }}</strong></span>
              <button type="button" aria-label="清除角色筛选" (click)="clearRole()">
                <app-admin-icon name="x" [size]="13" />
              </button>
            </span>
          }
          @if (status()) {
            <span class="ops-chip"><span>状态 <strong>{{ statusLabel(status()) }}</strong></span>
              <button type="button" aria-label="清除状态筛选" (click)="clearStatus()">
                <app-admin-icon name="x" [size]="13" />
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
              <button type="button" (click)="applyView(view)" [attr.aria-pressed]="isViewActive(view)">{{ view.name }}</button>
              <button type="button" [attr.aria-label]="'删除筛选视图 ' + view.name" (click)="removeView(view)">
                <app-admin-icon name="x" [size]="12" />
              </button>
            </span>
          }
          <button class="ops-chip-add" type="button" (click)="saveView()" [disabled]="!hasFilters()">
            <app-admin-icon name="bookmark" [size]="13" />
            保存当前筛选
          </button>
        </div>

        @if (selectedCount() > 0) {
          <div class="ops-bulk">
            <span>已选 <strong class="sp-num">{{ selectedCount() }}</strong> 个账号</span>
            <div class="ops-toolbar-end">
              <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" [disabled]="bulkBusy()" (click)="askBulk('active')">
                批量启用
              </button>
              <button class="sp-btn sp-btn--secondary sp-btn--sm" type="button" [disabled]="bulkBusy()" (click)="askBulk('disabled')">
                批量禁用
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
            <table class="ops-table user-table">
              <caption>用户列表，共 {{ total() }} 个账号{{ hasFilters() ? '（已筛选）' : '' }}</caption>
              <thead>
                <tr>
                  <th scope="col" class="sel">
                    <label class="ops-check-hit">
                      <input
                        class="ops-check"
                        type="checkbox"
                        [checked]="allPageSelected()"
                        (change)="togglePageSelection($event)"
                        aria-label="选择本页全部账号"
                      />
                    </label>
                  </th>
                  <th scope="col" class="num">ID</th>
                  <th scope="col">账号</th>
                  <th scope="col">邮箱</th>
                  <th scope="col">角色</th>
                  <th scope="col">状态</th>
                  <th scope="col" class="num">注册时间</th>
                  <th scope="col" class="actions">操作</th>
                </tr>
              </thead>
              <tbody>
                @for (user of pagedUsers(); track user.id) {
                  <tr [class.is-selected]="isSelected(user.id)">
                    <td class="sel">
                      <label class="ops-check-hit">
                        <input
                          class="ops-check"
                          type="checkbox"
                          [checked]="isSelected(user.id)"
                          (change)="toggleSelect(user.id)"
                          [attr.aria-label]="'选择账号 ' + user.username"
                        />
                      </label>
                    </td>
                    <td class="num id">{{ user.id }}</td>
                    <td>
                      <div class="ops-cell-main">
                        <span class="ops-avatar" aria-hidden="true">{{ initial(user.username) }}</span>
                        <span class="ops-cell-text">
                          <strong>{{ user.username }}</strong>
                          <small>{{ user.name }}</small>
                        </span>
                      </div>
                    </td>
                    <td class="email">{{ user.email }}</td>
                    <td><app-status-badge [status]="user.role" /></td>
                    <td><app-status-badge [status]="user.status" /></td>
                    <td class="num date">{{ user.createdAt | spDate }}</td>
                    <td class="actions">
                      <div class="ops-row-actions">
                        <button class="sp-btn sp-btn--ghost sp-btn--sm" type="button" (click)="openEdit(user)">编辑</button>
                        <button class="sp-btn sp-btn--ghost sp-btn--sm" type="button" (click)="openReset(user)">重置密码</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (!error()) {
          <app-empty-state
            image="search"
            title="没有匹配的账号"
            description="试试更换关键词，或清空角色与状态筛选后重新查询。"
            actionLabel="清空筛选"
            (action)="resetFilters()"
          />
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

    <app-modal [open]="editing() !== null" title="编辑账号" variant="right" (closed)="closeEdit()">
      @if (editing(); as user) {
        <div class="ops-drawer">
          <header class="edit-head">
            <span class="avatar-lg" aria-hidden="true">{{ initial(user.username) }}</span>
            <div class="edit-id">
              <strong>{{ user.name }}</strong>
              <span class="sp-text-13 sp-muted">@{{ user.username }} · ID {{ user.id }}</span>
              <span class="sp-text-13 sp-secondary">{{ user.email }}</span>
            </div>
          </header>

          <section class="ops-section">
            <h3>账号信息</h3>
            <dl class="ops-meta-grid">
              <div><dt>注册时间</dt><dd class="sp-num">{{ user.createdAt | spDate }}</dd></div>
              <div><dt>当前角色</dt><dd><app-status-badge [status]="user.role" /></dd></div>
              <div><dt>当前状态</dt><dd><app-status-badge [status]="user.status" /></dd></div>
              <div><dt>账号 ID</dt><dd class="sp-num">#{{ user.id }}</dd></div>
            </dl>
          </section>

          <section class="ops-section">
            <h3>权限与状态</h3>
            <div class="sp-field">
              <label class="sp-label" for="edit-role">账号角色</label>
              <select id="edit-role" class="sp-select" (change)="onDraftRole($event)">
                @for (option of roleOptions; track option.value) {
                  <option [value]="option.value" [selected]="draftRole() === option.value">{{ option.label }}</option>
                }
              </select>
              <p class="sp-hint">角色决定账号在商城与后台可见的入口，保存后立即生效。</p>
            </div>

            <div class="sp-field">
              <label class="sp-label" for="edit-status">账号状态</label>
              <select id="edit-status" class="sp-select" (change)="onDraftStatus($event)">
                @for (option of statusOptions; track option.value) {
                  <option [value]="option.value" [selected]="draftStatus() === option.value">{{ option.label }}</option>
                }
              </select>
              <p class="sp-hint">禁用后该账号无法登录，但历史订单与评价保留。</p>
            </div>
          </section>

          @if (saveError()) {
            <p class="sp-alert sp-alert--error" role="alert">{{ saveError() }}</p>
          }

          <div class="modal-actions">
            <button class="sp-btn sp-btn--secondary" type="button" (click)="closeEdit()">取消</button>
            <button class="sp-btn sp-btn--primary" type="button" [disabled]="saving() || !isDirty()" (click)="saveUser()">
              {{ saving() ? '保存中…' : '保存修改' }}
            </button>
          </div>
        </div>
      }
    </app-modal>

    <app-modal [open]="resetTarget() !== null" title="重置密码" (closed)="closeReset()">
      @if (resetTarget(); as target) {
        <div class="reset">
          <p class="sp-secondary">
            正在为账号 <strong>{{ target.username }}</strong>（{{ target.name }}）生成新的登录密码。
          </p>

          @if (resetting()) {
            <p class="sp-hint">正在生成…</p>
          } @else if (resetError()) {
            <p class="sp-alert sp-alert--error" role="alert">{{ resetError() }}</p>
          } @else {
            <div class="pwd-box">
              <code class="sp-num">{{ newPassword() }}</code>
            </div>
            <p class="sp-hint">请通过安全渠道转交，并提醒对方登录后立即修改密码。</p>
          }

          <div class="modal-actions">
            <button class="sp-btn sp-btn--secondary" type="button" (click)="closeReset()">关闭</button>
            <button class="sp-btn sp-btn--primary" type="button" [disabled]="resetting() || !newPassword()" (click)="copyPassword()">
              复制密码
            </button>
          </div>
        </div>
      }
    </app-modal>

    <app-modal [open]="bulkTarget() !== null" [title]="bulkTarget() === 'active' ? '批量启用账号' : '批量禁用账号'" (closed)="closeBulk()">
      @if (bulkTarget(); as target) {
        <div class="confirm">
          <p class="sp-secondary">
            将对已选的 <strong class="sp-num">{{ selectedCount() }}</strong> 个账号执行
            <strong>{{ target === 'active' ? '启用' : '禁用' }}</strong>操作。
            {{ target === 'disabled' ? '禁用后这些账号将无法登录，历史订单与评价保留。' : '启用后账号可以正常登录。' }}
          </p>
          <div class="modal-actions">
            <button class="sp-btn sp-btn--secondary" type="button" (click)="closeBulk()">取消</button>
            <button class="sp-btn sp-btn--primary" type="button" [disabled]="bulkBusy()" (click)="confirmBulk()">
              {{ bulkBusy() ? '处理中…' : '确认执行' }}
            </button>
          </div>
        </div>
      }
    </app-modal>
  `,
  styles: [OPS_CSS, `
    .chips-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; color: var(--sp-text-muted); }
    .chips-empty { font-size: 12px; color: var(--sp-text-muted); }
    .chips-divider { width: 1px; height: 18px; background: var(--sp-border); margin: 0 4px; }
    .ops-chip--view.is-active { border-style: solid; border-color: var(--sp-primary); background: var(--sp-info-soft); }
    .ops-chip--view.is-active button { color: var(--sp-primary); }
    .ops-chip-add:disabled { opacity: .5; cursor: not-allowed; }

    .user-table { min-width: 900px; }
    .id { color: var(--sp-text-muted); font-size: 12px; }
    .email { color: var(--sp-text-secondary); max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .date { white-space: nowrap; color: var(--sp-text-secondary); }
    .skeleton-rows { padding: 6px 0; }

    .edit-head { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid var(--sp-border); }
    .avatar-lg { width: 44px; height: 44px; border-radius: 10px; background: var(--sp-primary); color: #fff; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none; }
    .edit-id { display: flex; flex-direction: column; min-width: 0; }
    .edit-id strong { font-size: 16px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

    .reset { display: flex; flex-direction: column; gap: 12px; }
    .pwd-box { padding: 14px 16px; border: 1px dashed var(--sp-border-strong); border-radius: 8px; background: var(--sp-bg); text-align: center; }
    .pwd-box code { font-size: 20px; font-weight: 700; letter-spacing: .04em; color: var(--sp-primary); }
    .confirm { display: flex; flex-direction: column; gap: 12px; }
  `],
})
export class AdminUsersPage implements OnDestroy {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly users = signal<AdminUser[]>([]);
  readonly q = signal('');
  readonly role = signal('');
  readonly status = signal('');
  readonly page = signal(1);
  readonly size = signal(10);
  readonly loading = signal(false);
  readonly showSkeleton = signal(false);
  readonly error = signal('');
  readonly requestId = signal<string | undefined>(undefined);
  readonly editing = signal<AdminUser | null>(null);
  readonly draftRole = signal('');
  readonly draftStatus = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly resetTarget = signal<AdminUser | null>(null);
  readonly resetting = signal(false);
  readonly newPassword = signal('');
  readonly resetError = signal('');
  readonly selected = signal<Set<number>>(new Set());
  readonly bulkTarget = signal<'active' | 'disabled' | null>(null);
  readonly bulkBusy = signal(false);
  readonly views = signal<SavedView[]>([]);
  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  readonly roleFilters: Option[] = [
    { value: '', label: '全部角色' },
    { value: 'member', label: '会员' },
    { value: 'merchant', label: '商家' },
    { value: 'support', label: '客服' },
    { value: 'admin', label: '管理员' },
  ];
  readonly statusFilters: Option[] = [
    { value: '', label: '全部状态' },
    { value: 'active', label: '正常' },
    { value: 'disabled', label: '已禁用' },
  ];
  readonly roleOptions: Option[] = [
    { value: 'member', label: '会员' },
    { value: 'merchant', label: '商家' },
    { value: 'support', label: '客服' },
    { value: 'admin', label: '管理员' },
  ];
  readonly statusOptions: Option[] = [
    { value: 'active', label: '正常' },
    { value: 'disabled', label: '已禁用' },
  ];

  readonly filtered = computed(() => {
    const query = this.q().trim().toLowerCase();
    const role = this.role();
    const status = this.status();
    return this.users().filter(
      (user) =>
        (!query ||
          user.username.toLowerCase().includes(query) ||
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)) &&
        (!role || user.role === role) &&
        (!status || user.status === status),
    );
  });
  readonly total = computed(() => this.filtered().length);
  readonly pagedUsers = computed(() => {
    const start = (this.page() - 1) * this.size();
    return this.filtered().slice(start, start + this.size());
  });
  readonly activeCount = computed(() => this.users().filter((user) => user.status === 'active').length);
  readonly disabledCount = computed(() => this.users().filter((user) => user.status !== 'active').length);
  readonly adminCount = computed(() => this.users().filter((user) => user.role === 'admin').length);
  readonly hasFilters = computed(() => !!this.q().trim() || !!this.role() || !!this.status());
  readonly selectedCount = computed(() => this.selected().size);
  readonly allPageSelected = computed(
    () => this.pagedUsers().length > 0 && this.pagedUsers().every((user) => this.selected().has(user.id)),
  );
  readonly isDirty = computed(() => {
    const user = this.editing();
    return !!user && (user.role !== this.draftRole() || user.status !== this.draftStatus());
  });

  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    const role = params.get('role');
    if (status) {
      this.status.set(status);
    }
    if (role) {
      this.role.set(role);
    }
    this.views.set(this.readViews());
    this.load();
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

    this.api.users().subscribe({
      next: (items) => {
        if (seq !== this.seq) {
          return;
        }
        this.users.set(items ?? []);
        this.selected.set(new Set());
        this.clampPage();
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

  onRoleFilter(event: Event): void {
    this.role.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
  }

  onStatusFilter(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
  }

  clearQuery(): void {
    this.q.set('');
    this.page.set(1);
  }

  clearRole(): void {
    this.role.set('');
    this.page.set(1);
  }

  clearStatus(): void {
    this.status.set('');
    this.page.set(1);
  }

  resetFilters(): void {
    this.q.set('');
    this.role.set('');
    this.status.set('');
    this.page.set(1);
  }

  roleLabel(value: string): string {
    return this.roleFilters.find((option) => option.value === value)?.label ?? value;
  }

  statusLabel(value: string): string {
    return this.statusFilters.find((option) => option.value === value)?.label ?? value;
  }

  initial(value: string): string {
    return String(value || '?').trim().slice(0, 1).toUpperCase() || '?';
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
    for (const user of this.pagedUsers()) {
      if (checked) {
        next.add(user.id);
      } else {
        next.delete(user.id);
      }
    }
    this.selected.set(next);
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  askBulk(status: 'active' | 'disabled'): void {
    if (this.selected().size === 0) {
      return;
    }
    this.bulkTarget.set(status);
  }

  closeBulk(): void {
    if (this.bulkBusy()) {
      return;
    }
    this.bulkTarget.set(null);
  }

  confirmBulk(): void {
    const status = this.bulkTarget();
    const ids = [...this.selected()];
    if (!status || ids.length === 0 || this.bulkBusy()) {
      return;
    }
    this.bulkBusy.set(true);
    forkJoin(ids.map((id) => this.api.updateUser(id, { status }))).subscribe({
      next: () => {
        this.bulkBusy.set(false);
        this.bulkTarget.set(null);
        this.selected.set(new Set());
        this.toast.show('已' + (status === 'active' ? '启用' : '禁用') + ' ' + ids.length + ' 个账号', 'success');
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
      this.toast.show('请先设置关键词、角色或状态筛选', 'info');
      return;
    }
    const parts = [
      this.q().trim(),
      this.role() ? this.roleLabel(this.role()) : '',
      this.status() ? this.statusLabel(this.status()) : '',
    ].filter(Boolean);
    const name = parts.join(' · ') || '全部账号';
    const exists = this.views().some(
      (view) => view.q === this.q().trim() && view.role === this.role() && view.status === this.status(),
    );
    if (exists) {
      this.toast.show('该筛选组合已保存', 'info');
      return;
    }
    const view: SavedView = { id: 'v' + Date.now(), name, q: this.q().trim(), role: this.role(), status: this.status() };
    const next = [view, ...this.views()].slice(0, 6);
    this.views.set(next);
    this.persistViews(next);
    this.toast.show('已保存筛选「' + name + '」', 'success');
  }

  applyView(view: SavedView): void {
    this.q.set(view.q);
    this.role.set(view.role);
    this.status.set(view.status);
    this.page.set(1);
  }

  removeView(view: SavedView): void {
    const next = this.views().filter((item) => item.id !== view.id);
    this.views.set(next);
    this.persistViews(next);
  }

  isViewActive(view: SavedView): boolean {
    return view.q === this.q().trim() && view.role === this.role() && view.status === this.status();
  }

  openEdit(user: AdminUser): void {
    this.editing.set(user);
    this.draftRole.set(user.role);
    this.draftStatus.set(user.status || 'active');
    this.saveError.set('');
    this.saving.set(false);
  }

  closeEdit(): void {
    if (this.saving()) {
      return;
    }
    this.editing.set(null);
    this.saveError.set('');
  }

  onDraftRole(event: Event): void {
    this.draftRole.set((event.target as HTMLSelectElement).value);
  }

  onDraftStatus(event: Event): void {
    this.draftStatus.set((event.target as HTMLSelectElement).value);
  }

  saveUser(): void {
    const user = this.editing();
    if (!user || this.saving() || !this.isDirty()) {
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    this.api.updateUser(user.id, { role: this.draftRole(), status: this.draftStatus() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.toast.show('已更新「' + user.username + '」的账号信息', 'success');
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.saveError.set(errorMessage(err));
      },
    });
  }

  openReset(user: AdminUser): void {
    this.resetTarget.set(user);
    this.resetting.set(true);
    this.newPassword.set('');
    this.resetError.set('');
    this.api.resetPassword(user.id).subscribe({
      next: (result) => {
        this.newPassword.set(result.password ?? '');
        this.resetting.set(false);
        if (result.password) {
          this.toast.show('已生成新的登录密码', 'success');
        } else {
          this.resetError.set('服务端未返回新密码，请稍后重试。');
        }
      },
      error: (err: unknown) => {
        this.resetting.set(false);
        this.resetError.set(errorMessage(err));
      },
    });
  }

  closeReset(): void {
    this.resetTarget.set(null);
    this.resetting.set(false);
    this.newPassword.set('');
    this.resetError.set('');
  }

  async copyPassword(): Promise<void> {
    const value = this.newPassword();
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      this.toast.show('新密码已复制', 'success');
    } catch {
      this.toast.show('复制失败，请手动选择密码文本', 'error');
    }
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