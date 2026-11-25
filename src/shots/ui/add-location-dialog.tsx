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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/shadcn/select';
import { Textarea } from '@/ui/shadcn/textarea';
import { useCreateSequenceLocation } from '@/cast/ui/use-sequence-locations';
import { errorMessage } from '@/platform/errors';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.enum(['interior', 'exterior', 'both']),
  description: z.string().max(2000),
});

/**
 * Manual location create (#1108 Phase 2) — name/type plus an optional
 * description; the full bible is edited on the location's detail page, and
 * the reference image comes later via recast.
 */
export const AddLocationDialog: React.FC<{ sequenceId: string }> = ({
  sequenceId,
}) => {
  const [open, setOpen] = useState(false);
  const createLocation = useCreateSequenceLocation();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = createLocationSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget))
    );
    if (!result.success) {
      toast.error('请检查场景字段', {
        description: result.error.issues[0]?.message,
      });
      return;
    }
    createLocation.mutate(
      { sequenceId, ...result.data },
      {
        onSuccess: (location) => {
          setOpen(false);
          toast.success(`Added ${location.name}`);
        },
        onError: (error) =>
          toast.error('添加场景失败', {
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
          添加场景
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加场景</DialogTitle>
          <DialogDescription>
            填写完整场景设定，并可在场景详情页生成参考图。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-location-name">名称</Label>
            <Input id="new-location-name" name="name" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-location-type">类型</Label>
            <Select
              name="type"
              defaultValue="interior"
              items={{
                interior: '内景',
                exterior: '外景',
                both: '内外景',
              }}
            >
              <SelectTrigger id="new-location-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interior">内景</SelectItem>
                <SelectItem value="exterior">外景</SelectItem>
                <SelectItem value="both">内外景</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-location-description">描述（可选）</Label>
            <Textarea
              id="new-location-description"
              name="description"
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={createLocation.isPending}>
              {createLocation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {createLocation.isPending ? '添加中…' : '添加场景'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
