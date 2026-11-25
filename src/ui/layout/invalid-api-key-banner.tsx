import { Alert, AlertDescription } from '@/ui/shadcn/alert';
import { useBillingGateQuery } from '@/billing/ui/use-billing-gate';
import { Link } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';

export const InvalidApiKeyBanner: React.FC = () => {
  const { data } = useBillingGateQuery();
  if (!data?.openRouterKeyInvalid) return null;

  return (
    <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>
          你的 OpenRouter API 密钥无效。修复前，生成任务将暂时使用平台密钥。
        </span>
        <Link
          to="/settings/api-keys"
          className="shrink-0 font-medium underline"
        >
          前往设置修复 →
        </Link>
      </AlertDescription>
    </Alert>
  );
};
