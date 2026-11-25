import { useState } from 'react';
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
import { TalentMediaUpload } from './talent-media-upload';

type AddTalentMediaDialogProps = {
  talentId: string;
  trigger?: React.ReactNode;
};

/**
 * Each file is checked for a real person as it lands (#1581); one that shows
 * a person opens the rights sign-off dialog before it is saved.
 */
export const AddTalentMediaDialog: React.FC<AddTalentMediaDialogProps> = ({
  talentId,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadCount, setUploadCount] = useState(0);

  const handleClose = () => {
    setFiles([]);
    setUploadCount(0);
    setOpen(false);
  };

  const isUploading = files.length > uploadCount;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">添加素材</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>添加参考素材</DialogTitle>
          <DialogDescription>
            拖入角色设定图或参考照片。保存真人照片前需先确认你拥有相应权利。
          </DialogDescription>
        </DialogHeader>

        <TalentMediaUpload
          files={files}
          onFilesChange={setFiles}
          talentId={talentId}
          onComplete={() => setUploadCount((c) => c + 1)}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button onClick={handleClose} disabled={isUploading}>
            {isUploading ? '正在上传…' : '完成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
