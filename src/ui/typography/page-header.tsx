import type * as React from 'react';
import { cn } from '@/ui/utils';

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
}

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
