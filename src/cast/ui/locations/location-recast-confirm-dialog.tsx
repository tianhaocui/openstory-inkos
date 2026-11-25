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

type LocationRecastConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  locationName: string;
  libraryLocationName: string;
  affectedShotCount: number;
  isLoading: boolean;
};

export const LocationRecastConfirmDialog: React.FC<
  LocationRecastConfirmDialogProps
> = ({
  open,
  onOpenChange,
  onConfirm,
  locationName,
  libraryLocationName,
  affectedShotCount,
  isLoading,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>更新 {locationName} 的参考素材？</AlertDialogTitle>
          <AlertDialogDescription>
            将以“{libraryLocationName}”为视觉参考，重新生成“{locationName}
            ”的参考图片。
            {affectedShotCount > 0 && (
              <>
                {' '}
                <strong>{affectedShotCount} 个镜头</strong>{' '}
                使用此场景，将按新的外观重新生成。
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <span>{isLoading ? '正在更新…' : '更新参考素材'}</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
