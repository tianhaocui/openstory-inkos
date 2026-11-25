/**
 * 统一缩略图 — alt 带镜头号，缺图时给可读占位而不是破图。
 */

import { cn } from '@/ui/utils';

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export interface MediaThumbnailProps {
  src: string | null | undefined;
  alt: string;
  /** 镜头号（可选）：有则进入 alt，便于屏幕阅读器定位到具体镜头。 */
  shotNumber?: number;
  className?: string;
}

export function MediaThumbnail({
  src,
  alt,
  shotNumber,
  className,
}: MediaThumbnailProps) {
  const descriptiveAlt =
    shotNumber === undefined ? alt : `镜头 ${shotNumber} · ${alt}`;

  if (!src) {
    // 透明像素 + bg-muted 占位：保留 img 语义与 alt，避免出现破图图标。
    return (
      <img
        src={TRANSPARENT_PIXEL}
        alt={`${descriptiveAlt}（暂无图片）`}
        className={cn('bg-muted', className)}
      />
    );
  }

  return (
    <img
      src={src}
      alt={descriptiveAlt}
      className={cn('rounded object-cover', className)}
    />
  );
}
