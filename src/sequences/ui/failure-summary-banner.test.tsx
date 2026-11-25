import { CONTENT_REJECTION_USER_HINT } from '@/models/content-rejection';
import { CREDITS_SHORT_TITLE } from '@/billing/credits-short';
import type { FailureSummary } from '@/sequences/failure-analysis';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FailureSummaryBanner } from './failure-summary-banner';

const contentSummary: FailureSummary = {
  requiresFullRetry: true,
  headline: 'Harry Potter 未通过内容审核，请重新生成后重试',
  groups: [],
  totalFailures: 1,
  hasFailed: true,
  error: '内容审核未通过：Harry Potter',
  tone: 'warning',
};

const creditsSummary: FailureSummary = {
  requiresFullRetry: true,
  headline: CREDITS_SHORT_TITLE,
  groups: [],
  totalFailures: 1,
  hasFailed: true,
  error: '生成 11 个场景的图片所需点数不足。请再充值 $4.20，然后继续。',
  tone: 'credits',
};

const generationFailed: FailureSummary = {
  requiresFullRetry: true,
  headline: '生成失败，需要重新生成后重试',
  groups: [],
  totalFailures: 1,
  hasFailed: true,
  error: 'Workflow timed out while generating scene prompts',
  tone: 'error',
};

describe('FailureSummaryBanner', () => {
  it('SSRs the content-checker title instead of Generation failed', () => {
    const html = renderToStaticMarkup(
      <FailureSummaryBanner
        summary={contentSummary}
        onRetry={() => undefined}
        isRetrying={false}
      />
    );

    expect(html).toContain('内容审核');
    expect(html).toContain('未通过内容审核');
    expect(html).toContain('重新生成后重试');
    expect(html).toContain(CONTENT_REJECTION_USER_HINT);
    expect(html).not.toContain('Generation failed');
  });

  it('SSRs a top-up prompt instead of Generation failed (#1328)', () => {
    const html = renderToStaticMarkup(
      <FailureSummaryBanner
        summary={creditsSummary}
        onRetry={() => undefined}
        isRetrying={false}
      />
    );

    expect(html).toContain(CREDITS_SHORT_TITLE);
    expect(html).toContain('此序列包含 11 个场景');
    expect(html).toContain('请再充值 $4.20');
    expect(html).toContain('充值点数');
    expect(html).toContain('继续生成');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('Generation failed');
    expect(html).not.toContain('full retry required');
    expect(html).not.toContain('Regenerate Sequence');
    expect(html).not.toContain('text-destructive');
    expect(html).not.toContain('font-mono');
  });

  it('SSRs error-tone retry while mobile starts collapsed', () => {
    const html = renderToStaticMarkup(
      <FailureSummaryBanner
        summary={generationFailed}
        onRetry={() => undefined}
        onFullRetry={() => undefined}
        isRetrying={false}
      />
    );

    expect(html).toContain('生成失败');
    expect(html).toContain('Workflow timed out');
    expect(html).toContain('重新生成序列');
    expect(html).toContain('显示详情');
    expect(html).toContain('aria-expanded="false"');
  });
});
