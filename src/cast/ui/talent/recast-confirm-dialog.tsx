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
import { Loader2 } from 'lucide-react';

type RecastConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  characterName: string;
  talentName: string;
  /** True when this role already has talent — copy says Recast, not Cast. */
  replacingExisting: boolean;
  affectedShotCount: number;
  isLoading: boolean;
};

export const RecastConfirmDialog: React.FC<RecastConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  characterName,
  talentName,
  replacingExisting,
  affectedShotCount,
  isLoading,
}) => {
  const verb = replacingExisting ? '替换演员' : '选用演员';
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {verb}：由 {talentName} 饰演 {characterName}？
          </AlertDialogTitle>
          <AlertDialogDescription>
            将以 {talentName} 为参考素材生成新的角色设定图。
            {affectedShotCount > 0 && (
              <>
                {' '}
                <strong>{affectedShotCount} 个镜头</strong>{' '}
                包含此角色，需要重新生成。
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <span>{isLoading ? '正在更新…' : verb}</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
