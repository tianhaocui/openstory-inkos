/**
 * Authorized apps — OAuth grants the user has approved (#1456): hosted MCP
 * clients, forks, anything that ran "login with OpenStory". Revoking deletes
 * the grant and its refresh tokens; the app has to ask again.
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
import { Button } from '@/ui/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/shadcn/card';
import { Skeleton } from '@/ui/shadcn/skeleton';
import {
  listAuthorizedAppsFn,
  revokeAuthorizedAppFn,
  type AuthorizedApp,
} from '@/platform/oauth-consent.fn';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { Suspense } from 'react';
import { toast } from 'sonner';

const AUTHORIZED_APPS_QUERY_KEY = ['authorizedApps'] as const;

const SCOPE_LABELS: Record<string, string> = {
  openid: '确认您的身份',
  profile: '查看您的姓名和头像',
  email: '查看您的邮箱地址',
  offline_access: '无需再次登录即可保持连接',
  'sequences:read': '查看您的故事序列、场景和已生成媒体',
  'sequences:write': '编辑故事序列和场景，并开始导出',
  generate: '发起会消耗点数的生成任务',
  'credits:read': '查看您的点数余额',
};

export function DeveloperAuthorizedApps() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>已授权应用</CardTitle>
            <CardDescription>
              您已使用 OpenStory
              账户登录的应用和代理。撤销授权后，应用需重新请求授权。
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<AppListSkeleton />}>
          <AppList />
        </Suspense>
      </CardContent>
    </Card>
  );
}

function AppListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

function AppList() {
  const { data: apps } = useSuspenseQuery({
    queryKey: AUTHORIZED_APPS_QUERY_KEY,
    queryFn: () => listAuthorizedAppsFn(),
  });

  if (apps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        暂无应用获得访问权限。当 MCP 客户端或其他应用请求使用 OpenStory
        登录时，它会显示在这里。
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {apps.map((app) => (
        <AppRow key={app.consentId} app={app} />
      ))}
    </ul>
  );
}

function AppRow({ app }: { app: AuthorizedApp }) {
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: () =>
      revokeAuthorizedAppFn({
        data: { consentId: app.consentId, clientId: app.client.clientId },
      }),
    onSuccess: () => {
      toast.success(`已撤销 ${app.client.name} 的访问权限`);
      void queryClient.invalidateQueries({
        queryKey: AUTHORIZED_APPS_QUERY_KEY,
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : '撤销授权失败'),
  });

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium">{app.client.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {app.client.redirectOrigin ?? app.client.clientId}
          {' · '}
          授权于 {app.createdAt.toLocaleDateString()}
        </span>
        <span className="text-xs text-muted-foreground">
          {app.scopes
            .map((s) => SCOPE_LABELS[s.id] ?? s.description)
            .join(' · ')}
        </span>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`撤销 ${app.client.name} 的访问权限`}
            disabled={revoke.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销 {app.client.name} 的授权？</AlertDialogTitle>
            <AlertDialogDescription>
              撤销后，该应用将无法获取新令牌，并需再次请求您登录。已签发的访问令牌最长仍可继续使用一小时。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => revoke.mutate()}>
              撤销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
