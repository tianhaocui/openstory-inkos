/**
 * Super-simple feedback dialog — one message field, send email + product event.
 * Works signed out too (the sidebar shows it to everyone): visitors get an
 * optional email field so we can reply.
 */

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
import { Textarea } from '@/ui/shadcn/textarea';
import { submitFeedbackFn } from '@/platform/feedback.fn';
import { useUser } from '@/platform/ui/use-user';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [message, setMessage] = useState('');
  const { data: user } = useUser();

  const mutation = useMutation({
    mutationFn: (input: { message: string; email?: string }) =>
      submitFeedbackFn({ data: input }),
    onSuccess: () => {
      setMessage('');
    },
  });

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setMessage('');
      mutation.reset();
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || mutation.isPending) return;
    const email = new FormData(e.currentTarget).get('email');
    mutation.mutate({
      message: trimmed,
      email: typeof email === 'string' ? email : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {mutation.isSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle>感谢</DialogTitle>
              <DialogDescription>
                我们已收到你的消息，会尽快阅读。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>完成</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>反馈</DialogTitle>
              <DialogDescription>
                Bug、想法或其他任何内容——发送一条简短消息。
              </DialogDescription>
            </DialogHeader>

            {!user && (
              <Input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                placeholder="邮箱（可选——如果你希望收到回复）"
                aria-label="邮箱（可选）"
              />
            )}

            <Textarea
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="有什么想说的？"
              rows={5}
              required
              maxLength={2000}
              className="min-h-28 resize-y"
            />

            {mutation.isError && (
              <p role="alert" className="text-sm text-destructive">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : '发送失败'}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || !message.trim()}
              >
                {mutation.isPending ? '发送中…' : '发送'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
