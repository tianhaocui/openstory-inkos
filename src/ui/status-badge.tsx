/**
 * 统一状态徽标 — 把 (status, domain) 解析为 {label, tone, icon}。
 *
 * 文案永远渲染，颜色/图标只是辅助手段；这样在色觉障碍、灰度截图、
 * 以及状态值不在字典里的情况下，用户仍然能读到当前状态。
 */

import { AlertCircleIcon, CheckCircleIcon, Loader2Icon } from 'lucide-react';
import type { ComponentType } from 'react';
import { Badge } from '@/ui/shadcn/badge';
import { cn } from '@/ui/utils';

type StatusTone = 'neutral' | 'progress' | 'success' | 'warning' | 'danger';

export type StatusDomain =
  | 'shot-size'
  | 'camera-angle'
  | 'view-angle'
  | 'video-status'
  | 'asset-status'
  | 'chapter-status'
  | 'hook-status';

export interface ResolvedStatus {
  label: string;
  tone: StatusTone;
  icon: ComponentType<{ className?: string }> | null;
}

/** 原 filmmaking-panel 的本地 label 表统一收拢到这里。 */
const STATUS_LABELS: Record<StatusDomain, Record<string, string>> = {
  'shot-size': {
    extreme_wide: '大远景',
    wide: '远景',
    full: '全景',
    medium_wide: '中远景',
    medium: '中景',
    medium_close: '中近景',
    close_up: '近景',
    extreme_close_up: '特写',
  },
  'camera-angle': {
    eye_level: '平视',
    high: '高角度',
    low: '低角度',
    bird_eye: '俯瞰',
    overhead: '顶视',
    dutch: '倾斜角',
  },
  'view-angle': {
    front: '正面',
    side: '侧面',
    back: '背面',
    wide: '全景',
    detail: '细节',
  },
  'video-status': {
    pending: '等待中',
    queued: '排队中',
    processing: '生成中',
    generating: '生成中',
    failed: '失败',
    completed: '完成',
  },
  'asset-status': {
    generated: '已生成',
    pending: '待生成',
  },
  'chapter-status': {
    final: '已完成',
    review: '审阅中',
    draft: '草稿',
  },
  'hook-status': {
    resolved: '已解决',
    advanced: '已推进',
    open: '待处理',
  },
};

const CATEGORICAL_DOMAINS: ReadonlySet<StatusDomain> = new Set([
  'shot-size',
  'camera-angle',
  'view-angle',
]);

const COMPLETED_STATUSES: ReadonlySet<string> = new Set([
  'completed',
  'generated',
  'approved',
  'final',
  'resolved',
]);

const IN_PROGRESS_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'queued',
  'processing',
  'generating',
  'review',
  'advanced',
]);

const FAILED_STATUSES: ReadonlySet<string> = new Set(['failed', 'error']);

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'border-border bg-muted/50 text-muted-foreground',
  progress: 'border-info/40 bg-info/10 text-info',
  success: 'border-success/40 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
};

/** 只要文案时用它（例如图片 alt），不必渲染徽标。 */
export function statusLabel(
  domain: StatusDomain,
  status: string | null | undefined
): string {
  return STATUS_LABELS[domain][status ?? ''] ?? status ?? '未知';
}

/** 纯函数，便于单测与 story 直接使用。 */
export function resolveStatus(
  status: string | null | undefined,
  domain: StatusDomain
): ResolvedStatus {
  const key = status ?? '';
  const label = STATUS_LABELS[domain][key] || key || '未知';

  let tone: StatusTone = 'neutral';
  if (!CATEGORICAL_DOMAINS.has(domain)) {
    if (COMPLETED_STATUSES.has(key)) tone = 'success';
    else if (IN_PROGRESS_STATUSES.has(key)) tone = 'progress';
    else if (FAILED_STATUSES.has(key)) tone = 'danger';
  }

  const icon =
    tone === 'success'
      ? CheckCircleIcon
      : tone === 'danger'
        ? AlertCircleIcon
        : tone === 'progress'
          ? Loader2Icon
          : null;

  return { label, tone, icon };
}

export interface StatusBadgeProps {
  status: string | null | undefined;
  domain: StatusDomain;
  className?: string;
}

export function StatusBadge({ status, domain, className }: StatusBadgeProps) {
  const { label, tone, icon: Icon } = resolveStatus(status, domain);

  return (
    <Badge
      variant="outline"
      className={cn(TONE_CLASSES[tone], className)}
      data-tone={tone}
    >
      {Icon && <Icon className="size-3" aria-hidden="true" />}
      <span>{label}</span>
    </Badge>
  );
}
