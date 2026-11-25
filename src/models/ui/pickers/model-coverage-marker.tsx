import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/ui/shadcn/tooltip';
import type { ModelCoverage } from './sequence-model-coverage';
import { Check, CircleAlert, CircleCheck, Loader2 } from 'lucide-react';

/**
 * Sequence-wide per-model coverage marker for the header image/video dropdowns
 * (#547). Mirrors the per-scene status icons but reads "for the whole sequence":
 * ⊙ live primary / ✓ generated (with an N/M count while only partially filled)
 * / ⟳ generating / ! failed. `pending` renders nothing.
 */
export const ModelCoverageMarker = ({
  coverage,
}: {
  coverage?: ModelCoverage;
}) => {
  if (!coverage || coverage.status === 'pending') return null;
  const { status, completed, total } = coverage;
  const partial =
    status === 'completed' && total > 0 && completed > 0 && completed < total;

  const { Icon, className, label } = (() => {
    switch (status) {
      case 'set':
        return {
          Icon: CircleCheck,
          className: 'text-emerald-500',
          label: '已设为整个序列的主模型',
        };
      case 'generating':
        return {
          Icon: Loader2,
          className: 'text-muted-foreground animate-spin',
          label: '正在生成…',
        };
      case 'failed':
        return {
          Icon: CircleAlert,
          className: 'text-destructive',
          label: '生成失败',
        };
      default:
        return {
          Icon: Check,
          className: 'text-muted-foreground',
          label: partial
            ? `已为 ${total} 个场景中的 ${completed} 个生成，选中后设置即可使用`
            : '已为所有场景生成，选中后设置即可使用',
        };
    }
  })();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground"
            aria-label={label}
          >
            {partial && (
              <span className="tabular-nums">
                {completed}/{total}
              </span>
            )}
            <Icon className={`size-3.5 ${className}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
