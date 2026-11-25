import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/ui/shadcn/alert';
import { Button } from '@/ui/shadcn/button';
import { cn } from '@/ui/utils';
import type {
  StalenessArtifact,
  StalenessEntityType,
  BannerDensity,
} from './staleness-indicator';

type DivergentAlternateBannerProps = {
  variantId: string;
  artifact: StalenessArtifact;
  entityType: StalenessEntityType;
  /** Render a Compare button (inline) / make the dot clickable (corner-dot). */
  onCompare?: () => void;
  /** Inline-only: promote button is rendered only when this is provided. */
  onPromote?: () => void;
  /** Inline-only: discard button is rendered only when this is provided. */
  onDiscard?: () => void;
  density?: BannerDensity;
  className?: string;
};

const ARTIFACT_LABEL: Record<StalenessArtifact, string> = {
  thumbnail: '图片',
  video: '视频',
  audio: '音频',
  sheet: '设定图',
  'visual-prompt': '图片提示词',
  'motion-prompt': '动态提示词',
  'music-prompt': '音乐提示词',
  music: '音乐',
};

export const DivergentAlternateBanner: React.FC<
  DivergentAlternateBannerProps
> = ({
  variantId,
  artifact,
  entityType,
  onCompare,
  onPromote,
  onDiscard,
  density = 'inline',
  className,
}) => {
  const ariaLabel = `此项目有可用的备用版本${ARTIFACT_LABEL[artifact]}`;

  if (density === 'corner-dot') {
    return (
      <button
        type="button"
        onClick={onCompare}
        aria-label={ariaLabel}
        title="有可用的备用版本，点击比较"
        data-slot="divergent-alternate-dot"
        data-variant-id={variantId}
        data-artifact={artifact}
        data-entity-type={entityType}
        className={cn(
          'group relative inline-flex h-6 w-6 items-center justify-center rounded-full',
          'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className
        )}
      >
        <span
          aria-hidden="true"
          className="block h-2 w-2 rounded-full bg-sky-500 ring-2 ring-sky-500/30 transition-transform group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </button>
    );
  }

  return (
    <Alert
      aria-live="polite"
      data-slot="divergent-alternate-banner"
      data-density="inline"
      data-variant-id={variantId}
      data-artifact={artifact}
      data-entity-type={entityType}
      className={className}
    >
      <Info aria-hidden="true" />
      <AlertTitle>有可用的备用版本</AlertTitle>
      <AlertDescription>
        此备用版本{ARTIFACT_LABEL[artifact]}基于当时的输入生成。
      </AlertDescription>
      <div className="col-start-2 mt-2 flex flex-wrap items-center gap-2">
        {onCompare && (
          <Button type="button" size="sm" variant="outline" onClick={onCompare}>
            比较
          </Button>
        )}
        {onPromote && (
          <Button type="button" size="sm" onClick={onPromote}>
            采用
          </Button>
        )}
        {onDiscard && (
          <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
            丢弃
          </Button>
        )}
      </div>
    </Alert>
  );
};
