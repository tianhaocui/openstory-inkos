import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ShotVideoButton } from './filmmaking-panel';

/**
 * SSR-only test environment (no jsdom dependency in this repo): the Button
 * mock records the handlers attached to the icon-only video buttons so the
 * test can invoke them directly and assert which handler was wired.
 */
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
      // Browsers never dispatch click on a disabled button — mirror that so
      // the test can invoke the captured handler unconditionally.
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

type Clip = {
  id: string;
  keyframeId: string | null;
  videoUrl: string | null;
  duration: number | null;
  status: string;
};

type Keyframe = {
  id: string;
  shotId: string | null;
  name: string;
  imageUrl: string | null;
  status: string;
};

const generateLabel = '为镜头 1 生成视频';
const playLabel = '播放镜头 1 视频';

function renderButton(options: {
  keyframeStatus?: string;
  clips?: Clip[];
  busy?: boolean;
  onGenerateVideo?: (keyframeId: string) => Promise<void>;
  onPlay?: (url: string) => void;
}): string {
  buttons.clear();
  const keyframe: Keyframe | undefined =
    options.keyframeStatus === 'none'
      ? undefined
      : {
          id: 'keyframe-1',
          shotId: 'shot-1',
          name: 'Keyframe',
          imageUrl: 'https://example.test/keyframe.png',
          status: options.keyframeStatus ?? 'completed',
        };
  return renderToStaticMarkup(
    <ShotVideoButton
      shotNumber={1}
      keyframe={keyframe}
      clips={options.clips ?? []}
      busy={options.busy ?? false}
      onGenerateVideo={options.onGenerateVideo ?? (async () => undefined)}
      onPlay={options.onPlay ?? (() => undefined)}
    />
  );
}

function makeClip(status: string, videoUrl: string | null = null): Clip {
  return {
    id: 'clip-1',
    keyframeId: 'keyframe-1',
    videoUrl,
    duration: 6,
    status,
  };
}

describe('ShotVideoButton', () => {
  it('is enabled for a completed keyframe and calls onGenerateVideo with its id', () => {
    const onGenerateVideo = vi.fn(async () => undefined);
    const html = renderButton({ onGenerateVideo });

    expect(html).toContain(`aria-label="${generateLabel}"`);
    expect(buttons.get(generateLabel)?.disabled).toBe(false);

    buttons.get(generateLabel)?.onClick?.();
    expect(onGenerateVideo).toHaveBeenCalledExactlyOnceWith('keyframe-1');
  });

  it('accepts an approved keyframe (same readiness as the server fn)', () => {
    const onGenerateVideo = vi.fn(async () => undefined);
    renderButton({ keyframeStatus: 'approved', onGenerateVideo });

    expect(buttons.get(generateLabel)?.disabled).toBe(false);
    buttons.get(generateLabel)?.onClick?.();
    expect(onGenerateVideo).toHaveBeenCalledExactlyOnceWith('keyframe-1');
  });

  it('is disabled while a clip holds an in-flight reservation', () => {
    for (const status of ['pending', 'queued', 'generating']) {
      const onGenerateVideo = vi.fn(async () => undefined);
      renderButton({ clips: [makeClip(status)], onGenerateVideo });

      expect(buttons.get(generateLabel)?.disabled).toBe(true);
      buttons.get(generateLabel)?.onClick?.();
      expect(onGenerateVideo).not.toHaveBeenCalled();
    }
  });

  it('is disabled while another generation is running', () => {
    const onGenerateVideo = vi.fn(async () => undefined);
    renderButton({ busy: true, onGenerateVideo });

    expect(buttons.get(generateLabel)?.disabled).toBe(true);
  });

  it('is disabled until the keyframe is ready, and absent without one', () => {
    const onGenerateVideo = vi.fn(async () => undefined);
    renderButton({ keyframeStatus: 'pending', onGenerateVideo });
    expect(buttons.get(generateLabel)?.disabled).toBe(true);

    const html = renderButton({ keyframeStatus: 'none', onGenerateVideo });
    expect(html).not.toContain(generateLabel);
    expect(buttons.get(generateLabel)).toBeUndefined();
  });

  it('stays available after a terminal failed clip (fresh paid attempt)', () => {
    const onGenerateVideo = vi.fn(async () => undefined);
    renderButton({ clips: [makeClip('failed')], onGenerateVideo });

    expect(buttons.get(generateLabel)?.disabled).toBe(false);
    buttons.get(generateLabel)?.onClick?.();
    expect(onGenerateVideo).toHaveBeenCalledExactlyOnceWith('keyframe-1');
  });

  it('plays a completed clip instead of offering a second generation', () => {
    const onGenerateVideo = vi.fn(async () => undefined);
    const onPlay = vi.fn();
    const url = '/r2/videos/team/story/clip/video.mp4';
    const html = renderButton({
      clips: [makeClip('completed', url)],
      onGenerateVideo,
      onPlay,
    });

    expect(html).toContain(`aria-label="${playLabel}"`);
    expect(buttons.get(playLabel)?.disabled).toBe(false);
    buttons.get(playLabel)?.onClick?.();
    expect(onPlay).toHaveBeenCalledExactlyOnceWith(url);
    expect(buttons.get(generateLabel)).toBeUndefined();
    expect(onGenerateVideo).not.toHaveBeenCalled();
  });
});
