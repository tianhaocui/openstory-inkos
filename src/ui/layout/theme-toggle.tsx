import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/shadcn/button';

/**
 * Light/dark theme switch for the app header.
 *
 * next-themes resolves the active theme in an effect, so rendering the real
 * icon during SSR would hydrate against a different icon on the client. The
 * mounted guard keeps the first client render identical to the server render
 * and only swaps in the resolved icon afterwards.
 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- SSR guard: sync with client hydration only.
    setMounted(true);
  }, []);

  const label = t('settings.toggleTheme', { defaultValue: '切换主题' });
  const isDark = resolvedTheme === 'dark';

  if (!mounted || !resolvedTheme) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        disabled
      >
        <Sun />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={isDark ? t('settings.lightMode') : t('settings.darkMode')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Moon /> : <Sun />}
    </Button>
  );
}
