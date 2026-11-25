import { PageContainer } from '@/ui/layout/page-container';
import { PageDescription } from './page-description';
import { PageHeader } from './page-header';
import type { ReactNode } from 'react';

/**
 * Locked chrome for the page one-liner. Same inset and size on every list
 * page (and the signed-in composer). Pass the same `maxWidth` as the content
 * container below so both share a left edge at every viewport width.
 *
 * 页面级入口组件：`PageHeader` 只用于容器内部的小标题，不要再直接放在
 * 页面根节点上。
 */
export function PageIntro({
  title,
  children,
  actions,
  maxWidth = 'default',
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: 'default' | 'narrow' | 'wide' | 'full';
}) {
  return (
    <PageContainer maxWidth={maxWidth} padding="compact" className="shrink-0">
      <h1 className="sr-only">{title}</h1>
      <PageHeader actions={actions} className="items-start">
        <PageDescription>{children}</PageDescription>
      </PageHeader>
    </PageContainer>
  );
}
