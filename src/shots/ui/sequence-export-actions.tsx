/**
 * Desktop canvas-view trailing control: an Export dropdown in the same slot
 * as Copy script. Hidden on mobile — Download / Copy stay on the theatre
 * player overlay, which already meets the 44px hit target.
 */

import { Button } from '@/ui/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/shadcn/dropdown-menu';
import type {
  ExportProgress,
  SequenceExportState,
} from '@/sequences/ui/theatre/use-sequence-export';
import { ChevronDown, Download, FileDown, Link, Loader2 } from 'lucide-react';

export function formatExportProgress(progress: ExportProgress | null): string {
  if (!progress) return '正在创建 MP4…';
  return '正在服务器上渲染…';
}

export const SequenceExportActions: React.FC<{
  sequenceExport: SequenceExportState;
}> = ({ sequenceExport }) => {
  const running = sequenceExport.isRunning;
  const pending =
    !running && !sequenceExport.canExport && !sequenceExport.freshExportUrl;
  const label = running
    ? formatExportProgress(sequenceExport.progress)
    : pending
      ? `${sequenceExport.clipsReady}/${sequenceExport.clipsTotal} 个片段已就绪`
      : '导出';

  return (
    <div className="hidden md:block">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="default"
            size="sm"
            aria-label={label}
            aria-busy={running}
            disabled={pending}
          >
            {running ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
            )}
            <span>{running ? '创建中…' : '导出'}</span>
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={pending || running}
            onClick={sequenceExport.download}
          >
            <Download />
            下载 MP4
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending || running}
            onClick={sequenceExport.copyLink}
          >
            <Link />
            复制链接
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
