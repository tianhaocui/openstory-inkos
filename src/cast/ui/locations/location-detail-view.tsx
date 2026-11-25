import { ActionCost } from '@/billing/ui/action-cost';
import { ImageModelSelector } from '@/models/ui/pickers/image-model-selector';
import { UploadMediaButton } from '@/shots/ui/upload-media-button';
import { SheetComparisonDialog } from '@/cast/ui/sheets/sheet-comparison-dialog';
import { SheetStalenessBanners } from '@/cast/ui/sheets/sheet-staleness-banners';
import { SheetVersionStrip } from '@/cast/ui/sheets/sheet-version-strip';
import { StalenessIndicator } from '@/shots/ui/staleness/staleness-indicator';
import { Button } from '@/ui/shadcn/button';
import { ScrollArea } from '@/ui/shadcn/scroll-area';
import { Skeleton } from '@/ui/shadcn/skeleton';
import { useUploadLocationReference } from '@/shots/ui/use-media-upload';
import {
  locationSheetVariantKeys,
  useDiscardSequenceLocationSheetVariant,
  useLocationSheetVersions,
  usePromoteSequenceLocationSheetVariant,
  useSelectLocationSheetVersion,
  useSequenceLocationDivergentVariants,
  useUndiscardSequenceLocationSheetVariant,
} from '@/cast/ui/use-location-sheet-variants';
import {
  restoreSequenceLocation,
  sequenceLocationKeys,
  type TeamLibraryLocation,
  useLocationSheetStaleness,
  useRegenerateLocationSheet,
  useShotIdsForLocation,
  useRecastLocation,
  useSequenceLocations,
  useSoftDeleteSequenceLocation,
} from '@/cast/ui/use-sequence-locations';
import type { LocationSheetVariant } from '@/platform/server/db/schema';
import { errorMessage } from '@/platform/errors';
import { useRealtime } from '@/platform/ui/realtime/client';
import { useSheetStaleDetected } from '@/cast/ui/use-sheet-stale-detected';
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
import { useFalPricing } from '@/billing/ui/use-fal-pricing';
import { useSequence } from '@/sequences/ui/use-sequences';
import type { TextToImageModel } from '@/models/models';
import { estimateImageCost } from '@/billing/cost-estimation';
import { resolveSheetImageModel } from '@/cast/sheet-image-model';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2, MapPin, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LocationBibleForm } from './location-bible-form';
import { LocationPickerDialog } from './location-picker-dialog';
import { LocationRecastConfirmDialog } from './location-recast-confirm-dialog';
import { AppImage } from '@/ui/shadcn/app-image';

type LocationDetailViewProps = {
  sequenceId: string;
  locationId: string;
};

