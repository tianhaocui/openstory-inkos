/**
 * 影视制作面板 — 分镜、资产、关键帧、视频生成
 */

import { useState } from 'react';
import { Button } from '@/ui/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/shadcn/card';
import { Badge } from '@/ui/shadcn/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/shadcn/tabs';
import { ScrollArea } from '@/ui/shadcn/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/shadcn/dialog';
import {
  Loader2Icon,
  FilmIcon,
  ImageIcon,
  VideoIcon,
  UserIcon,
  MapPinIcon,
  SparklesIcon,
  PlayIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { GenerationStateBanner } from '@/ui/generation-state-banner';
import { MediaThumbnail } from '@/ui/media-thumbnail';
import { PipelineProgress, type PipelineStage } from '@/ui/pipeline-progress';
import { ShotActionButton, shotActionToastId } from '@/ui/shot-action-button';
import { useTranslation } from 'react-i18next';
import { StatusBadge, statusLabel } from '@/ui/status-badge';
import type { FilmProjectStatus } from '@/stories/inkos-integration';

// Types
interface Segment {
  id: string;
  segmentNumber: number;
  startTime: string;
  endTime: string;
  duration: number;
  narrativeFunction: string | null;
  summary: string | null;
  status: string;
}

interface Shot {
  id: string;
  segmentId: string;
  shotNumber: number;
  shotSize: string | null;
  cameraAngle: string | null;
  cameraMovement: string | null;
  dialogue: string | null;
  description: string;
  duration: number;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  description: string | null;
  status: string;
  views?: AssetView[];
}

interface AssetView {
  id: string;
  viewAngle: string;
  imageUrl: string | null;
  status: string;
}

interface Keyframe {
  id: string;
  shotId: string | null;
  name: string;
  imageUrl: string | null;
  status: string;
}

interface VideoClip {
  id: string;
  keyframeId: string | null;
  videoUrl: string | null;
  duration: number | null;
  status: string;
}

/** Mirror of generateVideoFn's in-flight guard: a clip that already holds a
 *  reservation must not be queued (and paid for) a second time by a click. */
const IN_FLIGHT_VIDEO_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'queued',
  'generating',
]);

function isVideoInFlight(status: string): boolean {
  return IN_FLIGHT_VIDEO_STATUSES.has(status);
}

interface ShotVideoButtonProps {
  shotNumber: number;
  keyframe: Keyframe | undefined;
  clips: VideoClip[];
  /** A different generation is already in progress. */
  busy: boolean;
  onGenerateVideo: (keyframeId: string) => Promise<void>;
  onPlay: (url: string) => void;
}

/** The per-shot video action: play a finished clip, or queue a fresh one. */
export function ShotVideoButton({
  shotNumber,
  keyframe,
  clips,
  busy,
  onGenerateVideo,
  onPlay,
}: ShotVideoButtonProps) {
  const clipUrl = clips.find((clip) => clip.videoUrl)?.videoUrl;
  if (clipUrl) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onPlay(clipUrl)}
        aria-label={`播放镜头 ${shotNumber} 视频`}
      >
        <PlayIcon className="size-4" />
      </Button>
    );
  }
  if (!keyframe) return null;

  // A ready keyframe may spend credits, but never while one of its clips
  // still holds a reservation (that would start a second paid attempt).
  const canGenerate =
    (keyframe.status === 'completed' || keyframe.status === 'approved') &&
    !clips.some((clip) => isVideoInFlight(clip.status)) &&
    !busy;

  return (
    <Button
      size="sm"
      variant="outline"
      aria-label={`为镜头 ${shotNumber} 生成视频`}
      onClick={() => void onGenerateVideo(keyframe.id)}
      disabled={!canGenerate}
    >
      <VideoIcon className="size-4" />
    </Button>
  );
}

interface FilmmakingPanelProps {
  projectId: string;
  chapters: Array<{ chapterNumber: number; title: string; content: string }>;
  segments: Segment[];
  shots: Shot[];
  assets: Asset[];
  keyframes: Keyframe[];
  videoClips: VideoClip[];
  filmStatus: FilmProjectStatus;
  onSegmentChapter: (chapterNumber: number) => Promise<void>;
  onExtractAssets: (chapterNumber: number) => Promise<void>;
  onGenerateAssetImage: (assetId: string, viewAngle?: string) => Promise<void>;
  onGenerateKeyframe: (
    shotId: string,
    referenceAssetIds?: string[]
  ) => Promise<void>;
  onGenerateVideo: (keyframeId: string) => Promise<void>;
  onBatchGenerateSegment: (segmentId: string) => Promise<void>;
}

