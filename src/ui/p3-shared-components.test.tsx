import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GenerationStateBanner } from './generation-state-banner';
import { MediaThumbnail } from './media-thumbnail';
import { PipelineProgress } from './pipeline-progress';
import { ShotActionButton, shotActionToastId } from './shot-action-button';
import { resolveStatus, StatusBadge } from './status-badge';

const { buttons } = vi.hoisted(() => ({
  buttons: new Map<string, { onClick?: () => void; disabled?: boolean }>(),
}));

vi.mock('@/ui/shadcn/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => {
    if (ariaLabel) {
      buttons.set(ariaLabel, {
        onClick: disabled ? undefined : onClick,
        disabled: disabled === true,
      });
    }
    return (
      <button type="button" aria-label={ariaLabel} disabled={disabled}>
        {children}
      </button>
    );
  },
}));

describe('StatusBadge', () => {
  it('resolves label/tone/icon by domain and status', () => {
    expect(resolveStatus('close_up', 'shot-size').label).toBe('近景');
    expect(resolveStatus('close_up', 'shot-size').tone).toBe('neutral');

    const completed = resolveStatus('completed', 'video-status');
    expect(completed.label).toBe('完成');
    expect(completed.tone).toBe('success');
    expect(completed.icon).not.toBeNull();

    const failed = resolveStatus('failed', 'video-status');
    expect(failed.label).toBe('失败');
    expect(failed.tone).toBe('danger');
  });

  it('always renders a text label, including unknown statuses', () => {
    const html = renderToStaticMarkup(
      <StatusBadge domain="video-status" status="mystery_state" />
    );
    expect(html).toContain('mystery_state');
    expect(html).toContain('data-tone="neutral"');
  });
});

describe('PipelineProgress', () => {
  it('renders stage states as text instead of a fake 0/100 bar', () => {
    const html = renderToStaticMarkup(
      <PipelineProgress
        stages={[
          { label: '分镜切分', state: 'completed', detail: '3 片段' },
          { label: '视频生成', state: 'active', detail: '1/4 片段' },
        ]}
      />
    );
    expect(html).toContain('已完成');
    expect(html).toContain('进行中');
    expect(html).toContain('1/4 片段');
    expect(html).not.toContain('value="0"');
    expect(html).not.toContain('value="100"');
  });
});

describe('MediaThumbnail', () => {
  it('includes the shot number in the alt text', () => {
    const html = renderToStaticMarkup(
      <MediaThumbnail src="/kf.png" alt="关键帧" shotNumber={7} />
    );
    expect(html).toContain('alt="镜头 7 · 关键帧"');
  });

  it('uses a labelled placeholder when the image is missing', () => {
    const html = renderToStaticMarkup(
      <MediaThumbnail src={null} alt="关键帧" shotNumber={3} />
    );
    expect(html).toContain('alt="镜头 3 · 关键帧（暂无图片）"');
  });
});

describe('GenerationStateBanner', () => {
  it('renders nothing when idle and an alert with retry on error', () => {
    expect(
      renderToStaticMarkup(<GenerationStateBanner phase="idle" title="" />)
    ).toBe('');

    const onRetry = vi.fn();
    const html = renderToStaticMarkup(
      <GenerationStateBanner
        phase="error"
        title="生成视频片段"
        detail="积分不足"
        onRetry={onRetry}
      />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('生成失败');
    expect(html).toContain('积分不足');
    expect(html).toContain('重试');
  });
});

describe('ShotActionButton (wrapper only)', () => {
  const keyframe = {
    id: 'keyframe-1',
    shotId: 'shot-1',
    name: 'Keyframe',
    imageUrl: '/kf.png',
    status: 'completed',
  };

  it('exposes an i18n-backed group label and a stable toast id', () => {
    const html = renderToStaticMarkup(
      <ShotActionButton
        shotNumber={5}
        keyframe={keyframe}
        clips={[]}
        busy={false}
        onGenerateVideo={async () => undefined}
        onPlay={() => undefined}
        toastId={shotActionToastId(5)}
      />
    );
    // fieldset 的隐式 role 就是 group，所以无需手动写 role="group"。
    expect(html).toContain('<fieldset');
    expect(html).toContain('aria-label="为镜头 5 生成视频"');
    expect(html).toContain('data-toast-id="shot-video-5"');
  });

  it('delegates to the unchanged ShotVideoButton: ready → one generate call', () => {
    buttons.clear();
    const onGenerateVideo = vi.fn(async () => undefined);
    renderToStaticMarkup(
      <ShotActionButton
        shotNumber={1}
        keyframe={keyframe}
        clips={[]}
        busy={false}
        onGenerateVideo={onGenerateVideo}
        onPlay={() => undefined}
      />
    );
    const generate = buttons.get('为镜头 1 生成视频');
    expect(generate?.disabled).toBe(false);
    generate?.onClick?.();
    expect(onGenerateVideo).toHaveBeenCalledExactlyOnceWith('keyframe-1');
  });

  it('delegates the in-flight guard: no extra paid attempt', () => {
    buttons.clear();
    const onGenerateVideo = vi.fn(async () => undefined);
    renderToStaticMarkup(
      <ShotActionButton
        shotNumber={1}
        keyframe={keyframe}
        clips={[
          {
            id: 'clip-1',
            keyframeId: 'keyframe-1',
            videoUrl: null,
            duration: null,
            status: 'queued',
          },
        ]}
        busy={false}
        onGenerateVideo={onGenerateVideo}
        onPlay={() => undefined}
      />
    );
    const generate = buttons.get('为镜头 1 生成视频');
    expect(generate?.disabled).toBe(true);
    generate?.onClick?.();
    expect(onGenerateVideo).not.toHaveBeenCalled();
  });
});
