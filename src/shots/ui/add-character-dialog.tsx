import { Button } from '@/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/shadcn/dialog';
import { Input } from '@/ui/shadcn/input';
import { Label } from '@/ui/shadcn/label';
import { Textarea } from '@/ui/shadcn/textarea';
import { useCreateSequenceCharacter } from '@/cast/ui/use-sequence-characters';
import { errorMessage } from '@/platform/errors';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const createCharacterSchema = z.object({
  name: z.string().trim().min(1).max(255),
  physicalDescription: z.string().max(2000),
});

/**
 * Manual character create (#1108 Phase 2) — name plus an optional look; the
 * full bible is edited on the character's detail page, and the sheet comes
 * later via recast.
 */
export const AddCharacterDialog: React.FC<{ sequenceId: string }> = ({
  sequenceId,
}) => {
  const [open, setOpen] = useState(false);
  const createCharacter = useCreateSequenceCharacter();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = createCharacterSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget))
    );
    if (!result.success) {
      toast.error('请检查演员字段', {
        description: result.error.issues[0]?.message,
      });
      return;
    }
    createCharacter.mutate(
      { sequenceId, ...result.data },
      {
        onSuccess: (character) => {
          setOpen(false);
          toast.success(`已添加 ${character.name}`);
        },
        onError: (error) =>
          toast.error('添加演员失败', {
            description: errorMessage(error),
          }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          添加演员
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加演员</DialogTitle>
          <DialogDescription>
            填写完整角色设定，并可在角色详情页生成设定图。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-character-name">名称</Label>
            <Input id="new-character-name" name="name" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-character-description">外貌描述（可选）</Label>
            <Textarea
              id="new-character-description"
              name="physicalDescription"
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={createCharacter.isPending}>
              {createCharacter.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {createCharacter.isPending ? '添加中…' : '添加演员'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
