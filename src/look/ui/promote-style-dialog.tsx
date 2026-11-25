import { Button } from '@/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/shadcn/dialog';
import { Input } from '@/ui/shadcn/input';
import { Label } from '@/ui/shadcn/label';
import { usePromoteSequenceStyle } from './use-styles';
import type { Style } from '@/platform/server/db/schema';
import { useId } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const promoteFormSchema = z.object({
  name: z.string().trim().min(1, '请为风格命名').max(255),
});

type PromoteStyleDialogProps = {
  style: Style;
  sequenceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Add a sequence's automatic style to the team library (#1213). The derived
 * name is the default; the library's slug-uniqueness rule can reject it, in
 * which case the server's message names the clash.
 */
export function PromoteStyleDialog({
  style,
  sequenceId,
  open,
  onOpenChange,
}: PromoteStyleDialogProps) {
  const nameId = useId();
  const promote = usePromoteSequenceStyle();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = promoteFormSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget))
    );
    if (!parsed.success) return;
    promote.mutate(
      { sequenceId, name: parsed.data.name },
      {
        onSuccess: (promoted) => {
          toast.success(`“${promoted.name}”已添加到风格库`);
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error('无法将风格添加到风格库', {
            description: error.message,
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>添加到风格库</DialogTitle>
            <DialogDescription>
              此风格根据剧本生成，当前仅用于这个序列。添加到风格库后，所有新序列都可使用。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId}>风格名称</Label>
            <Input
              id={nameId}
              name="name"
              defaultValue={style.name}
              required
              maxLength={255}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={promote.isPending}>
              {promote.isPending ? '正在添加…' : '添加到风格库'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
