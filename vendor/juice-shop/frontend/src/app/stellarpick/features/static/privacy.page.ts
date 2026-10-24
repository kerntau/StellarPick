import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { SectionNavComponent, SectionNavItem } from './components/section-nav.component';

@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [SectionNavComponent],
  styleUrl: './components/legal-doc.scss',
  template: `
    <div class="sp-container">
      <header class="head">
        <p class="sp-eyebrow">法律与条款</p>
        <h1>隐私政策</h1>
        <p class="meta">生效日期：2026-10-01 · 适用主体：星澜优选（演示）</p>
      </header>

      <div class="doc">
        <aside class="side">
          <app-section-nav [items]="sections" title="目录" ariaLabel="隐私政策目录" />
        </aside>

        <article class="article">
          <p class="lead">
            本政策说明星澜优选（演示）如何收集、使用与保护你在本站产生的信息。
            本站是安全培训靶场，所有数据均为虚构，请勿填写真实的个人信息、支付信息或证件材料。
          </p>

          <section id="intro" aria-labelledby="intro-title">
            <h2 id="intro-title">1. 引言与适用范围</h2>
            <p>本政策适用于星澜优选（演示）（下称「本站」）的浏览、注册、下单、售后与客服功能。</p>
            <p>
              本站为演示环境，不提供真实商品销售、支付或物流服务；页面中的品牌、商品、价格、评价、
              商家与联系方式均为虚构。使用本站前请阅读本政策，如不同意，请停止使用。
            </p>
          </section>

          <section id="collect" aria-labelledby="collect-title">
            <h2 id="collect-title">2. 我们收集的信息</h2>
            <ul>
              <li><strong>账号信息：</strong>注册时填写的昵称、邮箱与密码，以及登录后用于维持会话的令牌。</li>
              <li><strong>资料信息：</strong>你主动上传的头像与填写的手机号（可选）。</li>
              <li><strong>交易信息：</strong>收货地址、订单、优惠券、评价与客服工单内容。</li>
              <li><strong>访问信息：</strong>浏览器类型、访问路径、请求编号（requestId）与错误日志。</li>
            </ul>
            <p>本站不会收集身份证件、银行卡号、支付密码或生物识别信息。</p>
          </section>

          <section id="use" aria-labelledby="use-title">
            <h2 id="use-title">3. 信息的使用</h2>
            <ul>
              <li>完成注册、登录、下单、配送、售后与客服等核心流程。</li>
              <li>维持登录状态，展示会员权益、优惠券与订单状态。</li>
              <li>排查故障、改进页面体验与选品结构。</li>
            </ul>
            <p>我们不会将上述信息用于自动化决策、个性化广告或与演示无关的用途。</p>
          </section>

          <section id="cookie" aria-labelledby="cookie-title">
            <h2 id="cookie-title">4. Cookie 与本地存储</h2>
            <ul>
              <li>
                登录成功后，登录令牌保存在浏览器 <strong>localStorage</strong> 的
                <code>token</code> 键中，页面据此展示昵称与会员等级。
              </li>
              <li>最近搜索的关键词保存在 <code>sp.recent</code>，购物车数量等界面偏好也保存在浏览器本地。</li>
              <li>你可以通过浏览器设置随时清除上述数据；清除后需要重新登录。</li>
              <li>本站不接入第三方统计、广告或社交 Cookie。</li>
            </ul>
            <p>
              为便于演示令牌被篡改的场景，本站未对本地令牌做额外的加密或签名校验。
              这是安全演练有意保留的设计，请勿在真实业务中沿用。
            </p>
          </section>

          <section id="share" aria-labelledby="share-title">
            <h2 id="share-title">5. 共享与委托处理</h2>
            <ul>
              <li>本站不会向任何第三方出售、出租或共享你的信息。</li>
              <li>演示环境中的支付、物流、短信与邮件均为本地模拟，不会向外部服务传输数据。</li>
              <li>仅在法律法规、司法或行政机关依法要求时提供，演示环境不涉及此类情形。</li>
            </ul>
          </section>

          <section id="rights" aria-labelledby="rights-title">
            <h2 id="rights-title">6. 你的权利</h2>
            <ul>
              <li><strong>查询与更正：</strong>在个人中心查看并修改昵称、邮箱、头像等资料。</li>
              <li><strong>删除：</strong>可删除收货地址与评价，删除后不可恢复。</li>
              <li><strong>撤回同意：</strong>退出登录，或清除浏览器本地存储中的登录令牌。</li>
              <li><strong>注销：</strong>演示环境可由管理员重置账号数据。</li>
            </ul>
          </section>

          <section id="update" aria-labelledby="update-title">
            <h2 id="update-title">7. 政策更新</h2>
            <p>政策更新后会在本页公布新的生效日期；涉及重大变更时，会在站内以提示条方式告知。</p>
          </section>

          <section id="contact" aria-labelledby="contact-title">
            <h2 id="contact-title">8. 联系我们</h2>
            <ul>
              <li>邮箱：service@stellarpick.example</li>
              <li>客服热线：400-000-0000（每日 9:00–21:00）</li>
              <li>地址：上海市星澜区示例路 88 号 3 栋 12 层</li>
            </ul>
            <p>与个人信息相关的请求，我们会在 15 个工作日内回复；演示环境不承诺真实的处理时效。</p>
          </section>

          <p class="sp-alert sp-alert--info">
            本页为演示环境文案，不构成任何真实法律文件；文中主体、联系方式与备案信息均为虚构。
          </p>
        </article>
      </div>
    </div>
  `,
})
export class PrivacyPage {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);

  constructor() {
    this.title.setTitle('隐私政策 · 星澜优选');
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
    { id: 'intro', label: '引言与适用范围' },
    { id: 'collect', label: '收集的信息' },
    { id: 'use', label: '信息的使用' },
    { id: 'cookie', label: 'Cookie 与本地存储' },
    { id: 'share', label: '共享与委托处理' },
    { id: 'rights', label: '你的权利' },
    { id: 'update', label: '政策更新' },
    { id: 'contact', label: '联系我们' },
  ];
}