export const LocationDetailView: React.FC<LocationDetailViewProps> = ({
  sequenceId,
  locationId,
}) => {
  const queryClient = useQueryClient();
  const {
    data: locations,
    isLoading,
    error,
  } = useSequenceLocations(sequenceId);
  const recastLocation = useRecastLocation();
  const regenerateSheet = useRegenerateLocationSheet();
  const { data: sequence } = useSequence(sequenceId);
  const [sheetModel, setSheetModel] = useState<TextToImageModel | null>(null);
  const { data: sheetStaleness } = useLocationSheetStaleness(
    sequenceId,
    locationId
  );
  const { data: versionHistory } = useLocationSheetVersions(
    sequenceId,
    locationId
  );
  const selectVersion = useSelectLocationSheetVersion();
  const { data: shotData } = useShotIdsForLocation(sequenceId, locationId);
  const navigate = useNavigate();
  const softDelete = useSoftDeleteSequenceLocation();
  const uploadReference = useUploadLocationReference();
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  // Soft-remove (#1108 Phase 2): navigate back to the locations list, leave a
  // 60s undo toast whose closure survives this component's unmount.
  const handleRemove = useCallback(
    (name: string) => {
      softDelete.mutate(
        { sequenceId, locationDbId: locationId },
        {
          onSuccess: () => {
            setIsRemoveConfirmOpen(false);
            void navigate({
              to: '/films/$id/locations',
              params: { id: sequenceId },
            });
            toast(`已移除 ${name}`, {
              duration: 60_000,
              action: {
                label: '撤销',
                onClick: () =>
                  void restoreSequenceLocation(queryClient, {
                    sequenceId,
                    locationDbId: locationId,
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
    },
    [softDelete, sequenceId, locationId, navigate, queryClient]
  );

  // Dialog states for recasting
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedLibraryLocation, setSelectedLibraryLocation] =
    useState<TeamLibraryLocation | null>(null);

  // Track regenerating state from realtime events
  const [isRegenerating, setIsRegenerating] = useState(false);
  // Set while a content-flag retry is in flight so the spinner says so
  // instead of reading as a hang; cleared with every non-retry event.
  const [retryLabel, setRetryLabel] = useState<string | null>(null);

  // Handle realtime events for location sheet progress
  const handleRealtimeEvent = useCallback(
    (event: { event: string; data: unknown }) => {
      if (event.event === 'generation.location-sheet:progress') {
        const data = event.data;
        if (
          !data ||
          typeof data !== 'object' ||
          !('locationId' in data) ||
          !('status' in data) ||
          typeof data.locationId !== 'string' ||
          (data.status !== 'generating' &&
            data.status !== 'completed' &&
            data.status !== 'failed')
        ) {
          return;
        }
        const payload = {
          locationId: data.locationId,
          status: data.status,
        };

        // Only handle events for this location
        if (payload.locationId !== locationId) return;

        if (payload.status === 'generating') {
          setIsRegenerating(true);
          setRetryLabel(
            !('phase' in data) || data.phase !== 'retrying'
              ? null
              : 'promptSoftened' in data && data.promptSoftened === true
                ? '正在使用重写的提示词重试…'
                : 'attempt' in data &&
                    'maxAttempts' in data &&
                    typeof data.attempt === 'number' &&
                    typeof data.maxAttempts === 'number'
                  ? `正在重试 (${data.attempt}/${data.maxAttempts})…`
                  : '正在重试…'
          );
        } else {
          setIsRegenerating(false);
          setRetryLabel(null);
          // Invalidate query to refetch updated location data
          void queryClient.invalidateQueries({
            queryKey: sequenceLocationKeys.list(sequenceId),
          });
        }
      }
    },
    [locationId, queryClient, sequenceId]
  );

  // Subscribe to realtime events
  useRealtime({
    channels: sequenceId ? [sequenceId] : [],
    events: ['generation.location-sheet:progress'] as const,
    onData: handleRealtimeEvent,
    enabled: !!sequenceId,
  });

  const { data: divergentVariants } =
    useSequenceLocationDivergentVariants(sequenceId);
  const invalidateDivergentKeys = useCallback(
    () => [locationSheetVariantKeys.divergentBySequence(sequenceId)],
    [sequenceId]
  );
  useSheetStaleDetected({
    channelId: sequenceId,
    entityTypes: ['location'],
    invalidateKeys: invalidateDivergentKeys,
  });
  const promoteVariant = usePromoteSequenceLocationSheetVariant();
  const discardVariant = useDiscardSequenceLocationSheetVariant();
  const undiscardVariant = useUndiscardSequenceLocationSheetVariant();
  const [compareVariant, setCompareVariant] =
    useState<LocationSheetVariant | null>(null);

  const locationDivergentVariant = useMemo(() => {
    if (!divergentVariants) return undefined;
    return divergentVariants.find((v) => v.parentId === locationId);
  }, [divergentVariants, locationId]);

  const handleDiscardWithUndo = useCallback(
    (variant: LocationSheetVariant) => {
      const restore = () =>
        undiscardVariant.mutate(
          { sequenceId, variantId: variant.id },
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
        { sequenceId, variantId: variant.id },
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
    [sequenceId, discardVariant, undiscardVariant]
  );

  const handlePromote = useCallback(
    (variant: LocationSheetVariant) => {
      promoteVariant.mutate(
        { sequenceId, variantId: variant.id },
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
    [sequenceId, promoteVariant]
  );

  const location = locations?.find((l) => l.id === locationId);

  // Determine if currently regenerating
  const isSheetGenerating =
    isRegenerating ||
    recastLocation.isPending ||
    regenerateSheet.isPending ||
    location?.referenceStatus === 'generating';
  const isSheetStale = sheetStaleness === 'stale';
  const hasPriorSheet = Boolean(
    location?.referenceGeneratedAt || location?.selectedReferenceVersionId
  );
  const sheetBusyLabel =
    retryLabel ??
    (hasPriorSheet ? '正在重新生成场景参考素材…' : '正在生成场景参考素材…');
  const selectedSheetModel = resolveSheetImageModel({
    explicit: sheetModel,
    liveVersionModel: (versionHistory?.versions ?? []).find(
      (row) =>
        row.id ===
        (versionHistory?.selectedReferenceVersionId ??
          location?.selectedReferenceVersionId)
    )?.model,
    sequenceImageModel: sequence?.imageModel ?? null,
  });
  const { pricing: falPricing } = useFalPricing();
  const sheetCostEstimate = useMemo(() => {
    if (!falPricing) return null;
    return estimateImageCost(selectedSheetModel, '16:9', 1, {
      pricing: falPricing,
      edit: Boolean(location?.libraryLocationId),
    });
  }, [falPricing, selectedSheetModel, location?.libraryLocationId]);

  const handleRegenerateSheet = useCallback(() => {
    regenerateSheet.mutate(
      {
        sequenceId,
        locationDbId: locationId,
        ...(sheetModel ? { imageModel: sheetModel } : {}),
      },
      {
        onError: (error) =>
          toast.error('重新生成参考素材失败', {
            description: errorMessage(error),
          }),
      }
    );
  }, [regenerateSheet, sequenceId, locationId, sheetModel]);

  // Handle library location selection from picker
  const handleLibraryLocationSelect = (
    libraryLocation: TeamLibraryLocation
  ) => {
    setSelectedLibraryLocation(libraryLocation);
    setIsConfirmOpen(true);
  };

  // Handle recast confirmation
  const handleRecastConfirm = () => {
    if (!selectedLibraryLocation || !location?.referenceImageUrl) return;

    recastLocation.mutate(
      {
        locationId: location.id,
        libraryLocationId: selectedLibraryLocation.id,
        referenceImageUrl: selectedLibraryLocation.referenceImageUrl ?? '',
        description: selectedLibraryLocation.description ?? undefined,
      },
      {
        onSuccess: () => {
          setIsConfirmOpen(false);
          setSelectedLibraryLocation(null);
        },
      }
    );
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-destructive">加载场景失败</p>
          <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b p-4">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <MapPin className="h-16 w-16 text-muted-foreground/30" />
        <div className="text-center">
          <p className="text-sm font-medium">未找到场景</p>
          <Link
            to="/films/$id/locations"
            params={{ id: sequenceId }}
            className="mt-2 text-sm text-primary hover:underline"
          >
            返回场景列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header with back button */}
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <Link
          to="/films/$id/locations"
          params={{ id: sequenceId }}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">{location.name}</h1>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-6 p-4">
          <SheetStalenessBanners
            entityType="location"
            divergentVariantId={locationDivergentVariant?.id}
            isStale={isSheetStale}
            onRegenerate={handleRegenerateSheet}
            onCompareDivergent={
              locationDivergentVariant
                ? () => setCompareVariant(locationDivergentVariant)
                : undefined
            }
            onPromoteDivergent={
              locationDivergentVariant
                ? () => handlePromote(locationDivergentVariant)
                : undefined
            }
            onDiscardDivergent={
              locationDivergentVariant
                ? () => handleDiscardWithUndo(locationDivergentVariant)
                : undefined
            }
          />

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">参考素材</p>
                {isSheetStale && (
                  <StalenessIndicator
                    artifact="sheet"
                    entityType="location"
                    density="header-chip"
                    isRegenerating={regenerateSheet.isPending}
                    onRegenerate={handleRegenerateSheet}
                  />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  {location.referenceImageUrl ? (
                    <AppImage
                      src={location.referenceImageUrl}
                      alt={location.name}
                      width={640}
                      height={360}
                      className="h-full w-full object-cover"
                    />
                  ) : isSheetGenerating ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {sheetBusyLabel}
                      </p>
                    </div>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                      <MapPin className="h-16 w-16 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground">
                        暂无参考素材
                      </p>
                    </div>
                  )}
                  {isSheetGenerating && location.referenceImageUrl ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {sheetBusyLabel}
                      </p>
                    </div>
                  ) : null}
                </div>
                <SheetVersionStrip
                  label="版本"
                  selectingId={
                    selectVersion.isPending
                      ? selectVersion.variables.versionId
                      : null
                  }
                  onSelect={(versionId) =>
                    selectVersion.mutate(
                      { sequenceId, locationDbId: locationId, versionId },
                      {
                        onError: (error) =>
                          toast.error('切换参考素材失败', {
                            description: errorMessage(error),
                          }),
                      }
                    )
                  }
                  versions={(versionHistory?.versions ?? []).map((row) => ({
                    id: row.id,
                    url: row.url,
                    selected:
                      row.id ===
                      (versionHistory?.selectedReferenceVersionId ??
                        location.selectedReferenceVersionId),
                  }))}
                />
              </div>

              <ImageModelSelector
                selectedModel={selectedSheetModel}
                onModelChange={setSheetModel}
                disabled={regenerateSheet.isPending || isSheetGenerating}
              />
              <p className="text-xs text-muted-foreground">
                用于此场景的参考素材。镜头静帧仍使用序列图像模型。
              </p>
              <div className="flex w-fit flex-col gap-1">
                <Button
                  onClick={handleRegenerateSheet}
                  disabled={regenerateSheet.isPending}
                >
                  {regenerateSheet.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {regenerateSheet.isPending
                    ? hasPriorSheet
                      ? '正在重新生成…'
                      : '正在生成…'
                    : hasPriorSheet
                      ? isSheetGenerating
                        ? '再次生成'
                        : '重新生成参考素材'
                      : '生成参考素材'}
                </Button>
                <ActionCost estimate={sheetCostEstimate} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsPickerOpen(true)}
                  disabled={isSheetGenerating}
                >
                  从场景库替换
                </Button>
                <UploadMediaButton
                  label="上传参考素材"
                  pendingLabel="正在上传…"
                  accept="image/*"
                  isPending={uploadReference.isPending}
                  disabled={isSheetGenerating}
                  onFile={(file) =>
                    uploadReference.mutate(
                      { file, sequenceId, locationDbId: locationId },
                      {
                        onSuccess: () => toast.success('场景参考素材已上传'),
                        onError: (error) =>
                          toast.error('参考素材上传失败', {
                            description: errorMessage(error),
                          }),
                      }
                    )
                  }
                />
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setIsRemoveConfirmOpen(true)}
                  disabled={softDelete.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {softDelete.isPending ? '正在移除…' : '移除'}
                </Button>
              </div>

              {shotData && shotData.count > 0 && (
                <p className="text-sm text-muted-foreground">
                  用于 {shotData.count} 个镜头
                </p>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <LocationBibleForm
                key={location.id}
                sequenceId={sequenceId}
                location={location}
              />
              {location.firstMentionSceneId && (
                <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    首次出现
                  </p>
                  <p className="text-sm">
                    {`场景 ${location.firstMentionSceneId}${
                      location.firstMentionLine
                        ? `，第 ${location.firstMentionLine} 行`
                        : ''
                    }`}
                  </p>
                  {location.firstMentionText && (
                    <p className="border-l-2 border-muted-foreground/30 pl-3 text-xs italic text-muted-foreground">
                      "{location.firstMentionText}"
                    </p>
                  )}
                </div>
              )}
              {location.consistencyTag && (
                <span className="w-fit rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                  {location.consistencyTag}
                </span>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <AlertDialog
        open={isRemoveConfirmOpen}
        onOpenChange={setIsRemoveConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              从此序列中移除 {location.name}？
            </AlertDialogTitle>
            <AlertDialogDescription>
              此场景将从序列和提示词上下文中隐藏。移除后可立即通过通知撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={softDelete.isPending}
              onClick={() => handleRemove(location.name)}
            >
              {softDelete.isPending ? '正在移除…' : '移除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LocationPickerDialog
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handleLibraryLocationSelect}
        excludeLocationId={locationId}
      />

      {selectedLibraryLocation && (
        <LocationRecastConfirmDialog
          open={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          onConfirm={handleRecastConfirm}
          locationName={location.name}
          libraryLocationName={selectedLibraryLocation.name}
          affectedShotCount={shotData?.count ?? 0}
          isLoading={recastLocation.isPending}
        />
      )}

      {compareVariant && (
        <SheetComparisonDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setCompareVariant(null);
          }}
          entityType="location"
          livePrimaryUrl={location.referenceImageUrl}
          variantUrl={compareVariant.url}
          variantId={compareVariant.id}
          onPromote={() => handlePromote(compareVariant)}
          onDiscard={() => handleDiscardWithUndo(compareVariant)}
          isPromoting={promoteVariant.isPending}
          isDiscarding={discardVariant.isPending}
        />
      )}
    </div>
  );
};
