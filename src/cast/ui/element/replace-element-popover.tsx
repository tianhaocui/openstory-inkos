import { Button } from '@/ui/shadcn/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/shadcn/popover';
import { useReplaceSequenceElement } from '@/cast/ui/use-sequence-elements';
import { cn } from '@/ui/utils';
import {
  extractImagesFromSnapshot,
  snapshotDataTransfer,
  toastDragImportCorsError,
} from '@/ui/drag-images';
import { AudioLines, Film, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import {
  ELEMENT_UPLOAD_ACCEPT,
  elementKindFromFile,
} from '@/cast/element-kind';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type ReplaceElementPopoverProps = {
  sequenceId: string;
  elementId: string;
  token: string;
  affectedShotCount: number;
  affectedVideoCount: number;
  disabled?: boolean;
  /** Labeled button on the detail page; icon-only in compact cards. */
  trigger?: 'icon' | 'button';
};

/**
 * Replace one element's image. Two-step flow inside a single popover:
 *
 *  1. Dropzone — drag/drop, paste, or browse for a new image. Nothing
 *     destructive runs yet.
 *  2. Confirmation — shows the picked file with an explicit "Replace" button
 *     before any upload starts. Affected shots are left stale.
 *
 * The upload + vision re-run only fires once the user confirms; the popover
 * stays open and shows an uploading state until the mutation resolves, then
 * closes.
 */
export const ReplaceElementPopover: React.FC<ReplaceElementPopoverProps> = ({
  sequenceId,
  elementId,
  token,
  affectedShotCount,
  affectedVideoCount,
  disabled = false,
  trigger = 'icon',
}) => {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceMutation = useReplaceSequenceElement();

  // Object URL for the picked file. Created on selection, revoked when the
  // file changes, the popover closes, or the component unmounts — otherwise
  // each re-pick would leak a blob.
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pendingFile]);

  // Reset the staged file whenever the popover closes so a stale pick from a
  // previous open doesn't reappear when the user comes back.
  useEffect(() => {
    if (!open) setPendingFile(null);
  }, [open]);

  const pendingKind = pendingFile ? elementKindFromFile(pendingFile) : null;

  const clearPending = useCallback(() => {
    setPendingFile(null);
  }, []);

  const handleFiles = useCallback((files: File[]) => {
    // Any element kind can be replaced, including by one of a different kind
    // (#1559) — swapping a still for the clip it was grabbed from is a
    // replacement, not a new element.
    const picked = files.find((f) => elementKindFromFile(f) !== null);
    if (!picked) return;
    setPendingFile(picked);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pendingFile) return;
    replaceMutation.mutate(
      { file: pendingFile, sequenceId, elementId },
      {
        onSuccess: () => {
          setOpen(false);
          setPendingFile(null);
          toast.success(`已替换 ${token}`, {
            description:
              affectedShotCount > 0
                ? `${affectedShotCount} 个镜头将显示为已过期`
                : undefined,
          });
        },
        onError: (err) => {
          toast.error('替换元素失败', {
            description: err instanceof Error ? err.message : '未知错误',
          });
        },
      }
    );
  }, [
    affectedShotCount,
    elementId,
    pendingFile,
    replaceMutation,
    sequenceId,
    token,
  ]);

  const isPending = replaceMutation.isPending;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Block dismiss while the upload + workflow trigger is in-flight so
        // the user can't navigate away mid-mutation and leave the element
        // stranded in `analyzing` without UI feedback.
        if (isPending && !next) return;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        {trigger === 'button' ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={disabled}
            aria-label={`替换 ${token}`}
          >
            <RefreshCw className="h-4 w-4" />
            替换
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={`替换 ${token}`}
            title="替换"
          >
            <RefreshCw className="size-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              替换 <span className="font-mono">{token}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {pendingFile
                ? affectedShotCount > 0
                  ? `这将替换参考素材。使用它的 ${affectedShotCount} 个镜头${
                      affectedVideoCount > 0
                        ? `（其中 ${affectedVideoCount} 个已有视频）`
                        : ''
                    } 将显示为已过期，直到你更新它们。`
                  : `这将替换 ${token} 的参考素材。`
                : `拖入新文件以替换 ${token}。进行任何更改之前都会让你确认。`}
            </p>
          </div>

          {pendingFile && previewUrl ? (
            <div className="flex flex-col gap-3">
              <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                {pendingKind === 'image' ? (
                  <>
                    {/* Local object-URL preview — not a remote asset. */}
                    {/* biome-ignore lint/performance/noImgElement: blob: preview */}
                    <img
                      src={previewUrl}
                      alt={pendingFile.name}
                      className="size-full object-contain"
                    />
                  </>
                ) : (
                  <div className="flex size-full items-center justify-center">
                    {pendingKind === 'audio' ? (
                      <AudioLines className="size-8 text-muted-foreground/50" />
                    ) : (
                      <Film className="size-8 text-muted-foreground/50" />
                    )}
                  </div>
                )}
                {!isPending && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-1 right-1 size-6"
                    onClick={clearPending}
                    aria-label="选择其他文件"
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
              <p
                className="truncate text-xs text-muted-foreground"
                title={pendingFile.name}
              >
                {pendingFile.name}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearPending}
                  disabled={isPending}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isPending}
                >
                  {isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  <span>{isPending ? '正在替换…' : `替换 ${token}`}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- dropzone cannot be a <button> because it contains a nested <Button>
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                const related = e.relatedTarget;
                if (
                  related instanceof Node &&
                  e.currentTarget.contains(related)
                ) {
                  return;
                }
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const snapshot = snapshotDataTransfer(e.dataTransfer);
                void extractImagesFromSnapshot(snapshot).then(
                  ({ files, failedUrls }) => {
                    if (files.length > 0) {
                      handleFiles(files);
                    } else if (failedUrls.length > 0) {
                      toastDragImportCorsError();
                    }
                  }
                );
              }}
              onPaste={(e) => {
                const items = e.clipboardData.items;
                const pasted: File[] = [];
                for (const item of items) {
                  if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) pasted.push(file);
                  }
                }
                if (pasted.length === 0) return;
                e.preventDefault();
                handleFiles(pasted);
              }}
              className={cn(
                'relative flex select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 min-h-[100px] outline-none transition-colors hover:bg-accent/30 focus-visible:border-ring/50 cursor-pointer',
                dragOver && 'border-primary/50 bg-accent/30'
              )}
            >
              <Upload className="size-6 text-muted-foreground/50" />
              <span className="text-sm font-medium">拖放或粘贴</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                浏览
              </Button>
            </div>
          )}

          {!pendingFile && (
            <p className="text-[11px] text-muted-foreground">
              视觉分析将重新检查新文件；如果识别到更合适的标识符，可能会重命名{' '}
              {token}。
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ELEMENT_UPLOAD_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            handleFiles(files);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
