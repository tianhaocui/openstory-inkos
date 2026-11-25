import type * as React from 'react';
import { cn } from '@/ui/utils';

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
}

/**
 * 容器内标题条（卡片、Tab 面板内部的标题 + 操作区）。
 *
 * 页面级标题请使用 `PageIntro`：它统一页面左右边距、sr-only 的 h1
 * 与描述排版，避免每页各写一套 PageContainer + PageHeader。
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  className,
  children,
  actions,
  title,
  description,
  ...props
}) => {
  return (
    <div
      className={cn('flex items-center justify-between', className)}
      {...props}
    >
      <div className="space-y-2">
        {title && <h1 className="text-2xl font-semibold">{title}</h1>}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {children}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
};
