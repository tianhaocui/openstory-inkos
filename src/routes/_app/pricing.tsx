/**
 * Public model pricing catalog — lives in the app shell so it matches the
 * rest of the product chrome (sidebar, breadcrumbs). Anonymous-browsable.
 */

import { useAuthGate } from '@/platform/ui/auth/auth-gate-provider';
import { createFileRoute } from '@tanstack/react-router';
import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import {
  formatPlatformFeePercent,
  PLATFORM_FEE_PERCENT,
} from '@/billing/constants';
import { getPricingCatalogFn } from '@/billing/pricing.fn';
import { openAddCreditsDialog } from '@/billing/ui/use-add-credits-dialog';
import { SITE_CONFIG } from '@/ui/marketing/constants';
import { ArrowUpRight, KeyRound } from 'lucide-react';

const title = `定价 — ${SITE_CONFIG.name}`;
const description =
  '按使用量向服务商付费，每次消费前均会显示预估费用。使用您自己的密钥可跳过钱包。';

export const Route = createFileRoute('/_app/pricing')({
  component: PricingPage,
  loader: () => getPricingCatalogFn(),
  staticData: { breadcrumb: '定价' },
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: `${SITE_CONFIG.url}/pricing` },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
  }),
});

function PricingPage() {
  const { sections, lastUpdated, filmCosts } = Route.useLoaderData();
  const { requireAuth } = useAuthGate();
  const feePercent = formatPlatformFeePercent();
  const chargeFor100 = (100 * (1 + PLATFORM_FEE_PERCENT)).toFixed(0);
  const onAddCredits = () => {
    requireAuth(() => openAddCreditsDialog('pricing'));
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-6 pb-16">
      <header className="max-w-2xl">
        <h1 className="font-heading text-3xl font-bold tracking-tight">定价</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          按使用量向服务商付费。每次消费前，我们都会在相应操作下显示预估费用。
          {filmCosts?.welcomeCredits ? (
            <>
              {' '}
              新账户保存银行卡（不会扣款）后可免费获得{' '}
              <span className="font-medium text-foreground tabular-nums">
                {filmCosts.welcomeCredits}
              </span>{' '}
              ，足够制作一部包含动态画面和音乐的典型 30 秒短片。
            </>
          ) : null}
        </p>
      </header>

      {filmCosts && (
        <section id="film-cost" className="mt-10">
          <div className="mb-4 max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight">
              典型的第一部影片
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              目标时长 {filmCosts.targetDurationSeconds} 秒（Enhance
              默认值），采用产品默认模型（
              {filmCosts.imageModelName}、{filmCosts.videoModelName}、
              {filmCosts.audioModelName}
              ）。这些费用使用与“生成”相同的估算器（固定 30
              秒展示片）；我们会尽量准确，但生成完成后的最终费用可能不同。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {filmCosts.examples.map((example) => (
              <div
                key={example.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-5"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{example.title}</p>
                  <p className="font-heading text-2xl font-bold tracking-tight tabular-nums">
                    {example.cost}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {example.subtitle}
                  </p>
                </div>
                <ul className="flex flex-col gap-1.5 border-t pt-3 text-xs text-muted-foreground">
                  {example.breakdown.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Button onClick={onAddCredits}>充值点数</Button>
          </div>
        </section>
      )}

      <section
        id="how-billing-works"
        className="mt-10 flex flex-col gap-3 text-sm text-muted-foreground"
      >
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          计费方式
        </h2>
        <ul className="flex flex-col gap-2">
          <li>
            使用钱包时，点数按 fal.ai / OpenRouter 的费率扣除。媒体生成使用
            fal，剧本分析使用 OpenRouter。
          </li>
          <li>
            {feePercent} 的费用仅在您
            <span className="text-foreground">购买</span>
            点数时收取（支付 ${chargeFor100}，钱包到账
            $100），不会在每次生成时收取。
          </li>
          <li className="flex items-start gap-2">
            <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-medium text-foreground">
                使用您自己的密钥
              </span>{' '}
              可在“设置”中直接向平台付费并跳过钱包。fal.ai
              覆盖媒体生成；OpenRouter 可选用于分析。
            </span>
          </li>
        </ul>
      </section>

      <div className="mt-12 flex flex-col gap-12">
        {sections.map((section) => (
          <section key={section.id} id={section.id}>
            <div className="mb-4 max-w-2xl">
              <h2 className="text-xl font-semibold tracking-tight">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {section.description}
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 font-medium">模型</th>
                    <th className="px-4 py-3 font-medium">供应商</th>
                    <th className="px-4 py-3 font-medium">渠道</th>
                    <th className="px-4 py-3 font-medium text-right">
                      参考费率
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr
                      key={`${row.via}-${row.name}`}
                      className="border-b last:border-b-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{row.name}</span>
                          {row.license === 'open-weight' && (
                            <Badge variant="secondary" className="text-xs">
                              开放权重
                            </Badge>
                          )}
                        </div>
                        {row.detail && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.detail}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.vendor}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={row.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {row.via}
                          <ArrowUpRight className="size-3.5 shrink-0" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums sm:text-sm">
                        {row.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        参考费率来自平台 API（{lastUpdated}
        ）。实际费用以计费单位为准。渠道链接将打开对应平台的完整定价页面。
      </p>

      <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border bg-muted/30 px-6 py-10 text-center">
        <h2 className="text-xl font-semibold">随时可以开始</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          为钱包充值，或在“设置”中连接服务商密钥并直接向平台付费。无需订阅。
        </p>
        <Button size="lg" onClick={onAddCredits}>
          充值点数
        </Button>
      </div>
    </div>
  );
}
