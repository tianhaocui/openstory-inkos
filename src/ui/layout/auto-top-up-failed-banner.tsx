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

export const AutoTopUpFailedBanner: React.FC = () => {
  const { data } = useBillingGateQuery();
  if (!data?.autoTopUpFailed) return null;

  return (
    <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>
          自动充值已暂停，因为银行卡付款被拒绝。余额用尽后将无法继续生成内容。
        </span>
        <Link to="/credits" className="shrink-0 font-medium underline">
          更新银行卡 →
        </Link>
      </AlertDescription>
    </Alert>
  );
};
