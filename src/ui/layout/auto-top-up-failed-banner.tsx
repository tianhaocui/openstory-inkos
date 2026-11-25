/**
 * App-wide notice that auto-reload is paused after a card decline (#1499).
 *
 * The Settings → Billing alert only reaches someone who already went
 * looking. This one meets a user mid-generation, wherever they are.
 */

import { Alert, AlertDescription } from '@/ui/shadcn/alert';
import { useBillingGateQuery } from '@/billing/ui/use-billing-gate';
import { Link } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const AutoTopUpFailedBanner: React.FC = () => {
  const { t } = useTranslation();
  const { data } = useBillingGateQuery();
  if (!data?.autoTopUpFailed) return null;

  return (
    <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{t('credits.autoTopUpFailed')}</span>
        <Link to="/credits" className="shrink-0 font-medium underline">
          {t('credits.updateCard')}
        </Link>
      </AlertDescription>
    </Alert>
  );
};