export function FilmmakingPanel({
  projectId: _projectId,
  chapters,
  segments,
  shots,
  assets,
  keyframes,
  videoClips,
  filmStatus,
  onSegmentChapter,
  onExtractAssets,
  onGenerateAssetImage,
  onGenerateKeyframe,
  onGenerateVideo,
  onBatchGenerateSegment,
}: FilmmakingPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('pipeline');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState('');

  // 阶段态：不伪造 0/100 百分比，直接展示每阶段的完成情况和计数。
  const pipelineStages: PipelineStage[] = [
    {
      label: t('filmmaking.pipelineStages.story'),
      state: filmStatus.stages.story.completed ? 'completed' : 'pending',
      detail: t('filmmaking.pipelineStages.chapterCount', {
        count: filmStatus.stages.story.chapterCount,
      }),
    },
    {
      label: t('filmmaking.pipelineStages.storyboard'),
      state: filmStatus.stages.storyboard.completed
        ? 'completed'
        : filmStatus.stages.story.chapterCount > 0
          ? 'active'
          : 'pending',
      detail: t('filmmaking.pipelineStages.segmentShotCount', {
        segments: filmStatus.stages.storyboard.segmentCount,
        shots: filmStatus.stages.storyboard.shotCount,
      }),
    },
    {
      label: t('filmmaking.pipelineStages.assets'),
      state: filmStatus.stages.assets.completed
        ? 'completed'
        : filmStatus.stages.storyboard.completed
          ? 'active'
          : 'pending',
      detail: t('filmmaking.pipelineStages.assetApprovedCount', {
        assets:
          filmStatus.stages.assets.characterCount +
          filmStatus.stages.assets.sceneAssetCount,
        approved: filmStatus.stages.keyframes.approvedCount,
      }),
    },
    {
      label: t('filmmaking.pipelineStages.video'),
      state: filmStatus.stages.video.completed
        ? 'completed'
        : filmStatus.stages.keyframes.approvedCount > 0
          ? 'active'
          : 'pending',
      detail: t('filmmaking.pipelineStages.videoClipCount', {
        generated: filmStatus.stages.video.generatedCount,
        count: filmStatus.stages.video.clipCount,
      }),
      percent:
        filmStatus.stages.video.clipCount > 0
          ? (filmStatus.stages.video.generatedCount /
              filmStatus.stages.video.clipCount) *
            100
          : undefined,
    },
  ];

  // 处理分镜切分
  const handleSegmentChapter = async (chapterNumber: number) => {
    setIsProcessing(true);
    setProcessingStep(
      t('filmmaking.processing.splittingChapter', { count: chapterNumber })
    );
    try {
      await onSegmentChapter(chapterNumber);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // 处理资产提取
  const handleExtractAssets = async (chapterNumber: number) => {
    setIsProcessing(true);
    setProcessingStep(
      t('filmmaking.processing.extractingChapter', { count: chapterNumber })
    );
    try {
      await onExtractAssets(chapterNumber);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // 处理资产图像生成
  const handleGenerateAssetImage = async (
    assetId: string,
    viewAngle?: string
  ) => {
    setIsProcessing(true);
    setProcessingStep(t('filmmaking.processing.generatingAssets'));
    try {
      await onGenerateAssetImage(assetId, viewAngle);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleGenerateKeyframe = async (shotId: string) => {
    setIsProcessing(true);
    setProcessingStep(t('filmmaking.processing.generatingKeyframes'));
    try {
      await onGenerateKeyframe(shotId);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleGenerateVideo = async (keyframeId: string) => {
    setIsProcessing(true);
    setProcessingStep(t('filmmaking.processing.generatingVideos'));
    try {
      await onGenerateVideo(keyframeId);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // 处理批量生成
  const handleBatchGenerate = async (segmentId: string) => {
    setIsProcessing(true);
    const segmentNumber = segments.find(
      (s) => s.id === segmentId
    )?.segmentNumber;
    setProcessingStep(
      segmentNumber
        ? t('filmmaking.processing.segment', { count: segmentNumber })
        : t('filmmaking.processing.generatingKeyframesBatch')
    );
    try {
      await onBatchGenerateSegment(segmentId);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 进度概览 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FilmIcon className="size-5" />
            影视制作进度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PipelineProgress stages={pipelineStages} />
        </CardContent>
      </Card>

      {/* 处理中提示 */}
      <GenerationStateBanner
        phase={isProcessing ? 'loading' : 'idle'}
        title={processingStep}
      />

      {/* 主标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pipeline">
            <SparklesIcon className="mr-2 size-4" />
            流水线
          </TabsTrigger>
          <TabsTrigger value="segments">
            <FilmIcon className="mr-2 size-4" />
            分镜
          </TabsTrigger>
          <TabsTrigger value="assets">
            <ImageIcon className="mr-2 size-4" />
            资产
          </TabsTrigger>
          <TabsTrigger value="videos">
            <VideoIcon className="mr-2 size-4" />
            视频
          </TabsTrigger>
        </TabsList>

        {/* 流水线视图 */}
        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">影视创作流水线</CardTitle>
              <CardDescription>
                按步骤完成：章节 → 分镜 → 资产 → 关键帧 → 视频
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chapters.map((chapter) => {
                  const chapterSegments = segments.filter(
                    (s) => s.segmentNumber >= 1 // TODO: 关联章节
                  );
                  const hasSegments = chapterSegments.length > 0;

                  return (
                    <div
                      key={chapter.chapterNumber}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">
                            第 {chapter.chapterNumber} 章：{chapter.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {chapter.content.length} 字
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasSegments ? (
                            <Badge variant="secondary">
                              <CheckCircleIcon className="mr-1 size-3" />
                              已分镜
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() =>
                                void handleSegmentChapter(chapter.chapterNumber)
                              }
                              disabled={isProcessing}
                            >
                              <SparklesIcon className="mr-2 size-4" />
                              AI 分镜
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void handleExtractAssets(chapter.chapterNumber)
                            }
                            disabled={isProcessing}
                          >
                            <UserIcon className="mr-2 size-4" />
                            提取资产
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {chapters.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    还没有章节，请先创建故事内容
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 分镜视图 */}
        <TabsContent value="segments" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* 片段列表 */}
            <Card className="flex min-h-0 flex-col lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">片段列表</CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col">
                <ScrollArea className="min-h-0 max-h-[28rem] flex-1">
                  <div className="space-y-2">
                    {segments.map((segment) => (
                      <button
                        type="button"
                        key={segment.id}
                        className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors hover:bg-muted ${
                          selectedSegment?.id === segment.id
                            ? 'border-primary bg-muted'
                            : ''
                        }`}
                        onClick={() => setSelectedSegment(segment)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              #{segment.segmentNumber}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {segment.duration} 秒
                            </Badge>
                          </div>
                          <ChevronRightIcon className="size-4 text-muted-foreground" />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {segment.summary || '无描述'}
                        </p>
                      </button>
                    ))}

                    {segments.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground">
                        还没有分镜片段
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* 镜头详情 */}
            <Card className="flex min-h-0 flex-col lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {selectedSegment
                      ? `片段 #${selectedSegment.segmentNumber} 镜头`
                      : '镜头详情'}
                  </CardTitle>
                  {selectedSegment && (
                    <Button
                      size="sm"
                      onClick={() =>
                        void handleBatchGenerate(selectedSegment.id)
                      }
                      disabled={isProcessing}
                    >
                      <SparklesIcon className="mr-2 size-4" />
                      批量生成关键帧
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col">
                <ScrollArea className="min-h-0 max-h-[28rem] flex-1">
                  {selectedSegment ? (
                    <div className="space-y-3">
                      {shots
                        .filter((s) => s.segmentId === selectedSegment.id)
                        .map((shot) => {
                          const shotKeyframe = keyframes.find(
                            (k) => k.shotId === shot.id
                          );
                          const shotClips = shotKeyframe
                            ? videoClips.filter(
                                (v) => v.keyframeId === shotKeyframe.id
                              )
                            : [];

                          return (
                            <div
                              key={shot.id}
                              className="rounded-lg border p-3"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm">
                                      镜头 {shot.shotNumber}
                                    </span>
                                    <StatusBadge
                                      domain="shot-size"
                                      status={shot.shotSize || 'medium'}
                                    />
                                    <StatusBadge
                                      domain="camera-angle"
                                      status={shot.cameraAngle || 'eye_level'}
                                    />
                                  </div>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {shot.description || '无描述'}
                                  </p>
                                  {shot.dialogue && (
                                    <p className="mt-1 text-sm italic">
                                      "{shot.dialogue}"
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1">
                                  {shotKeyframe?.imageUrl ? (
                                    <MediaThumbnail
                                      src={shotKeyframe.imageUrl}
                                      alt="已生成的关键帧静帧"
                                      shotNumber={shot.shotNumber}
                                      className="h-16 w-24"
                                    />
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      aria-label={`为镜头 ${shot.shotNumber} 生成关键帧`}
                                      onClick={() =>
                                        void handleGenerateKeyframe(shot.id)
                                      }
                                      disabled={isProcessing}
                                    >
                                      <ImageIcon className="size-4" />
                                    </Button>
                                  )}
                                  <ShotActionButton
                                    shotNumber={shot.shotNumber}
                                    keyframe={shotKeyframe}
                                    clips={shotClips}
                                    busy={isProcessing}
                                    onGenerateVideo={handleGenerateVideo}
                                    onPlay={(url) => {
                                      setPreviewVideoUrl(url);
                                      setShowVideoPreview(true);
                                    }}
                                    toastId={shotActionToastId(shot.shotNumber)}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center py-8 text-muted-foreground">
                      选择一个片段查看镜头
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 资产视图 */}
        <TabsContent value="assets" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <Card key={asset.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      {asset.type === 'character' ? (
                        <UserIcon className="size-5" />
                      ) : (
                        <MapPinIcon className="size-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 font-medium"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowAssetDialog(true);
                            }}
                          >
                            {asset.name}
                          </Button>
                        </h4>
                        <StatusBadge
                          domain="asset-status"
                          status={asset.status}
                        />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {asset.description || '无描述'}
                      </p>
                    </div>
                  </div>
                  {asset.views && asset.views.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {asset.views.slice(0, 3).map((view) => (
                        <MediaThumbnail
                          key={view.id}
                          src={view.imageUrl}
                          alt={`${asset.name} · ${statusLabel('view-angle', view.viewAngle)}`}
                          className="h-12 w-16"
                        />
                      ))}
                      {asset.views.length > 3 && (
                        <div className="flex h-12 w-16 items-center justify-center rounded bg-muted text-sm">
                          +{asset.views.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {assets.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground">
                还没有资产，请先从章节中提取角色和场景
              </div>
            )}
          </div>
        </TabsContent>

        {/* 视频视图 */}
        <TabsContent value="videos" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videoClips.map((clip) => {
              const keyframe = keyframes.find((k) => k.id === clip.keyframeId);
              const clipVideoUrl = clip.videoUrl;
              const clipShotNumber = shots.find(
                (s) => s.id === keyframe?.shotId
              )?.shotNumber;

              return (
                <Card key={clip.id}>
                  <CardContent className="p-4">
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                      {clipVideoUrl ? (
                        <>
                          <MediaThumbnail
                            src={keyframe?.imageUrl}
                            alt="视频成片的封面关键帧"
                            shotNumber={clipShotNumber}
                            className="h-full w-full"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            className="absolute bottom-2 right-2"
                            onClick={() => {
                              setPreviewVideoUrl(clipVideoUrl);
                              setShowVideoPreview(true);
                            }}
                          >
                            <PlayIcon className="mr-1 size-4" />
                            播放
                          </Button>
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Loader2Icon className="size-6 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {clip.duration ? `${clip.duration} 秒` : '生成中...'}
                      </span>
                      <StatusBadge domain="video-status" status={clip.status} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {videoClips.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground">
                还没有视频片段，请先生成关键帧
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* 资产详情弹窗 */}
      <Dialog open={showAssetDialog} onOpenChange={setShowAssetDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAsset?.type === 'character' ? (
                <UserIcon className="size-5" />
              ) : (
                <MapPinIcon className="size-5" />
              )}
              {selectedAsset?.name}
            </DialogTitle>
            <DialogDescription>{selectedAsset?.description}</DialogDescription>
          </DialogHeader>

          {selectedAsset && (
            <div className="space-y-4">
              {/* 已生成的视图 */}
              {selectedAsset.views && selectedAsset.views.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {selectedAsset.views.map((view) => (
                    <div key={view.id} className="space-y-1">
                      <MediaThumbnail
                        src={view.imageUrl}
                        alt={`${selectedAsset.name} · ${statusLabel('view-angle', view.viewAngle)}`}
                        className="aspect-video w-full"
                      />
                      <p className="text-center text-xs text-muted-foreground">
                        {statusLabel('view-angle', view.viewAngle)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 生成按钮 */}
              <div className="flex flex-wrap gap-2">
                {selectedAsset.type === 'character' ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        void handleGenerateAssetImage(selectedAsset.id, 'front')
                      }
                      disabled={isProcessing}
                    >
                      生成正面
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleGenerateAssetImage(selectedAsset.id, 'side')
                      }
                      disabled={isProcessing}
                    >
                      生成侧面
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleGenerateAssetImage(selectedAsset.id, 'back')
                      }
                      disabled={isProcessing}
                    >
                      生成背面
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        void handleGenerateAssetImage(selectedAsset.id, 'wide')
                      }
                      disabled={isProcessing}
                    >
                      生成全景
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleGenerateAssetImage(
                          selectedAsset.id,
                          'detail'
                        )
                      }
                      disabled={isProcessing}
                    >
                      生成细节
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssetDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 视频预览弹窗 */}
      <Dialog open={showVideoPreview} onOpenChange={setShowVideoPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>视频预览</DialogTitle>
          </DialogHeader>
          <div className="aspect-video">
            <video
              src={previewVideoUrl}
              controls
              autoPlay
              className="h-full w-full rounded-lg"
            >
              <track
                kind="captions"
                src="data:text/vtt,WEBVTT"
                srcLang="zh"
                label="无字幕"
              />
            </video>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVideoPreview(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
