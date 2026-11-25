import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BibleField } from '@/cast/ui/bible-field';
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
  talentSheetVariantKeys,
  useDiscardTalentSheetVariant,
  usePromoteTalentSheetVariant,
  useTalentDivergentVariants,
  useUndiscardTalentSheetVariant,
} from '@/cast/ui/use-talent-sheet-variants';
import {
  useAnalyzeTalentMedia,
  useUpdateTalent,
  useDeleteTalentMedia,
} from '@/cast/ui/use-talent';
import { useSheetStaleDetected } from '@/cast/ui/use-sheet-stale-detected';
import { AddTalentMediaDialog } from './add-talent-media-dialog';
import type {
  Talent,
  TalentMediaRecord,
  TalentSheet,
  TalentSheetVariant,
} from '@/platform/server/db/schema';
import { Pencil, Plus, Sparkles, X } from 'lucide-react';
import { AppImage } from '@/ui/shadcn/app-image';

type TalentWithRelations = Talent & {
  sheets: TalentSheet[];
  media: TalentMediaRecord[];
};

type EditTalentDialogProps = {
  talent: TalentWithRelations;
  trigger?: React.ReactNode;
};

export const EditTalentDialog: React.FC<EditTalentDialogProps> = ({
  talent,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(talent.description ?? '');

  const updateTalent = useUpdateTalent();
  const deleteMedia = useDeleteTalentMedia();
  const analyzeMedia = useAnalyzeTalentMedia();

  const { data: divergentVariants } = useTalentDivergentVariants(
    open ? talent.id : undefined
  );
  const invalidateDivergentKeys = useCallback(
    () => [talentSheetVariantKeys.divergentByTalent(talent.id)],
    [talent.id]
  );
  useSheetStaleDetected({
    channelId: open ? `talent:${talent.id}` : undefined,
    entityTypes: ['talent'],
    invalidateKeys: invalidateDivergentKeys,
  });
  const promoteVariant = usePromoteTalentSheetVariant();
  const discardVariant = useDiscardTalentSheetVariant();
  const undiscardVariant = useUndiscardTalentSheetVariant();
  const [compareVariant, setCompareVariant] =
    useState<TalentSheetVariant | null>(null);

  // Pick the most relevant divergent variant for the banner: oldest active
  // entry across this talent's sheets (matches the listing order).
  const focusVariant = useMemo(
    () => divergentVariants?.[0],
    [divergentVariants]
  );

  // Live primary url for the focused variant — `talent_sheets.imageUrl` of
  // the parent sheet. Match by id rather than picking the default sheet so
  // the dialog compares against the correct primary slot.
  const focusVariantLiveUrl = useMemo(() => {
    if (!compareVariant) return null;
    const sheet = talent.sheets.find(
      (s) => s.id === compareVariant.talentSheetId
    );
    return sheet?.imageUrl ?? null;
  }, [compareVariant, talent.sheets]);

  const handleDiscardWithUndo = useCallback(
    (variant: TalentSheetVariant) => {
      const restore = () =>
        undiscardVariant.mutate(
          { variantId: variant.id, talentId: talent.id },
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
        { variantId: variant.id, talentId: talent.id },
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
    [discardVariant, undiscardVariant, talent.id]
  );

  const handlePromote = useCallback(
    (variant: TalentSheetVariant) => {
      promoteVariant.mutate(
        { variantId: variant.id, talentId: talent.id },
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
    [promoteVariant, talent.id]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const text = (key: string) => {
      const value = formData.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };

    const name = text('name');
    if (!name) return;

    updateTalent.mutate(
      {
        talentId: talent.id,
        name,
        description: text('description') || undefined,
        // null clears the column; `''` would store an empty string.
        personality: text('personality') || null,
        movement: text('movement') || null,
      },
      {
        onSuccess: () => setOpen(false),
      }
    );
  };

  const handleDeleteMedia = async (mediaId: string) => {
    await deleteMedia.mutateAsync({
      mediaId,
      talentId: talent.id,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDescription(talent.description ?? '');
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="icon" aria-label="编辑演员">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>编辑演员</DialogTitle>
            <DialogDescription>更新演员详细信息和参考素材。</DialogDescription>
          </DialogHeader>

          {focusVariant && (
            <SheetStalenessBanners
              entityType="talent"
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
                defaultValue={talent.name}
                placeholder="演员名称…"
                autoComplete="off"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="description">描述</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={
                    talent.media.filter((m) => m.type === 'image').length ===
                      0 || analyzeMedia.isPending
                  }
                  onClick={() => {
                    const urls = talent.media
                      .filter((m) => m.type === 'image')
                      .map((m) => m.url)
                      .slice(0, 8);
                    analyzeMedia.mutate(
                      { imageUrls: urls },
                      {
                        onSuccess: (result) => {
                          setDescription(result.description);
                          toast.success('已根据照片生成描述');
                        },
                        onError: (error) => {
                          toast.error('无法生成描述', {
                            description:
                              error instanceof Error
                                ? error.message
                                : '未知错误',
                          });
                        },
                      }
                    );
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  {analyzeMedia.isPending ? '正在生成…' : '根据照片生成'}
                </Button>
              </div>
              <Textarea
                id="description"
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="描述演员的外貌和风格…"
                rows={3}
              />
            </div>

            <BibleField
              idPrefix="talent"
              label="性格"
              name="personality"
              defaultValue={talent.personality}
              textarea
            />
            <BibleField
              idPrefix="talent"
              label="肢体动作"
              name="movement"
              defaultValue={talent.movement}
              textarea
            />

            <div className="flex flex-col gap-2">
              <Label>参考素材</Label>
              {talent.media.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {talent.media.map((media) => (
                    <div
                      key={media.id}
                      className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
                    >
                      {media.type === 'video' ? (
                        <video
                          src={media.url}
                          className="size-full object-cover"
                          muted
                        />
                      ) : (
                        <AppImage
                          src={media.url}
                          alt="参考素材"
                          width={160}
                          height={160}
                          className="size-full object-cover"
                        />
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => void handleDeleteMedia(media.id)}
                        disabled={deleteMedia.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  暂未上传参考素材。
                </p>
              )}
              <AddTalentMediaDialog
                talentId={talent.id}
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    添加素材
                  </Button>
                }
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button type="submit" disabled={updateTalent.isPending}>
              {updateTalent.isPending ? '正在保存…' : '保存更改'}
            </Button>
          </DialogFooter>
        </form>

        {compareVariant && (
          <SheetComparisonDialog
            open={true}
            onOpenChange={(o) => {
              if (!o) setCompareVariant(null);
            }}
            entityType="talent"
            livePrimaryUrl={focusVariantLiveUrl}
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
