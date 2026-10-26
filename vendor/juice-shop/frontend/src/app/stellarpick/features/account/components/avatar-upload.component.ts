import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { errorMessage } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { DEFAULT_AVATAR } from './account-avatar';

@Component({
  selector: 'app-avatar-upload',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="uploader">
      <img class="avatar" [src]="display()" [alt]="name() + '的头像'" width="96" height="96" />
      <div class="controls">
        <div class="buttons">
          <button
            class="sp-btn sp-btn--secondary sp-btn--sm"
            type="button"
            [disabled]="uploading()"
            (click)="picker.click()"
          >
            <app-icon name="upload" [size]="16" />
            {{ uploading() ? '上传中…' : '更换头像' }}
          </button>
          <a class="view-original" [href]="display()" target="_blank" rel="noopener">
            <app-icon name="image" [size]="16" /> 查看原图
          </a>
        </div>
        <p class="sp-hint">支持 JPG / PNG / WebP / SVG，建议 400×400 以上。</p>

        <input
          #picker
          class="sp-sr-only"
          type="file"
          accept="image/*,.svg"
          tabindex="-1"
          aria-label="选择头像文件"
          (change)="onFile($event)"
        />

        @if (progress() !== null) {
          <div
            class="progress"
            role="progressbar"
            aria-label="头像上传进度"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-valuenow]="progress() ?? 0"
          >
            <span [style.width.%]="progress() ?? 0"></span>
          </div>
          <p class="sp-hint" aria-live="polite">
            {{ uploading() ? '正在上传 ' + (progress() ?? 0) + '%' : '上传完成' }}
          </p>
        }

        @if (error()) {
          <p class="sp-error" role="alert">{{ error() }}</p>
          @if (lastFile()) {
            <button class="sp-btn sp-btn--ghost sp-btn--sm retry" type="button" (click)="retry()">
              <app-icon name="refresh" [size]="16" /> 重试上传
            </button>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .uploader { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
      .avatar {
        width: 96px;
        height: 96px;
        border-radius: 50%;
        object-fit: cover;
        background: var(--sp-bg);
        border: 1px solid var(--sp-border);
        flex: 0 0 auto;
      }
      .controls { display: flex; flex-direction: column; gap: 6px; min-width: 0; width: 100%; }
      .buttons { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .sp-hint { max-width: 320px; }
      .view-original {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--sp-text-13);
        color: var(--sp-info);
        font-weight: 600;
        min-height: 32px;
      }
      .view-original:hover { text-decoration: underline; }
      .progress {
        width: 100%;
        max-width: 280px;
        height: 6px;
        border-radius: var(--sp-radius-pill);
        background: var(--sp-border);
        overflow: hidden;
        margin-top: 6px;
      }
      .progress span {
        display: block;
        height: 100%;
        background: var(--sp-accent);
        transition: width .15s ease;
      }
      .retry { align-self: flex-start; }
      @media (max-width: 480px) {
        .uploader { gap: 10px; }
        .avatar { width: 80px; height: 80px; }
        .buttons { gap: 8px; }
      }
    `,
  ],
})
export class AvatarUploadComponent {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);

  readonly avatar = input<string | null>(null);
  readonly name = input('会员');
  readonly uploaded = output<string>();

  readonly preview = signal<string | null>(null);
  readonly progress = signal<number | null>(null);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastFile = signal<File | null>(null);

  readonly display = computed(() => this.preview() || this.avatar() || DEFAULT_AVATAR);

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    input.value = '';
    if (!file) {
      return;
    }
    // V10: no MIME / extension whitelist on the client — the file is sent as-is.
    this.lastFile.set(file);
    this.error.set(null);
    this.preview.set(URL.createObjectURL(file));
    this.upload(file);
  }

  retry(): void {
    const file = this.lastFile();
    if (file) {
      this.upload(file);
    }
  }

  private upload(file: File): void {
    this.uploading.set(true);
    this.progress.set(0);
    this.error.set(null);

    const form = new FormData();
    form.append('file', file);

    // Direct HttpClient request (instead of AccountApi.uploadAvatar) so we can
    // surface real upload progress events. The auth interceptor still applies.
    const request = new HttpRequest('POST', '/api/account/avatar', form, { reportProgress: true });

    this.http.request<{ url: string }>(request).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total ?? file.size;
          this.progress.set(total > 0 ? Math.round((event.loaded / total) * 100) : 0);
        } else if (event.type === HttpEventType.Response) {
          const url = event.body ? event.body.url : '';
          if (!url) {
            this.uploading.set(false);
            this.error.set('上传失败，请稍后重试。');
            return;
          }
          this.preview.set(url);
          this.progress.set(100);
          this.uploading.set(false);
          // The server persists profileImage and re-issues the JWT so the
          // header avatar survives a reload.
          const token = event.headers.get('X-StellarPick-Token');
          if (token) {
            this.auth.applyToken(token);
          }
          this.uploaded.emit(url);
          this.toast.show('头像已更新');
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.progress.set(null);
        this.error.set(errorMessage(err));
      },
    });
  }
}