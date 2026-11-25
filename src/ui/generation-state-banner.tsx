/**
 * 生成态横幅 — loading / partial / error / retry 统一表现。
 *
 * 四种态都有文字（不只靠图标颜色），error 使用 role="alert"，
 * 其余使用 role="status"，并提供可聚焦的重试按钮。
 */

import { AlertCircleIcon, InfoIcon, Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/ui/shadcn/alert';
import { Button } from '@/ui/shadcn/button';
import { cn } from '@/ui/utils';

type GenerationBannerPhase = 'idle' | 'loading' | 'partial' | 'error';

export interface GenerationStateBannerProps {
  phase: GenerationBannerPhase;
  title: string;
  detail?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export function GenerationStateBanner({
  phase,
  title,
  detail,
  onRetry,
  isRetrying = false,
  className,
}: GenerationStateBannerProps) {
  const { t } = useTranslation();
  if (phase === 'idle') return null;

  const isError = phase === 'error';
  const isLoading = phase === 'loading';
  const Icon = isError ? AlertCircleIcon : isLoading ? Loader2Icon : InfoIcon;

  return (
    <Alert
      role={isError ? 'alert' : 'status'}
      variant={isError ? 'destructive' : 'default'}
      className={cn(
        'border-primary/50 bg-primary/5',
        // Error stays identifiable via the icon + text; override the
        // destructive *text* token so it clears 4.5:1 on the dark surface.
        isError &&
          'border-destructive/50 bg-destructive/5 text-foreground *:data-[slot=alert-description]:text-muted-foreground',
        className
      )}
      data-phase={phase}
    >
      <Icon
        className={cn(isLoading && 'animate-spin', 'size-5')}
        aria-hidden="true"
      />
      <AlertDescription className="flex flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          <span>
            {isError
              ? t('filmmaking.banner.error')
              : isLoading
                ? t('filmmaking.banner.loading')
                : t('filmmaking.banner.partial')}
          </span>
          <span className="text-muted-foreground">{title}</span>
        </span>
        {detail && (
          <span className="text-sm text-muted-foreground">{detail}</span>
        )}
        {onRetry && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying
              ? t('filmmaking.banner.retrying')
              : t('filmmaking.banner.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
