/**
 * /device — approve a device-code login (#1219). The agent shows the user a
 * short code and this URL; the user signs in, confirms the code, and approves.
 * Approval mints a normal API key, revocable under Settings → Developer.
 */

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
import {
  decideDeviceGrantFn,
  lookupDeviceGrantFn,
} from '@/platform/device-auth.fn';
import { requireSessionOrRedirect } from '@/platform/ui/auth/route-guards';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const searchSchema = z.object({ user_code: z.string().optional() });

export const Route = createFileRoute('/_app/device')({
  validateSearch: searchSchema,
  beforeLoad: async ({ context: { queryClient }, location }) => {
    await requireSessionOrRedirect(queryClient, location.href);
  },
  component: DevicePage,
  staticData: { breadcrumb: '设备登录' },
});

function DevicePage() {
  const { user_code } = Route.useSearch();
  const navigate = Route.useNavigate();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const field = new FormData(e.currentTarget).get('user_code');
    const code = typeof field === 'string' ? field : '';
    void navigate({ search: { user_code: code }, replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>设备登录</CardTitle>
          <CardDescription>
            输入代理或 CLI 显示的代码，授权其访问 OpenStory API。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={onSubmit} className="flex gap-2">
            <Input
              name="user_code"
              defaultValue={user_code ?? ''}
              placeholder="ABCD-EFGH"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono uppercase"
              required
            />
            <Button type="submit" variant="outline">
              检查
            </Button>
          </form>
          {user_code && (
            <Suspense fallback={<Skeleton className="h-20 w-full" />}>
              <GrantDecision userCode={user_code} />
            </Suspense>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GrantDecision({ userCode }: { userCode: string }) {
  const [decided, setDecided] = useState<'approved' | 'denied' | null>(null);
  const { data } = useSuspenseQuery({
    queryKey: ['deviceGrant', userCode],
    queryFn: () => lookupDeviceGrantFn({ data: { userCode } }),
  });
  const queryClient = useQueryClient();
  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      decideDeviceGrantFn({ data: { userCode, approve } }),
    onSuccess: ({ error }, approve) => {
      if (error) {
        toast.error(
          error === 'access_denied'
            ? '此代码由其他账户发起。请登录对应账户后再批准。'
            : '此代码已失效。请让代理重新生成代码。'
        );
        void queryClient.invalidateQueries({
          queryKey: ['deviceGrant', userCode],
        });
        return;
      }
      setDecided(approve ? 'approved' : 'denied');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : '出现错误，请重试'),
  });

  if (decided === 'approved') {
    return (
      <output className="block">
        已批准。请返回代理，它现在拥有一个名为“Agent
        login”的密钥。你可以随时在“设置 → 开发者”中撤销此密钥。
      </output>
    );
  }
  if (decided === 'denied') {
    return <output className="block">已拒绝。代理不会获得密钥。</output>;
  }
  if (data.status === 'approved' || data.status === 'denied') {
    return (
      <output className="block">
        代码 <code className="font-mono">{userCode}</code> 已经
        {data.status === 'approved' ? '批准' : '拒绝'}。
      </output>
    );
  }
  if (data.status === 'invalid') {
    return (
      <p role="alert">
        代码 <code className="font-mono">{userCode}</code>{' '}
        无效或已过期。请检查后重试，或让代理重新生成代码。
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p>
        是否向显示代码{' '}
        <code className="font-mono font-semibold">{userCode}</code>{' '}
        的设备授予团队 <strong>{data.teamName}</strong> 的 API
        密钥？请仅批准由你本人发起的代码。
      </p>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={decide.isPending}
          onClick={() => decide.mutate(false)}
        >
          拒绝
        </Button>
        <Button disabled={decide.isPending} onClick={() => decide.mutate(true)}>
          {decide.isPending ? '处理中…' : '批准'}
        </Button>
      </div>
    </div>
  );
}
