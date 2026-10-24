import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { SectionNavComponent, SectionNavItem } from './components/section-nav.component';

@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [SectionNavComponent],
  styleUrl: './components/legal-doc.scss',
  template: `
    <div class="sp-container">
      <header class="head">
        <p class="sp-eyebrow">法律与条款</p>
        <h1>服务条款</h1>
        <p class="meta">生效日期：2026-10-01 · 适用主体：星澜优选（演示）</p>
      </header>

      <div class="doc">
        <aside class="side">
          <app-section-nav [items]="sections" title="目录" ariaLabel="服务条款目录" />
        </aside>

        <article class="article">
          <p class="lead">
            欢迎使用星澜优选（演示）。本条款约定你与本站之间的权利义务。
            本站是安全培训靶场，不提供真实交易，页面中的商品、价格与订单均为虚构。
          </p>

          <section id="service" aria-labelledby="service-title">
            <h2 id="service-title">1. 服务说明</h2>
            <p>
              本站是会员制生活好物电商的演示站点，用于展示浏览、搜索、下单、支付、售后、客服与后台管理等流程。
            </p>
            <p>
              页面中的商品、价格、库存、评价、商家与订单均为虚构，不构成任何真实要约或承诺。
              本站可能随时调整功能、内容或停止演示，无需事先通知。
            </p>
          </section>

          <section id="account" aria-labelledby="account-title">
            <h2 id="account-title">2. 账号</h2>
            <ul>
              <li>注册时应提供有效的邮箱与密码，并妥善保管账号信息。</li>
              <li>账号仅限本人使用，不得出借、转让或用于任何非法用途。</li>
              <li>发现账号异常时，应立即修改密码并联系客服。</li>
              <li>演示环境中的账号与数据可能被重置或清空，请勿存放重要内容。</li>
            </ul>
          </section>

          <section id="order" aria-labelledby="order-title">
            <h2 id="order-title">3. 订单与支付</h2>
            <ul>
              <li>下单与支付均为模拟流程，<strong>不产生真实交易</strong>，不会扣款、发货或开票。</li>
              <li>商品价格、优惠券与运费仅用于演示计算，页面展示的金额不作为真实结算依据。</li>
              <li>请勿在结算页填写真实的银行卡号、支付密码或短信验证码。</li>
              <li>演示订单可能被管理员或测试脚本修改状态，属于正常现象。</li>
            </ul>
          </section>

          <section id="delivery" aria-labelledby="delivery-title">
            <h2 id="delivery-title">4. 配送</h2>
            <ul>
              <li>配送范围、时效与运费均为演示规则，不产生真实物流。</li>
              <li>运单号与物流节点为模拟数据，无法在承运商处查询。</li>
              <li>收货地址仅用于演示，请勿填写真实住址或他人信息。</li>
            </ul>
          </section>

          <section id="return" aria-labelledby="return-title">
            <h2 id="return-title">5. 退换</h2>
            <ul>
              <li>7 天无理由、退款时效与换货流程均为演示规则。</li>
              <li>演示环境不产生真实退款，退款状态仅用于展示页面流转。</li>
              <li>具体说明以帮助中心的退换货内容为准。</li>
            </ul>
          </section>

          <section id="ip" aria-labelledby="ip-title">
            <h2 id="ip-title">6. 知识产权</h2>
            <ul>
              <li>本站的页面设计、文案、图形、Logo 与代码均为演示自制素材，仅用于培训与演示。</li>
              <li>未经许可，不得将本站素材用于商业用途，或冒充真实品牌对外宣传。</li>
              <li>站内不包含任何真实企业标识、商品图片或人物肖像。</li>
            </ul>
          </section>

          <section id="disclaimer" aria-labelledby="disclaimer-title">
            <h2 id="disclaimer-title">7. 免责</h2>
            <ul>
              <li>本站按「现状」提供，不保证连续可用、无错误或满足特定用途。</li>
              <li>因使用或无法使用本站造成的任何直接或间接损失，演示方不承担责任。</li>
              <li>禁止利用本站进行任何违法活动，或对未授权的第三方系统进行攻击测试。</li>
            </ul>
          </section>

          <section id="change" aria-labelledby="change-title">
            <h2 id="change-title">8. 变更</h2>
            <ul>
              <li>我们可能更新本条款，更新后会在本页公布新的生效日期。</li>
              <li>变更后继续使用本站，视为接受更新后的条款。</li>
              <li>如不同意变更内容，请停止使用本站。</li>
            </ul>
          </section>

          <p class="sp-alert sp-alert--info">
            本页为演示环境文案，不构成任何真实法律文件；文中主体、联系方式与备案信息均为虚构。
          </p>
        </article>
      </div>
    </div>
  `,
})
export class TermsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);

  constructor() {
    this.title.setTitle('服务条款 · 星澜优选');
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

  readonly sections: SectionNavItem[] = [
    { id: 'service', label: '服务说明' },
    { id: 'account', label: '账号' },
    { id: 'order', label: '订单与支付' },
    { id: 'delivery', label: '配送' },
    { id: 'return', label: '退换' },
    { id: 'ip', label: '知识产权' },
    { id: 'disclaimer', label: '免责' },
    { id: 'change', label: '变更' },
  ];
}
