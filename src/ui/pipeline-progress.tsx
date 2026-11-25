/**
 * 流水线阶段进度 — 用「阶段 + 状态文字」替代 0/100 二值进度条。
 *
 * 一个阶段是否完成往往无法压缩成一个精确百分比；展示阶段态与计数
 * 既不会伪造进度，也能让部分完成的状态可见。
 */

import {
  AlertCircleIcon,
  CheckCircleIcon,
  CircleDashedIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Progress } from '@/ui/shadcn/progress';
import { cn } from '@/ui/utils';

type PipelineStageState =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PipelineStage {
  label: string;
  state: PipelineStageState;
  detail?: string;
  /** 仅在有真实分子/分母时提供；阶段文字始终优先。 */
  percent?: number;
}

const STATE_LABELS: Record<PipelineStageState, string> = {
  pending: '未开始',
  active: '进行中',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
};

const STATE_ICONS: Record<
  PipelineStageState,
  ComponentType<{ className?: string }>
> = {
  pending: CircleDashedIcon,
  active: CircleDashedIcon,
  completed: CheckCircleIcon,
  failed: AlertCircleIcon,
  skipped: CircleDashedIcon,
};

const STATE_CLASSES: Record<PipelineStageState, string> = {
  pending: 'border-border text-muted-foreground',
  active: 'border-info/50 bg-info/10 text-info',
  completed: 'border-success/50 bg-success/10 text-success',
  failed: 'border-destructive/50 bg-destructive/10 text-destructive',
  skipped: 'border-border text-muted-foreground line-through',
};

export interface PipelineProgressProps {
  stages: PipelineStage[];
  label?: string;
  className?: string;
}

export function PipelineProgress({
  stages,
  label = '流水线进度',
  className,
}: PipelineProgressProps) {
  return (
    <ol
      aria-label={label}
      className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}
    >
      {stages.map((stage) => {
        const Icon = STATE_ICONS[stage.state];
        return (
          <li
            key={stage.label}
            data-state={stage.state}
            className={cn(
              'flex min-w-0 items-start gap-2 rounded-lg border p-3',
              STATE_CLASSES[stage.state]
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-medium text-foreground">
                {stage.label}
              </p>
              <p className="text-xs">
                <span className="font-medium">{STATE_LABELS[stage.state]}</span>
                <span>{` · ${stage.detail ?? '—'}`}</span>
              </p>
              {stage.percent !== undefined && (
                <Progress
                  value={stage.percent}
                  aria-label={`${stage.label}完成比例`}
                  className="h-1"
                />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
