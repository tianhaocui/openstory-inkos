import { Button } from '@/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/shadcn/dialog';
import type { StalenessEntityType } from '@/shots/ui/staleness/staleness-indicator';
import { cn } from '@/ui/utils';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppImage } from '@/ui/shadcn/app-image';

type SheetAspectRatio = 'square' | 'video' | 'portrait';

type SheetEntityType = Exclude<StalenessEntityType, 'shot' | 'sequence'>;

type SheetComparisonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: SheetEntityType;
  /** Live primary image URL (`null` when no live primary exists yet). */
  livePrimaryUrl: string | null;
  /** The divergent variant's image URL. Promote will move this into the live slot. */
  variantUrl: string | null;
  /** Stable id for the focused variant — passed back to onPromote/onDiscard. */
  variantId: string;
  onPromote: () => void;
  onDiscard: () => void;
  isPromoting?: boolean;
  isDiscarding?: boolean;
  /**
   * Visual aspect for the side-by-side previews. Defaults are derived from
   * `entityType`: characters/talent → square, locations → 16:9 video.
   */
  aspectRatio?: SheetAspectRatio;
  /**
   * Optional list of upstream entity changes between the snapshot and live
   * inputs. Stage 2 surfaces this as a flat string list; field-level diffs
   * land in stage 4. Mirrors `DivergenceCompareDialog.upstreamChanges`.
   */
  upstreamChanges?: string[];
};

const ENTITY_LABEL: Record<SheetEntityType, string> = {
  character: '角色设定图',
  location: '场景参考素材',
  'library-location': '场景参考素材',
  talent: '演员设定图',
};

const ASPECT_CLASS: Record<SheetAspectRatio, string> = {
  square: 'aspect-square',
  video: 'aspect-video',
  portrait: 'aspect-[3/4]',
};

function defaultAspectFor(entityType: SheetEntityType): SheetAspectRatio {
  switch (entityType) {
    case 'character':
    case 'talent':
      // Sheets surface as portrait/square headshots in the existing UI.
      return 'square';
    case 'location':
    case 'library-location':
      return 'video';
  }
}

const SheetPreview: React.FC<{
  url: string | null;
  alt: string;
  aspectClass: string;
}> = ({ url, alt, aspectClass }) => {
  if (!url) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-xs text-muted-foreground',
          aspectClass
        )}
      >
        暂无素材
      </div>
    );
  }
  return (
    // Compare-dialog is a transient surface; the unpic optimisation pipeline
    // adds little here and the variant URL may already be a CDN-resized one.
    // Plain img keeps this simple and aligns with `DivergenceCompareDialog`.
    <AppImage
      src={url}
      alt={alt}
      width={160}
      height={160}
      className={cn('w-full rounded-md object-cover', aspectClass)}
    />
  );
};

/**
 * Sheet-shaped sibling of `DivergenceCompareDialog`. Same two-click promote
 * confirmation, same two-column live/alternate preview, but supports the
 * portrait sheet aspect ratios (vs. the shot dialog's hard-coded 16:9 video).
 */
export const SheetComparisonDialog: React.FC<SheetComparisonDialogProps> = ({
  open,
  onOpenChange,
  entityType,
  livePrimaryUrl,
  variantUrl,
  variantId,
  onPromote,
  onDiscard,
  isPromoting = false,
  isDiscarding = false,
  aspectRatio,
  upstreamChanges,
}) => {
  const label = ENTITY_LABEL[entityType];
  const aspectClass = ASPECT_CLASS[aspectRatio ?? defaultAspectFor(entityType)];
  const busy = isPromoting || isDiscarding;

  // Two-click confirm — promote replaces the live primary irreversibly.
  // Mirrors `DivergenceCompareDialog`. Reset whenever the dialog opens or
  // the variant swaps so a fresh open doesn't start mid-confirm.
  const [confirmingPromote, setConfirmingPromote] = useState(false);
  useEffect(() => {
    setConfirmingPromote(false);
  }, [open, variantId]);

  const handlePromoteClick = () => {
    if (confirmingPromote) {
      onPromote();
      setConfirmingPromote(false);
      return;
    }
    setConfirmingPromote(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>比较备选{label}</DialogTitle>
          <DialogDescription>
            此备选{label}
            基于当时的输入生成。请与当前版本比较，然后选择提升或丢弃。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">当前版本（当前输入）</span>
            <SheetPreview
              url={livePrimaryUrl}
              alt={`当前${label}`}
              aspectClass={aspectClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">备选版本（旧输入）</span>
            <SheetPreview
              url={variantUrl}
              alt={`备选${label}`}
              aspectClass={aspectClass}
            />
          </div>
        </div>

        {upstreamChanges && upstreamChanges.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
            <span className="text-sm font-medium">更改内容</span>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {upstreamChanges.map((change) => (
                <li key={change}>• {change}</li>
              ))}
            </ul>
          </div>
        )}

        {confirmingPromote && (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
            aria-live="polite"
          >
            提升操作将替换当前{label}。请再次点击“提升”以确认。
          </div>
        )}

        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onDiscard}
            disabled={busy}
          >
            {isDiscarding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <span>丢弃</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handlePromoteClick}
            disabled={busy}
            variant={confirmingPromote ? 'destructive' : 'default'}
          >
            {isPromoting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmingPromote ? '确认提升' : '提升'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
