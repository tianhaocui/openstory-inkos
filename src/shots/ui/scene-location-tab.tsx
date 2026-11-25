/**
 * Scene Location Tab
 * Displays the location for the current shot with reference image and details
 */

import { AddLocationDialog } from './add-location-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/shadcn/alert-dialog';
import { Button } from '@/ui/shadcn/button';
import { Skeleton } from '@/ui/shadcn/skeleton';
import { facetIdsForShots, useSceneFacetMaps } from './use-scene-facets';
import {
  restoreSequenceLocation,
  useSequenceLocations,
  useSoftDeleteSequenceLocation,
  type SequenceLocationWithReference,
} from '@/cast/ui/use-sequence-locations';
import { errorMessage } from '@/platform/errors';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ExternalLink, MapPin, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppImage } from '@/ui/shadcn/app-image';

type SceneLocationTabProps = {
  sequenceId: string;
  /** Shots in the current selection. `null` = whole sequence (show all). */
  shotIds: string[] | null;
};

type DetailRowProps = {
  label: string;
  value: string | null | undefined;
};

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => {
  if (!value) return null;

  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed">{value}</dd>
    </div>
  );
};

export const SceneLocationTab: React.FC<SceneLocationTabProps> = ({
  sequenceId,
  shotIds,
}) => {
  const { data: locations, isLoading } = useSequenceLocations(sequenceId);
  const { data: facetMaps } = useSceneFacetMaps(sequenceId);
  const queryClient = useQueryClient();
  const softDelete = useSoftDeleteSequenceLocation();
  const [pendingDelete, setPendingDelete] =
    useState<SequenceLocationWithReference | null>(null);

  const handleConfirmDelete = (location: SequenceLocationWithReference) => {
    softDelete.mutate(
      { sequenceId, locationDbId: location.id },
      {
        onSuccess: () => {
          setPendingDelete(null);
          toast(`已移除 ${location.name}`, {
            duration: 60_000,
            action: {
              label: '撤销',
              onClick: () =>
                void restoreSequenceLocation(queryClient, {
                  sequenceId,
                  locationDbId: location.id,
                }).catch((error: Error) =>
                  toast.error('恢复场景失败', {
                    description: errorMessage(error),
                  })
                ),
            },
          });
        },
        onError: (error) =>
          toast.error('移除场景失败', {
            description: errorMessage(error),
          }),
      }
    );
  };

  // Membership is resolved server-side (same match the render path uses); the
  // selection is applied here as a set lookup, not a re-derivation.
  const scopedIds = facetIdsForShots(facetMaps?.locationIdsByShot, shotIds);
  const scopedLocations = !locations
    ? []
    : scopedIds === null
      ? locations
      : locations.filter((l) => scopedIds.has(l.id));

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="aspect-video w-full rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  // Add is only offered unscoped — see the cast tab twin: a location belongs
  // to the SEQUENCE, and this list is filtered by what the selected shots
  // reference, so a newly added one would not show up here.
  const canAdd = shotIds === null;

  if (scopedLocations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <MapPin className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">
          {canAdd ? '暂无场景' : '当前选择中没有场景，清除选择后可添加'}
        </p>
        {canAdd && <AddLocationDialog sequenceId={sequenceId} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <span>{canAdd ? '全部场景' : '场景'}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>{scopedLocations.length}</span>
        </div>
        {canAdd && <AddLocationDialog sequenceId={sequenceId} />}
      </div>

      {scopedLocations.map((shotLocation) => (
        <div key={shotLocation.id} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span>{shotLocation.name}</span>
              {shotLocation.type && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span>
                    {shotLocation.type === 'interior'
                      ? '内景'
                      : shotLocation.type === 'exterior'
                        ? '外景'
                        : '内外景'}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Link
                to="/sequences/$id/locations/$locationId"
                params={{ id: sequenceId, locationId: shotLocation.id }}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                查看详情
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`从序列中移除 ${shotLocation.name}`}
                onClick={() => setPendingDelete(shotLocation)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
            {shotLocation.referenceImageUrl ? (
              <AppImage
                src={shotLocation.referenceImageUrl}
                alt={shotLocation.name}
                width={160}
                height={160}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                <MapPin className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground">
                  {shotLocation.referenceStatus === 'generating'
                    ? '正在生成参考图…'
                    : '无参考图'}
                </p>
              </div>
            )}
            {shotLocation.type && shotLocation.referenceImageUrl && (
              <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                {shotLocation.type === 'interior'
                  ? 'INT'
                  : shotLocation.type === 'exterior'
                    ? 'EXT'
                    : 'INT/EXT'}
              </div>
            )}
          </div>

          <dl className="space-y-3">
            <DetailRow label="描述" value={shotLocation.description} />
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="时段" value={shotLocation.timeOfDay} />
              <DetailRow
                label="建筑风格"
                value={shotLocation.architecturalStyle}
              />
            </div>
            <DetailRow label="主要特征" value={shotLocation.keyFeatures} />
            {shotLocation.consistencyTag && (
              <div className="pt-2">
                <span className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                  {shotLocation.consistencyTag}
                </span>
              </div>
            )}
          </dl>
        </div>
      ))}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              从当前序列中移除 {pendingDelete?.name}？
            </AlertDialogTitle>
            <AlertDialogDescription>
              该场景将从序列和提示词上下文中隐藏。移除后可立即在通知中撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={softDelete.isPending}
              // Radix's Action closes on click; hold it open so the pending
              // state is reachable — `onSuccess` clears `pendingDelete`.
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) handleConfirmDelete(pendingDelete);
              }}
            >
              {softDelete.isPending ? '移除中…' : '移除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
