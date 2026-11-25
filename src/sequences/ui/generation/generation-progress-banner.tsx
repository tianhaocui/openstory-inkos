import { type BannerPhase, ProgressBanner } from './progress-banner';
import {
  estimateSceneCount,
  estimateTotalSeconds,
} from '@/sequences/time-estimate';
import type { GenerationStreamState } from '@/sequences/ui/generation-stream.reducer';
import { useEffect, useRef, useState } from 'react';

/**
 * User-friendly descriptions for each generation phase.
 */

const PHASE_DESCRIPTIONS: Record<number, string> = {
  1: '正在拆分剧本并匹配演员、场景与元素',
  2: '正在生成参考图并编写图片提示词',
  3: '正在生成图片并编写动态与音乐提示词',
  4: '正在生成动态视频和音乐',
};

type GenerationProgressBannerProps = {
  generationState: GenerationStreamState;
  isProcessing: boolean;
  startedAt?: Date;
  script?: string;
  /** When set, used instead of the banner's own elapsed-based remaining. */
  remainingSeconds?: number;
  analysisModel?: string | null;
  imageModel?: string | null;
  videoModel?: string | null;
  musicModel?: string | null;
  /** Show the ready-email promise in the leave hint. */
  willEmail?: boolean;
};

export const GenerationProgressBanner: React.FC<
  GenerationProgressBannerProps
> = ({
  generationState,
  isProcessing,
  startedAt,
  script,
  remainingSeconds,
  analysisModel,
  imageModel,
  videoModel,
  musicModel,
  willEmail = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(startedAt?.getTime() ?? Date.now());

  // Tick elapsed time every second (initial call avoids 1s blank after hydration)
  useEffect(() => {
    const tick = () =>
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Don't render before generation starts or after exit
  if (!isProcessing && generationState.currentPhase === 0) return null;

  const phase1Completed = generationState.phases[0]?.status === 'completed';
  const sceneCount = phase1Completed ? generationState.scenes.length : 0;
  const estimatedSceneCount = script ? estimateSceneCount(script) : undefined;
  const remaining =
    remainingSeconds ??
    Math.max(
      0,
      estimateTotalSeconds(
        sceneCount,
        estimatedSceneCount,
        generationState.phases.length,
        { analysisModel, imageModel, videoModel, musicModel }
      ) - elapsedSeconds
    );

  const bannerPhases: BannerPhase[] = generationState.phases.map((phase) => ({
    key: String(phase.phase),
    name: phase.phaseName,
    shortName: phase.shortName,
    status: phase.status,
    description:
      phase.status === 'active' ? PHASE_DESCRIPTIONS[phase.phase] : undefined,
  }));

  return (
    <ProgressBanner
      phases={bannerPhases}
      remaining={remaining}
      // Parent mounts this only while status is processing. A leftover or
      // replayed COMPLETE must not self-unmount the chip (#1641).
      isComplete={generationState.isComplete && !isProcessing}
      defaultLabel="正在生成序列"
      ariaPrefix="生成"
      exitDelayMs={0}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      leaveHint={willEmail ? <>完成后我们会通过电子邮件通知你。</> : undefined}
    />
  );
};
