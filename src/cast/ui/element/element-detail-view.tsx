import { ElementTokenButton } from './element-token-button';
import { ReplaceElementPopover } from './replace-element-popover';
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
import { ScrollArea } from '@/ui/shadcn/scroll-area';
import { Skeleton } from '@/ui/shadcn/skeleton';
import { AppImage } from '@/ui/shadcn/app-image';
import {
  useDeleteSequenceElement,
  useRenameSequenceElementToken,
  useSequenceElements,
  useSetSequenceElementDescription,
  useShotCountsForAllElements,
} from '@/cast/ui/use-sequence-elements';
import { formatElementDuration } from '@/cast/element-kind';
import {
  ElementSupportBadge,
  elementSupportSummary,
} from './element-support-badge';
import { Textarea } from '@/ui/shadcn/textarea';
import { cn } from '@/ui/utils';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type ElementDetailViewProps = {
  sequenceId: string;
  elementId: string;
};

type DetailRowProps = {
  label: string;
  value: string | number | undefined | null;
  className?: string;
};

const DetailRow: React.FC<DetailRowProps> = ({ label, value, className }) => {
  if (!value) return null;

  return (
    <div className={cn('space-y-1', className)}>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed">{value}</dd>
    </div>
  );
};

export const ElementDetailView: React.FC<ElementDetailViewProps> = ({
  sequenceId,
  elementId,
}) => {
  const navigate = useNavigate();
  const { data: elements, isLoading, error } = useSequenceElements(sequenceId);
  const { data: shotCounts } = useShotCountsForAllElements(sequenceId);
  const deleteElement = useDeleteSequenceElement();
  const renameToken = useRenameSequenceElementToken();
  const setDescription = useSetSequenceElementDescription();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const element = elements?.find((el) => el.id === elementId);
  const counts = elementId ? shotCounts?.[elementId] : undefined;
  const affectedShotCount = counts?.shotCount ?? 0;
  const affectedVideoCount = counts?.videoCount ?? 0;

  const isAnalyzing =
    element?.visionStatus === 'pending' ||
    element?.visionStatus === 'analyzing';

  const handleRename = async (nextToken: string) => {
    const result = await renameToken.mutateAsync({
      sequenceId,
      elementId,
      token: nextToken,
    });
    const updates: string[] = [];
    if (result.scriptUpdated) updates.push('剧本');
    if (result.shotsUpdated > 0) {
      updates.push(`${result.shotsUpdated} 个镜头`);
    }
    const suffix = updates.length > 0 ? `，已更新${updates.join(' + ')}` : '';
    toast.success(`已重命名为 ${nextToken}${suffix}`);
  };

  const handleDelete = () => {
    deleteElement.mutate(
      { elementId, sequenceId },
      {
        onSuccess: () => {
          toast.success(`已删除 ${element?.token ?? '元素'}`);
          void navigate({
            to: '/sequences/$id/elements',
            params: { id: sequenceId },
          });
        },
        onError: (err) => {
          toast.error('删除元素失败', {
            description: err instanceof Error ? err.message : '未知错误',
          });
        },
      }
    );
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-destructive">加载元素失败</p>
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

  if (!element) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <ImagePlus className="h-16 w-16 text-muted-foreground/30" />
        <div className="text-center">
          <p className="text-sm font-medium">未找到元素</p>
          <Link
            to="/sequences/$id/elements"
            params={{ id: sequenceId }}
            className="mt-2 text-sm text-primary hover:underline"
          >
            返回元素列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <Link
          to="/sequences/$id/elements"
          params={{ id: sequenceId }}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
          aria-label="返回元素列表"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-mono text-lg font-semibold">{element.token}</h1>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-6 p-4">
          <p className="text-sm text-muted-foreground">
            在提示词或剧本中输入 @ 可插入{' '}
            <span className="font-mono">{element.token}</span>.
          </p>

          <div className="group relative aspect-video overflow-hidden rounded-lg bg-muted">
            {isAnalyzing ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">正在分析…</p>
              </div>
            ) : null}
            {element.kind === 'video' && element.imageUrl ? (
              <video
                src={element.imageUrl}
                controls
                playsInline
                className="h-full w-full object-contain"
              >
                <track kind="captions" />
              </video>
            ) : element.kind === 'audio' && element.imageUrl ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
                <audio src={element.imageUrl} controls className="w-full">
                  <track kind="captions" />
                </audio>
              </div>
            ) : element.imageUrl ? (
              <AppImage
                src={element.imageUrl}
                alt={element.token}
                width={640}
                height={360}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                <ImagePlus className="size-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  暂无参考素材，将在“参考素材”阶段生成
                </p>
              </div>
            )}
            {element.visionStatus === 'completed' && (
              <ElementTokenButton
                token={element.token}
                onRename={handleRename}
              />
            )}
          </div>

          <div className="flex gap-3">
            <ReplaceElementPopover
              sequenceId={sequenceId}
              elementId={element.id}
              token={element.token}
              affectedShotCount={affectedShotCount}
              affectedVideoCount={affectedVideoCount}
              disabled={isAnalyzing}
              trigger="button"
            />
            <Button
              type="button"
              variant="outline"
              disabled={deleteElement.isPending || isAnalyzing}
              onClick={() => setDeleteOpen(true)}
              aria-label={`删除 ${element.token}`}
            >
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          </div>

          <dl className="space-y-4">
            {isAnalyzing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在分析图像…
              </div>
            ) : element.visionStatus === 'failed' ? (
              <p className="text-sm text-destructive">
                视觉分析失败：{element.visionError ?? '未知错误'}
              </p>
            ) : element.kind === 'image' ? (
              <DetailRow label="描述" value={element.description} />
            ) : (
              // Nothing looked at this file, so the description is the user's
              // to write (#1559): a transcript, "upbeat synth bed", "puppet
              // walk cycle". How it is USED stays in the script around the
              // mention.
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  描述
                </dt>
                <dd>
                  <Textarea
                    key={element.id}
                    defaultValue={element.description ?? ''}
                    rows={3}
                    placeholder={
                      element.kind === 'audio'
                        ? '这是什么？例如台词文本或“轻快的合成器铺底”'
                        : '这是什么？例如“手持摄影的侧面行走循环”'
                    }
                    disabled={setDescription.isPending}
                    onBlur={(event) => {
                      const next = event.target.value.trim();
                      if (next === (element.description ?? '')) return;
                      setDescription.mutate(
                        { sequenceId, elementId, description: next },
                        {
                          onError: (err) =>
                            toast.error('无法保存描述', {
                              description:
                                err instanceof Error ? err.message : '未知错误',
                            }),
                        }
                      );
                    }}
                  />
                </dd>
              </div>
            )}
            {element.kind !== 'image' && (
              <>
                <DetailRow
                  label="时长"
                  value={formatElementDuration(element.durationSeconds)}
                />
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    模型支持
                  </dt>
                  <dd className="flex items-start gap-2 text-sm leading-relaxed">
                    <ElementSupportBadge
                      token={element.token}
                      url={element.imageUrl}
                      kind={element.kind}
                      durationSeconds={element.durationSeconds}
                      variant="inline"
                      className="mt-0.5 shrink-0"
                    />
                    <span>
                      {elementSupportSummary(
                        element.kind,
                        element.durationSeconds,
                        element.imageUrl
                      )}
                    </span>
                  </dd>
                </div>
              </>
            )}
            {affectedShotCount > 0 ? (
              <DetailRow
                label="使用位置"
                value={`${affectedShotCount} 个镜头${
                  affectedVideoCount > 0
                    ? `（其中 ${affectedVideoCount} 个已有视频）`
                    : ''
                }`}
              />
            ) : (
              <DetailRow
                label="使用位置"
                value="暂未用于任何镜头，可在提示词或剧本中使用 @ 提及它"
              />
            )}
          </dl>
        </div>
      </ScrollArea>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 {element.token}？</AlertDialogTitle>
            <AlertDialogDescription>
              这将从序列中移除该参考素材。
              {affectedShotCount > 0 && (
                <span>{` 仍有 ${affectedShotCount} 个镜头提及它，在你编辑相关提示词之前，其中会保留该 token。`}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteElement.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteElement.isPending}
            >
              {deleteElement.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <span>{deleteElement.isPending ? '正在删除…' : '删除'}</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
