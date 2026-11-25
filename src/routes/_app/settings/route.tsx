/**
 * Settings Layout Route
 * Provides tab navigation between settings sub-pages
 */

import { RouteErrorFallback } from '@/ui/error/route-error-fallback';
import { Tabs, TabsList, TabsTrigger } from '@/ui/shadcn/tabs';
import { requireSessionOrRedirect } from '@/platform/ui/auth/route-guards';
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from '@tanstack/react-router';
import { Fingerprint, Key, Terminal } from 'lucide-react';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsLayout,
  beforeLoad: async ({ context: { queryClient }, location }) => {
    await requireSessionOrRedirect(queryClient, location.href);
  },
  staticData: { breadcrumb: { label: '设置', to: '/settings' } },
  errorComponent: (props) => (
    <RouteErrorFallback
      {...props}
      error={
        new Error('暂时无法加载设置，请稍后重试。', {
          cause: props.error,
        })
      }
      heading="设置页面出现错误"
    />
  ),
});

const tabs = [
  {
    value: 'api-keys',
    label: 'API 密钥',
    href: '/settings/api-keys',
    icon: <Key className="h-4 w-4" />,
  },
  {
    value: 'passkeys',
    label: '通行密钥',
    href: '/settings/passkeys',
    icon: <Fingerprint className="h-4 w-4" />,
  },
  {
    value: 'developer',
    label: '开发者',
    href: '/settings/developer',
    icon: <Terminal className="h-4 w-4" />,
  },
];

function SettingsLayout() {
  const location = useLocation();

  // Determine active tab from current route
  const activeTab =
    tabs.find((tab) => location.pathname === tab.href)?.value || 'api-keys';

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Tabs value={activeTab} className="mb-6 shrink-0">
        <TabsList className="w-full justify-start">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} asChild>
              <Link to={tab.href} className="flex items-center gap-2">
                {tab.icon}
                {tab.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Outlet />
    </div>
  );
}
