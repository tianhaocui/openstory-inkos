/**
 * Auth Layout
 * Layout for authentication pages (login, verify)
 */

import { RouteErrorFallback } from '@/ui/error/route-error-fallback';
import { sessionQueryOptions } from '@/platform/ui/auth/session-query';
import { getAuthOptionsFn } from '@/platform/auth-options.fn';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
  errorComponent: (props) => (
    <RouteErrorFallback
      {...props}
      error={
        new Error('暂时无法加载登录服务，请稍后重试。', {
          cause: props.error,
        })
      }
      heading="登录服务出现错误"
    />
  ),
  beforeLoad: async ({ context: { queryClient } }) => {
    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    if (session?.user) {
      throw redirect({ to: '/' });
    }

    const authOptions = await getAuthOptionsFn();
    return { session, authOptions };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <Outlet />
    </div>
  );
}
