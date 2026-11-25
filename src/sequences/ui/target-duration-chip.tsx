/**
 * Film-length chip (#1593). On the scene rail it shows the cut's running time
 * — the sum of every shot's `durationMs` — next to the sequence target; in
 * Sequence settings it shows the target alone. Click to change the target
 * (presets, any number of seconds, or Auto = null, "as long as the script
 * needs"). Only Enhance sets it at create; it steers Enhance and the credit
 * estimate and never rebalances shots.
 */

import { Popover, PopoverContent, PopoverTrigger } from '@/ui/shadcn/popover';
import { ToggleGroup, ToggleGroupItem } from '@/ui/shadcn/toggle-group';
import { Input } from '@/ui/shadcn/input';
import { useSetSequenceTargetDuration } from './use-sequences';
import { errorMessage } from '@/platform/errors';
import { toast } from 'sonner';
import { useId } from 'react';

export const TARGET_DURATION_PRESETS = [
  { value: '15', label: '15s' },
  { value: '30', label: '30s' },
  { value: '60', label: '1m' },
  { value: '120', label: '2m' },
  { value: '180', label: '3m' },
  { value: '300', label: '5m' },
] as const;

/** "48s" / "1m 12s" — the chip's unit, not the raw second count. */
export function formatSeconds(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole}s`;
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

export const TargetDurationChip: React.FC<{
  sequenceId: string;
  /** Sum of `shots.durationMs` across the live cut; omit to show the target alone. */
  totalSeconds?: number;
  /** `sequences.targetDurationSeconds`; null / undefined = auto. */
  targetDurationSeconds: number | null | undefined;
}> = ({ sequenceId, totalSeconds, targetDurationSeconds }) => {
  const setTarget = useSetSequenceTargetDuration(sequenceId);
  const customId = useId();
  const target = targetDurationSeconds ?? null;
  const targetLabel = target === null ? '自动' : formatSeconds(target);
  let label = targetLabel;
  if (totalSeconds !== undefined) {
    label =
      target === null
        ? formatSeconds(totalSeconds)
        : `${formatSeconds(totalSeconds)} · 目标 ${targetLabel}`;
  }
  const commit = (next: number | null) => {
    if (next === target) return;
    setTarget.mutate(next, {
      onError: (error) =>
        toast.error('设置目标时长失败', {
          description: errorMessage(error),
        }),
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label={
            totalSeconds === undefined
              ? `目标时长 ${label}。更改`
              : `当前时长 ${label}。更改目标时长`
          }
          data-testid="film-length-chip"
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">目标时长</p>
          <ToggleGroup
            type="single"
            value={target === null ? 'auto' : String(target)}
            onValueChange={(value) => {
              if (!value) return;
              commit(value === 'auto' ? null : Number(value));
            }}
            variant="outline"
            size="sm"
            spacing={0}
          >
            <ToggleGroupItem value="auto">自动</ToggleGroupItem>
            {TARGET_DURATION_PRESETS.map((preset) => (
              <ToggleGroupItem key={preset.value} value={preset.value}>
                {preset.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <label htmlFor={customId}>自定义</label>
            <Input
              id={customId}
              key={target ?? 'auto'}
              type="number"
              inputMode="numeric"
              min={5}
              step={1}
              defaultValue={target ?? ''}
              placeholder="秒"
              className="h-8 w-24 text-base md:text-sm"
              onBlur={(e) => {
                const raw = e.currentTarget.value;
                if (raw === '') {
                  commit(null);
                  return;
                }
                const n = Number(raw);
                if (Number.isInteger(n) && n >= 5) {
                  commit(n);
                  return;
                }
                e.currentTarget.value = target === null ? '' : String(target);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
            s
          </div>
          <p className="text-xs text-muted-foreground">
            用于指导剧本增强和时长估算，不会修改各镜头时长。
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
