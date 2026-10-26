import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SectionNavComponent, SectionNavItem } from './components/section-nav.component';

interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [RouterLink, IconComponent, SectionNavComponent],
  template: `
    <section class="hero sp-on-dark" aria-labelledby="about-title">
      <div class="sp-container">
        <div class="brand">
          <img src="/assets/sp/brand/logo-light.svg" alt="" width="40" height="40" />
          <span class="wordmark"><strong>星澜优选</strong><small>STELLARPICK</small></span>
        </div>
        <h1 id="about-title">把日常，选得更好</h1>
        <p class="lede">
          星澜优选是一个面向城市家庭的会员制生活好物平台。我们用更少的 SKU、更长的实测周期，
          把每天都要用的东西挑到刚刚好。
        </p>
        <div class="hero-actions">
          <a class="sp-btn sp-btn--accent sp-btn--lg" routerLink="/register">注册成为会员</a>
          <button class="sp-btn sp-btn--ghost sp-btn--lg" type="button" (click)="scrollTo('story')">
            了解品牌故事
          </button>
        </div>
      </div>
    </section>

    <div class="sp-container layout">
      <aside class="side">
        <app-section-nav [items]="navItems" title="本页导航" ariaLabel="关于页导航" />
      </aside>

      <div class="content">
        <section id="story" class="block" aria-labelledby="story-title">
          <p class="sp-eyebrow">品牌故事</p>
          <h2 id="story-title">从一只杯子开始，重新理解「日常」</h2>
          <div class="story-grid">
            <img src="/assets/sp/img/story.svg" alt="星澜优选选品团队在工作室记录样品的使用情况"
                 width="800" height="600" loading="lazy" />
            <div class="story-text">
              <h3>精选</h3>
              <p>
                我们不做「大而全」。每个品类只保留少量经过 30 天以上实测的商品，选品团队会记录使用场景、
                耐用度与清洗维护成本，再决定是否上架。
              </p>
              <h3>可溯源</h3>
              <p>
                每件商品都能在详情页看到规格、材质与产地信息，重要批次可以追溯到供应方。
                我们更愿意把信息写清楚，而不是用形容词堆砌卖点。
              </p>
              <h3>不过度包装</h3>
              <p>
                外包装使用单一材质与可回收纸浆缓冲，尽量取消塑料内衬和多余印刷。
                我们希望拆箱的体验是干净利落，而不是制造一箱垃圾。
              </p>
            </div>
          </div>
        </section>

        <section id="member" class="block" aria-labelledby="member-title">
          <p class="sp-eyebrow">会员权益</p>
          <h2 id="member-title">会员，是把选择交给专业的人</h2>
          <p class="block-lede">
            星澜会员不是一张打折卡。我们用它把选品、配送与售后串起来，让每一次复购都更省心。
          </p>
          <ul class="benefits">
            @for (item of benefits; track item.title) {
              <li class="sp-card sp-card--pad">
                <span class="ico"><app-icon [name]="item.icon" [size]="22" /></span>
                <h3>{{ item.title }}</h3>
                <p>{{ item.desc }}</p>
              </li>
            }
          </ul>

          <div class="member-day sp-card sp-card--pad">
            <div class="rules">
              <h3>会员日规则</h3>
              <ul>
                <li>每周三 00:00–23:59 为星澜会员日。</li>
                <li>会员日当天全场满 300 减 40，可与「新人 20 元」券叠加使用一次。</li>
                <li>会员日消费积分双倍累计，积分可在结算时抵扣现金。</li>
                <li>演示环境不产生真实交易，优惠、积分与订单仅用于流程演示。</li>
              </ul>
            </div>
            <div class="member-cta">
              <p class="cta-title">还没有账号？</p>
              <a class="sp-btn sp-btn--primary sp-btn--block" routerLink="/register">注册会员</a>
              <a class="sp-btn sp-btn--ghost sp-btn--block" routerLink="/login">已有账号，去登录</a>
            </div>
          </div>
        </section>

        <section id="service" class="block" aria-labelledby="service-title">
          <p class="sp-eyebrow">服务保障</p>
          <h2 id="service-title">买得放心，退得省心</h2>
          <ul class="services">
            @for (item of services; track item.title) {
              <li class="sp-card sp-card--pad">
                <span class="ico"><app-icon [name]="item.icon" [size]="22" /></span>
                <h3>{{ item.title }}</h3>
                <p>{{ item.desc }}</p>
              </li>
            }
          </ul>
          <p class="service-note">
            需要人工协助？<a class="sp-link" routerLink="/support/tickets">提交客服工单</a>，
            或查看<a class="sp-link" routerLink="/help">帮助中心</a>里的常见问题。
          </p>
        </section>

        <section id="contact" class="block" aria-labelledby="contact-title">
          <p class="sp-eyebrow">联系我们</p>
          <h2 id="contact-title">随时找得到人</h2>
          <div class="contact-grid">
            <div class="sp-card sp-card--pad">
              <dl class="contact-list">
                <div>
                  <dt><app-icon name="phone" [size]="16" />客服热线</dt>
                  <dd><a href="tel:4000000000">400-000-0000</a></dd>
                </div>
                <div>
                  <dt><app-icon name="mail" [size]="16" />客服邮箱</dt>
                  <dd><a href="mailto:service@stellarpick.example">service@stellarpick.example</a></dd>
                </div>
                <div>
                  <dt><app-icon name="map-pin" [size]="16" />办公地址</dt>
                  <dd>上海市星澜区示例路 88 号 3 栋 12 层</dd>
                </div>
                <div>
                  <dt><app-icon name="clock" [size]="16" />工作时间</dt>
                  <dd>每日 9:00–21:00（法定节假日以公告为准）</dd>
                </div>
              </dl>
            </div>
            <div class="sp-card sp-card--pad contact-side">
              <h3>更快的方式</h3>
              <p>在线工单会记录完整对话，客服在工作时间内按顺序处理，通常 24 小时内回复。</p>
              <a class="sp-btn sp-btn--secondary sp-btn--block" routerLink="/support/tickets">提交工单</a>
              <a class="sp-btn sp-btn--ghost sp-btn--block" routerLink="/help">先看看常见问题</a>
            </div>
          </div>
          <p class="note">以上电话、邮箱与地址均为演示数据，请勿真实拨打、发送邮件或寄送物品。</p>
        </section>

        <section id="credential" class="credential" aria-labelledby="credential-title">
          <h2 id="credential-title">资质与备案</h2>
          <p class="demo-line">
            <strong>星澜优选 Demo</strong>
            <span class="sp-badge sp-badge--accent">演示环境</span>
          </p>
          <dl class="credential-list">
            <div><dt>演示备案号</dt><dd class="sp-num">XLP-DEMO-2026</dd></div>
            <div><dt>运营主体</dt><dd>星澜优选（演示）</dd></div>
            <div><dt>服务性质</dt><dd>安全培训靶场 · 非真实商业服务</dd></div>
          </dl>
          <p class="sp-alert sp-alert--info">
            本站为演示环境，全部品牌、商品、价格、评价、联系方式与备案信息均为虚构，
            不构成任何真实商业承诺；请勿在站内填写真实的个人信息、支付信息或上传真实证件。
          </p>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .hero { position: relative; overflow: hidden; background: var(--sp-primary); color: #fff; padding: 56px 0 56px; }
    .hero::after {
      content: ''; position: absolute; right: -140px; top: -160px; width: 440px; height: 440px;
      border-radius: 50%; background: var(--sp-accent); opacity: .1; pointer-events: none;
    }
    .hero .sp-container { position: relative; z-index: 1; }
    .brand { display: inline-flex; align-items: center; gap: 12px; }
    .brand img { border-radius: 10px; }
    .wordmark { display: flex; flex-direction: column; line-height: 1.1; }
    .wordmark strong { font-size: 18px; letter-spacing: .02em; }
    .wordmark small { font-size: 9px; letter-spacing: .28em; color: rgba(255, 255, 255, .6); margin-top: 4px; }
    .hero h1 { color: #fff; font-size: 40px; margin: 24px 0 12px; letter-spacing: .01em; }
    .lede { max-width: 560px; font-size: 16px; line-height: 1.8; color: rgba(255, 255, 255, .78); }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
    .hero .sp-btn--ghost { color: #fff; border-color: rgba(255, 255, 255, .4); }
    .hero .sp-btn--ghost:hover { background: rgba(255, 255, 255, .12); color: #fff; }

    .layout {
      display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 48px;
      align-items: start; padding-block: 40px 64px;
    }
    .side { position: sticky; top: calc(var(--sp-header-h) + 12px); }
    .block { max-width: 760px; padding-bottom: 40px; margin-bottom: 40px; border-bottom: 1px solid var(--sp-border); }
    .block h2 { font-size: 26px; margin: 6px 0 16px; }
    .block-lede { color: var(--sp-text-secondary); font-size: 15px; line-height: 1.8; margin-bottom: 20px; max-width: 720px; }

    .story-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: start; }
    .story-grid img {
      width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--sp-border);
      background: var(--sp-bg);
    }
    .story-text h3 { font-size: 16px; margin: 0 0 6px; }
    .story-text p { font-size: 15px; line-height: 1.8; color: var(--sp-text-secondary); margin-bottom: 18px; }
    .story-text h3:first-child { margin-top: 0; }

    .benefits, .services { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
    .benefits li, .services li { display: flex; flex-direction: column; }
    .ico {
      width: 40px; height: 40px; border-radius: 10px; margin-bottom: 12px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--sp-info-soft); color: var(--sp-primary);
    }
    .benefits h3, .services h3 { font-size: 15px; margin-bottom: 6px; }
    .benefits p, .services p { font-size: 13px; line-height: 1.7; color: var(--sp-text-secondary); }

    .member-day {
      display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 24px;
      margin-top: 20px; border-top: 3px solid var(--sp-accent);
    }
    .rules h3 { font-size: 16px; margin-bottom: 10px; }
    .rules ul { display: flex; flex-direction: column; gap: 6px; }
    .rules li {
      position: relative; padding-left: 16px; font-size: 14px; line-height: 1.7; color: var(--sp-text-secondary);
    }
    .rules li::before {
      content: ''; position: absolute; left: 2px; top: 10px; width: 5px; height: 5px;
      border-radius: 50%; background: var(--sp-accent);
    }
    .member-cta {
      display: flex; flex-direction: column; gap: 10px; padding-left: 24px;
      border-left: 1px solid var(--sp-border);
    }
    .cta-title { font-size: 14px; font-weight: 600; color: var(--sp-text); margin-bottom: 2px; }
    .service-note { margin-top: 16px; font-size: 14px; color: var(--sp-text-secondary); }

    .contact-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 16px; }
    .contact-list { display: flex; flex-direction: column; gap: 14px; margin: 0; }
    .contact-list > div { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 12px; align-items: baseline; }
    .contact-list dt {
      display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--sp-text-secondary);
    }
    .contact-list dd { margin: 0; font-size: 14px; color: var(--sp-text); word-break: break-all; }
    .contact-list a { color: var(--sp-accent-text); font-weight: 600; }
    .contact-list a:hover { text-decoration: underline; }
    .contact-side { display: flex; flex-direction: column; gap: 10px; background: var(--sp-bg); }
    .contact-side h3 { font-size: 15px; }
    .contact-side p { font-size: 13px; line-height: 1.7; color: var(--sp-text-secondary); margin-bottom: 4px; }
    .note { margin-top: 12px; font-size: 12px; color: var(--sp-text-muted); }

    .credential {
      max-width: 760px; background: var(--sp-surface); border: 1px dashed var(--sp-border-strong);
      border-radius: 12px; padding: 24px;
    }
    .credential h2 { font-size: 20px; margin-bottom: 12px; }
    .demo-line { display: flex; align-items: center; gap: 10px; font-size: 15px; margin-bottom: 16px; }
    .credential-list { display: flex; flex-wrap: wrap; gap: 12px 40px; margin: 0 0 16px; }
    .credential-list > div { display: flex; flex-direction: column; gap: 2px; }
    .credential-list dt { font-size: 12px; color: var(--sp-text-muted); }
    .credential-list dd { margin: 0; font-size: 14px; color: var(--sp-text); font-weight: 600; }
    .credential .sp-alert { margin-top: 0; font-size: 13px; line-height: 1.7; }

    @media (max-width: 1023px) {
      .layout { grid-template-columns: minmax(0, 1fr); gap: 0; padding-block-start: 24px; }
      .side { position: static; margin-bottom: 24px; }
      .benefits, .services { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .member-day { grid-template-columns: minmax(0, 1fr); }
      .member-cta { padding-left: 0; padding-top: 16px; border-left: 0; border-top: 1px solid var(--sp-border); }
      .contact-grid { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 767px) {
      .hero { padding: 40px 0 36px; }
      .hero h1 { font-size: 32px; margin-top: 20px; }
      .hero-actions { flex-direction: column; align-items: stretch; }
      .story-grid { grid-template-columns: minmax(0, 1fr); gap: 20px; }
      .benefits, .services { grid-template-columns: minmax(0, 1fr); }
      .block h2 { font-size: 22px; }
      .contact-list > div { grid-template-columns: minmax(0, 1fr); gap: 2px; }
      .credential { padding: 20px; }
    }
  `],
})
export class AboutPage {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);

  constructor() {
    this.title.setTitle('关于我们 · 星澜优选');
    this.route.fragment.pipe(takeUntilDestroyed()).subscribe((fragment) => {
      if (fragment) {
        setTimeout(() => this.scrollTo(fragment), 0);
      }
    });
  }

  scrollTo(id: string): void {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }

  readonly navItems: SectionNavItem[] = [
    { id: 'story', label: '品牌故事' },
    { id: 'member', label: '会员权益' },
    { id: 'service', label: '服务保障' },
    { id: 'contact', label: '联系我们' },
    { id: 'credential', label: '资质与备案' },
  ];

  readonly benefits: FeatureItem[] = [
    { icon: 'truck', title: '全场包邮', desc: '会员订单全年包邮、不限金额；非会员单笔满 99 元包邮。' },
    { icon: 'percent', title: '会员专享折扣', desc: '每周三会员日，精选商品低至 9 折，可与优惠券叠加。' },
    { icon: 'medal', title: '积分回馈', desc: '消费 1 元累计 1 积分，积分可在结算时按比例抵扣现金。' },
    { icon: 'headset', title: '专属客服', desc: '会员工单优先处理，工作时间内 2 小时内响应。' },
  ];

  readonly services: FeatureItem[] = [
    { icon: 'shield', title: '正品保障', desc: '商品由品牌方或授权经销商直供，支持批次与产地溯源。' },
    { icon: 'refresh', title: '7 天无理由', desc: '签收次日起 7 天内，商品不影响二次销售即可申请退货。' },
    { icon: 'credit-card', title: '极速退款', desc: '退货签收后 48 小时内完成审核，退款原路退回。' },
    { icon: 'headset', title: '在线客服', desc: '每日 9:00–21:00 在线，工单通常在 24 小时内回复。' },
  ];
}

