import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SheetComparisonDialog } from '@/cast/ui/sheets/sheet-comparison-dialog';
import { SheetStalenessBanners } from '@/cast/ui/sheets/sheet-staleness-banners';
import { Button } from '@/ui/shadcn/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/shadcn/dialog';
import { Input } from '@/ui/shadcn/input';
import { Label } from '@/ui/shadcn/label';
import { Textarea } from '@/ui/shadcn/textarea';
import {
  libraryLocationSheetVariantKeys,
  useDiscardLibraryLocationSheetVariant,
  useLibraryLocationDivergentVariants,
  usePromoteLibraryLocationSheetVariant,
  useUndiscardLibraryLocationSheetVariant,
} from '@/cast/ui/use-library-location-sheet-variants';
import {
  useUpdateLibraryLocation,
  type LibraryLocationWithSheets,
} from '@/cast/ui/use-location-library';
import type { LocationSheetVariant } from '@/platform/server/db/schema';
import { useSheetStaleDetected } from '@/cast/ui/use-sheet-stale-detected';

type EditLocationDialogProps = {
  location: LibraryLocationWithSheets;
  trigger?: React.ReactNode;
};

export const EditLocationDialog: React.FC<EditLocationDialogProps> = ({
  location,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const updateLocation = useUpdateLibraryLocation();

  const { data: divergentVariants } = useLibraryLocationDivergentVariants();
  const invalidateDivergentKeys = useCallback(
    () => [libraryLocationSheetVariantKeys.divergent()],
    []
  );
  useSheetStaleDetected({
    channelId: open ? `location:${location.id}` : undefined,
    entityTypes: ['library-location'],
    invalidateKeys: invalidateDivergentKeys,
  });
  const promoteVariant = usePromoteLibraryLocationSheetVariant();
  const discardVariant = useDiscardLibraryLocationSheetVariant();
  const undiscardVariant = useUndiscardLibraryLocationSheetVariant();
  const [compareVariant, setCompareVariant] =
    useState<LocationSheetVariant | null>(null);

  const focusVariant = useMemo(() => {
    if (!divergentVariants) return undefined;
    return divergentVariants.find((v) => v.parentId === location.id);
  }, [divergentVariants, location.id]);

  const handleDiscardWithUndo = useCallback(
    (variant: LocationSheetVariant) => {
      const restore = () =>
        undiscardVariant.mutate(
          { variantId: variant.id },
          {
            onSuccess: () => toast.success('备选版本已恢复'),
            onError: (error) => {
              toast.error('恢复备选版本失败', {
                description:
                  error instanceof Error ? error.message : '未知错误',
              });
            },
          }
        );
      discardVariant.mutate(
        { variantId: variant.id },
        {
          onSuccess: () => {
            setCompareVariant(null);
            toast('备选版本已丢弃', {
              action: { label: '撤销', onClick: restore },
            });
          },
          onError: (error) => {
            toast.error('丢弃备选版本失败', {
              description: error instanceof Error ? error.message : '未知错误',
            });
          },
        }
      );
    },
    [discardVariant, undiscardVariant]
  );

  const handlePromote = useCallback(
    (variant: LocationSheetVariant) => {
      promoteVariant.mutate(
        { variantId: variant.id },
        {
          onSuccess: () => {
            setCompareVariant(null);
            toast.success('备选版本已提升为当前版本');
          },
          onError: (error) => {
            toast.error('提升备选版本失败', {
              description: error instanceof Error ? error.message : '未知错误',
            });
          },
        }
      );
    },
    [promoteVariant]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nameValue = formData.get('name');
    const descriptionValue = formData.get('description');

    const name = typeof nameValue === 'string' ? nameValue : '';
    const description =
      typeof descriptionValue === 'string' ? descriptionValue : '';

    if (!name.trim()) return;

    updateLocation.mutate(
      {
        locationId: location.id,
        name: name.trim(),
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => setOpen(false),
      }
    );
  };

  const isPending = updateLocation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>编辑场景</DialogTitle>
            <DialogDescription>更新场景详细信息。</DialogDescription>
          </DialogHeader>

          {focusVariant && (
            <SheetStalenessBanners
              entityType="library-location"
              divergentVariantId={focusVariant.id}
              onCompareDivergent={() => setCompareVariant(focusVariant)}
              onPromoteDivergent={() => handlePromote(focusVariant)}
              onDiscardDivergent={() => handleDiscardWithUndo(focusVariant)}
            />
          )}

          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                name="name"
                defaultValue={location.name}
                autoComplete="off"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={location.description ?? ''}
                placeholder="描述场景的视觉细节…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? '正在保存…' : '保存更改'}
            </Button>
          </DialogFooter>
        </form>

        {compareVariant && (
          <SheetComparisonDialog
            open={true}
            onOpenChange={(o) => {
              if (!o) setCompareVariant(null);
            }}
            entityType="library-location"
            livePrimaryUrl={location.referenceImageUrl}
            variantUrl={compareVariant.url}
            variantId={compareVariant.id}
            onPromote={() => handlePromote(compareVariant)}
            onDiscard={() => handleDiscardWithUndo(compareVariant)}
            isPromoting={promoteVariant.isPending}
            isDiscarding={discardVariant.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
