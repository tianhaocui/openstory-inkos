import { cn } from '@/ui/utils';

type BigKalamiLogoProps = {
  className?: string;
  compact?: boolean;
};

/** The customer-facing brand mark used in the application shell and auth surfaces. */
export function BigKalamiLogo({
  className,
  compact = false,
}: BigKalamiLogoProps) {
  return (
    <span
      className={cn(
        'font-heading text-lg font-semibold tracking-tight text-foreground',
        compact && 'text-base',
        className
      )}
      aria-label="Big Kalami"
    >
      Big Kalami
    </span>
  );
}

export function BigKalamiMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-heading text-base font-semibold tracking-tight text-foreground',
        className
      )}
      aria-label="Big Kalami"
    >
      BK
    </span>
  );
}
