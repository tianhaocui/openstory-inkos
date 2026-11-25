/**
 * Credits Page
 * Balance, transactions, and gift codes in a single tabbed view
 */

import { RouteErrorFallback } from '@/ui/error/route-error-fallback';
import { BillingSettings } from '@/ui/settings/billing-settings';
import { GiftCodeSettings } from '@/ui/settings/gift-code-settings';
import { TransactionSettings } from '@/ui/settings/transaction-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/shadcn/tabs';
import { requireSessionOrRedirect } from '@/platform/ui/auth/route-guards';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import { Gift, Receipt, Wallet } from 'lucide-react';
import { z } from 'zod';

const tabValues = ['balance', 'transactions', 'gift-codes'] as const;

const searchSchema = z.object({
  tab: z.enum(tabValues).optional().default('balance'),
  success: z.boolean().optional(),
  canceled: z.boolean().optional(),
  session_id: z.string().max(256).optional(),
});

export const Route = createFileRoute('/_app/credits')({
  validateSearch: searchSchema,
  component: CreditsPage,
  beforeLoad: async ({ context: { queryClient }, location }) => {
    await requireSessionOrRedirect(queryClient, location.href);
  },
  staticData: { breadcrumb: i18n.t('nav.credits') },
  errorComponent: (props) => (
    <RouteErrorFallback {...props} heading={i18n.t('credits.pageError')} />
  ),
});

const tabs = [
  {
    value: 'balance' as const,
    label: 'credits.balance',
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    value: 'transactions' as const,
    label: 'settings.transactions',
    icon: <Receipt className="h-4 w-4" />,
  },
  {
    value: 'gift-codes' as const,
    label: 'credits.giftCodeLabel',
    icon: <Gift className="h-4 w-4" />,
  },
];

function CreditsPage() {
  const { t: translate } = useTranslation();
  const { tab, success, canceled, session_id: sessionId } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const parsed = z.enum(tabValues).safeParse(value);
          if (parsed.success) {
            void navigate({ to: '/credits', search: { tab: parsed.data } });
          }
        }}
      >
        <TabsList className="mb-6 w-full justify-start">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2"
            >
              {tab.icon}
              {translate(tab.label)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="balance">
          <BillingSettings
            success={success}
            canceled={canceled}
            sessionId={sessionId}
          />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionSettings />
        </TabsContent>
        <TabsContent value="gift-codes">
          <GiftCodeSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
