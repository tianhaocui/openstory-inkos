/**
 * Appearance Settings Page
 * Theme (light/dark) and interface language, mirroring the user menu.
 */

import { createFileRoute } from '@tanstack/react-router';
import { Check, Languages, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/shadcn/card';
import { ToggleGroup, ToggleGroupItem } from '@/ui/shadcn/toggle-group';

export const Route = createFileRoute('/_app/settings/appearance')({
  component: AppearancePage,
  staticData: { breadcrumb: i18n.t('settings.appearance') },
});

function AppearancePage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes resolves theme from storage in an effect. Server and first
  // client render must agree, so the selection is only shown after mount.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- SSR guard: sync with client hydration only.
    setMounted(true);
  }, []);

  const activeTheme =
    mounted && (theme === 'light' || theme === 'dark') ? theme : '';

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.theme')}</CardTitle>
          <CardDescription>{t('settings.appearance')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            variant="outline"
            value={activeTheme}
            disabled={!mounted}
            onValueChange={(value) => {
              if (value === 'light' || value === 'dark') setTheme(value);
            }}
            className="w-full min-w-0 flex-nowrap justify-start"
          >
            <ToggleGroupItem
              value="light"
              className="flex min-w-0 flex-1 items-center justify-center gap-2"
            >
              <Sun />
              {t('settings.lightMode')}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="dark"
              className="flex min-w-0 flex-1 items-center justify-center gap-2"
            >
              <Moon />
              {t('settings.darkMode')}
            </ToggleGroupItem>
            {/* ThemeProvider runs with enableSystem={false}; keep the option
                visible for parity with the design but clearly unavailable. */}
            <ToggleGroupItem
              value="system"
              disabled
              className="flex min-w-0 flex-1 items-center justify-center gap-2"
            >
              <Monitor />
              {t('settings.systemMode')}
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="size-4" />
            {t('settings.interfaceLanguage')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            variant="outline"
            value="zh"
            className="w-full min-w-0 flex-nowrap justify-start"
          >
            <ToggleGroupItem
              value="zh"
              className="flex min-w-0 flex-1 items-center justify-center gap-2"
            >
              <Check />
              {t('settings.chineseCurrent')}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="en"
              disabled
              className="flex min-w-0 flex-1 items-center justify-center gap-2"
            >
              English
              <span className="text-xs text-muted-foreground">
                {t('settings.comingSoon')}
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>
    </div>
  );
}
