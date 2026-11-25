/**
 * Developer API Key Settings
 * Mint, view, and revoke keys that authenticate calls to the public OpenStory
 * API (`/api/v1/*`). Distinct from the "API Keys" tab, which manages a team's
 * provider keys (OpenRouter/Fal). The secret is shown exactly once, on creation.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/ui/shadcn/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/ui/shadcn/alert';
import { Button } from '@/ui/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/shadcn/card';
import { Input } from '@/ui/shadcn/input';
import { Skeleton } from '@/ui/shadcn/skeleton';
import { copyTextToClipboard } from '@/ui/clipboard';
import {
  createPublicApiKeyFn,
  listPublicApiKeysFn,
  revokePublicApiKeyFn,
} from '@/platform/public-api-keys.fn';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { Check, Copy, KeyRound, Trash2 } from 'lucide-react';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const PUBLIC_API_KEYS_QUERY_KEY = ['publicApiKeys'] as const;

const createFormSchema = z.object({
  name: z.string().min(1).max(32),
});

export function DeveloperApiKeySettings() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>API 访问</CardTitle>
            <CardDescription>
              创建用于调用 OpenStory API 的密钥。使用以下请求头进行身份验证：{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                Authorization: Bearer &lt;key&gt;
              </code>
              .
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <CreateKeyForm />
        <div className="border-t" />
        <Suspense fallback={<KeyListSkeleton />}>
          <KeyList />
        </Suspense>
      </CardContent>
    </Card>
  );
}

function CreateKeyForm() {
  const queryClient = useQueryClient();
  const [createdKey, setCreatedKey] = useState<{
    name: string;
    key: string;
  } | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: { name: string }) =>
      createPublicApiKeyFn({ data: input }),
    onSuccess: (result) => {
      setCreatedKey({ name: result.name, key: result.key });
      void queryClient.invalidateQueries({
        queryKey: PUBLIC_API_KEYS_QUERY_KEY,
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '创建密钥失败');
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = createFormSchema.safeParse(
      Object.fromEntries(new FormData(e.currentTarget))
    );
    if (!parsed.success) {
      toast.error('请输入名称（1 至 32 个字符）。');
      return;
    }
    createMutation.mutate({ name: parsed.data.name });
    e.currentTarget.reset();
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          name="name"
          placeholder="密钥名称（例如：生产服务器）"
          maxLength={32}
          autoComplete="off"
          required
        />
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? '创建中…' : '创建密钥'}
        </Button>
      </form>

      {createdKey && (
        <NewKeyReveal
          name={createdKey.name}
          apiKey={createdKey.key}
          onDismiss={() => setCreatedKey(null)}
        />
      )}
    </div>
  );
}

function NewKeyReveal({
  name,
  apiKey,
  onDismiss,
}: {
  name: string;
  apiKey: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!(await copyTextToClipboard(apiKey))) {
      // The key is shown exactly once, so a silent failure would lose it.
      toast.error('无法复制密钥', {
        description:
          '浏览器阻止了剪贴板访问。请在关闭此提示前选中上方密钥并手动复制。',
      });
      return;
    }
    setCopied(true);
    toast.success('已复制到剪贴板');
  };

  return (
    <Alert>
      <KeyRound className="h-4 w-4" />
      <AlertTitle>密钥“{name}”已创建</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>请立即复制。为保障安全，此密钥不会再次显示。</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">
            {apiKey}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void copy()}
            aria-label="复制 API 密钥"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            完成
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function KeyList() {
  const queryClient = useQueryClient();
  const { data: keys } = useSuspenseQuery({
    queryKey: PUBLIC_API_KEYS_QUERY_KEY,
    queryFn: () => listPublicApiKeysFn(),
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => revokePublicApiKeyFn({ data: { keyId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: PUBLIC_API_KEYS_QUERY_KEY,
      });
      toast.success('密钥已撤销');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '撤销密钥失败');
    },
  });

  if (keys.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        暂无 API 密钥。请在上方创建一个密钥以开始使用 API。
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {keys.map((key) => (
        <li
          key={key.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{key.name ?? '未命名密钥'}</p>
              <p className="text-xs text-muted-foreground">
                {key.start ? `${key.start}…` : 'osk_…'}
                {key.expiresAt
                  ? ` · 到期日期 ${new Date(key.expiresAt).toLocaleDateString()}`
                  : ' · 永不过期'}
                {key.lastRequest
                  ? ` · 最近使用于 ${new Date(key.lastRequest).toLocaleDateString()}`
                  : ' · 从未使用'}
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`撤销${key.name ?? '密钥'}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>撤销此 API 密钥？</AlertDialogTitle>
                <AlertDialogDescription>
                  所有使用“{key.name ?? '此密钥'}
                  ”的集成都将立即停止工作。此操作无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => revokeMutation.mutate(key.id)}
                >
                  撤销
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </li>
      ))}
    </ul>
  );
}

function KeyListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
