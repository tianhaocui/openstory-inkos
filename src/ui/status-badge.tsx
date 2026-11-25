/**
 * 统一状态徽标 — 把 (status, domain) 解析为 {label, tone, icon}。
 *
 * 文案永远渲染，颜色/图标只是辅助手段；这样在色觉障碍、灰度截图、
 * 以及状态值不在字典里的情况下，用户仍然能读到当前状态。
 */

import { AlertCircleIcon, CheckCircleIcon, Loader2Icon } from 'lucide-react';
import i18n from '@/i18n';
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

/** 状态值 → i18n key；渲染时经 t() 解析，缺 key 回退状态原值/「未知」。 */
const STATUS_LABELS: Record<StatusDomain, Record<string, string>> = {
  'shot-size': {
    extreme_wide: 'filmmaking.status.shotSizes.extremeWide',
    wide: 'filmmaking.status.shotSizes.wide',
    full: 'filmmaking.status.shotSizes.full',
    medium_wide: 'filmmaking.status.shotSizes.mediumWide',
    medium: 'filmmaking.status.shotSizes.medium',
    medium_close: 'filmmaking.status.shotSizes.mediumClose',
    close_up: 'filmmaking.status.shotSizes.closeUp',
    extreme_close_up: 'filmmaking.status.shotSizes.extremeCloseUp',
  },
  'camera-angle': {
    eye_level: 'filmmaking.status.cameraAngles.eyeLevel',
    high: 'filmmaking.status.cameraAngles.high',
    low: 'filmmaking.status.cameraAngles.low',
    bird_eye: 'filmmaking.status.cameraAngles.birdEye',
    overhead: 'filmmaking.status.cameraAngles.overhead',
    dutch: 'filmmaking.status.cameraAngles.dutch',
  },
  'view-angle': {
    front: 'filmmaking.status.viewAngles.front',
    side: 'filmmaking.status.viewAngles.side',
    back: 'filmmaking.status.viewAngles.back',
    wide: 'filmmaking.status.viewAngles.wide',
    detail: 'filmmaking.status.viewAngles.detail',
  },
  'video-status': {
    pending: 'filmmaking.status.video.pending',
    queued: 'filmmaking.status.video.queued',
    processing: 'filmmaking.status.video.processing',
    generating: 'filmmaking.status.video.generating',
    failed: 'filmmaking.status.video.failed',
    completed: 'filmmaking.status.video.completed',
  },
  'asset-status': {
    generated: 'filmmaking.status.asset.generated',
    pending: 'filmmaking.status.asset.pending',
  },
  'chapter-status': {
    final: 'filmmaking.status.chapter.final',
    review: 'filmmaking.status.chapter.review',
    draft: 'filmmaking.status.chapter.draft',
  },
  'hook-status': {
    resolved: 'filmmaking.status.hook.resolved',
    advanced: 'filmmaking.status.hook.advanced',
    open: 'filmmaking.status.hook.open',
  },
};

function resolveLabel(
  domain: StatusDomain,
  status: string | null | undefined
): string {
  const labelKey = STATUS_LABELS[domain][status ?? ''];
  if (labelKey) return String(i18n.t(labelKey));
  return status || String(i18n.t('filmmaking.status.unknown'));
}

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
  return resolveLabel(domain, status);
}

/** 纯函数，便于单测与 story 直接使用。 */
export function resolveStatus(
  status: string | null | undefined,
  domain: StatusDomain
): ResolvedStatus {
  const key = status ?? '';
  const label = resolveLabel(domain, status);

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
