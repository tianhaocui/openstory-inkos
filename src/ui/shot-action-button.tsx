/**
 * 镜头操作按钮 — 对冻结的 ShotVideoButton 做纯外包。
 *
 * 红线：本文件不复制、不重写、不改动 `ShotVideoButton` 的任何内部逻辑
 * （isVideoInFlight / canGenerate / 播放分支）。它只做三件外围事：
 *   1. 通过 i18n 给外层 group 注入 aria-label；
 *   2. 给外层节点打上稳定的 toast id（供调用方去重 toast，不参与扣费判断）；
 *   3. 生成结束、按钮从 disabled 恢复时把键盘焦点还回按钮。
 *
 * props 形状与回调签名与 ShotVideoButton 完全一致，内部原样透传。
 */

import { useEffect, useRef } from 'react';
import i18n from '@/i18n';
import { ShotVideoButton } from '@/stories/ui/filmmaking-panel';
import { cn } from '@/ui/utils';

type ShotKeyframe = {
  id: string;
  shotId: string | null;
  name: string;
  imageUrl: string | null;
  status: string;
};

type ShotClip = {
  id: string;
  keyframeId: string | null;
  videoUrl: string | null;
  duration: number | null;
  status: string;
};

/** 稳定的 toast id：调用方可把它传给 toast.loading({ id }) 以避免重复提示。 */
export function shotActionToastId(shotNumber: number): string {
  return `shot-video-${shotNumber}`;
}

/** P4 接入 filmmaking.* 字典后会自动切到译文，缺 key 时回退中文。 */
function resolveAriaLabel(shotNumber: number, action: 'generate' | 'play') {
  const key =
    action === 'generate'
      ? 'filmmaking.video.generateAria'
      : 'filmmaking.video.playAria';
  if (i18n.exists(key)) {
    return String(i18n.t(key, { number: shotNumber }));
  }
  return action === 'generate'
    ? `为镜头 ${shotNumber} 生成视频`
    : `播放镜头 ${shotNumber} 视频`;
}

export interface ShotActionButtonProps {
  shotNumber: number;
  keyframe: ShotKeyframe | undefined;
  clips: ShotClip[];
  busy: boolean;
  onGenerateVideo: (keyframeId: string) => Promise<void>;
  onPlay: (url: string) => void;
  toastId?: string;
  className?: string;
}

export function ShotActionButton({
  shotNumber,
  keyframe,
  clips,
  busy,
  onGenerateVideo,
  onPlay,
  toastId,
  className,
}: ShotActionButtonProps) {
  const wrapperRef = useRef<HTMLFieldSetElement>(null);
  const hadFocusRef = useRef(false);

  // 判断当前呈现的是播放还是生成分支，只影响外层 aria-label，
  // 不影响内部按钮选择哪个分支。
  const hasPlayableClip = clips.some((clip) => Boolean(clip.videoUrl));
  const ariaLabel = resolveAriaLabel(
    shotNumber,
    hasPlayableClip ? 'play' : 'generate'
  );

  // 焦点保持：生成期间按钮 disabled，浏览器可能把焦点移到 body；
  // 一旦按钮恢复可用且之前焦点在按钮上，就把它还回去。
  useEffect(() => {
    const button = wrapperRef.current?.querySelector('button');
    if (!button) return;
    if (
      hadFocusRef.current &&
      !button.disabled &&
      document.activeElement !== button
    ) {
      button.focus();
      hadFocusRef.current = false;
    }
  }, [busy, clips, keyframe]);

  return (
    <fieldset
      ref={wrapperRef}
      aria-label={ariaLabel}
      data-toast-id={toastId}
      data-shot-number={shotNumber}
      className={cn('m-0 inline-flex border-0 p-0', className)}
      onFocusCapture={() => {
        hadFocusRef.current = true;
      }}
      onBlurCapture={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget)) {
          hadFocusRef.current = false;
        }
      }}
    >
      <ShotVideoButton
        shotNumber={shotNumber}
        keyframe={keyframe}
        clips={clips}
        busy={busy}
        onGenerateVideo={onGenerateVideo}
        onPlay={onPlay}
      />
    </fieldset>
  );
}
