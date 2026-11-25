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
import { Fingerprint, Key, Palette, Terminal } from 'lucide-react';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsLayout,
  beforeLoad: async ({ context: { queryClient }, location }) => {
    await requireSessionOrRedirect(queryClient, location.href);
  },
  staticData: {
    breadcrumb: { label: i18n.t('nav.settings'), to: '/settings' },
  },
  errorComponent: (props) => (
    <RouteErrorFallback
      {...props}
      error={
        new Error(i18n.t('settings.loadError'), {
          cause: props.error,
        })
      }
      heading={i18n.t('settings.pageError')}
    />
  ),
});

const tabs = [
  {
    value: 'appearance',
    label: 'settings.appearance',
    href: '/settings/appearance',
    icon: <Palette className="h-4 w-4" />,
  },
  {
    value: 'api-keys',
    label: 'settings.apiKeys',
    href: '/settings/api-keys',
    icon: <Key className="h-4 w-4" />,
  },
  {
    value: 'passkeys',
    label: 'settings.passkeys',
    href: '/settings/passkeys',
    icon: <Fingerprint className="h-4 w-4" />,
  },
  {
    value: 'developer',
    label: 'settings.developerShort',
    href: '/settings/developer',
    icon: <Terminal className="h-4 w-4" />,
  },
];

function SettingsLayout() {
  const { t } = useTranslation();
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
                {t(tab.label)}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Outlet />
    </div>
  );
}
