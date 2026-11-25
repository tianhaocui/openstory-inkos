/**
 * Billing Settings Component
 * Credit balance, add-credits + auto-top-up dialogs, and invoices (#1099).
 * Purchasing happens in the AddCreditsDialog / AutoTopUpDialog modals, which
 * this page opens. The one exception is the post-checkout "Enable
 * auto-reload?" prompt below, which writes settings directly.
 */

import { AutoTopUpDialog } from '@/billing/ui/auto-topup-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/ui/shadcn/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { Switch } from '@/ui/shadcn/switch';
import {
  getTransactionsFn,
  reportCheckoutCanceledFn,
  updateAutoTopUpFn,
} from '@/billing/billing.fn';
import { openAddCreditsDialog } from '@/billing/ui/use-add-credits-dialog';
import { clearBalanceFlash } from '@/billing/ui/use-balance-flash';
import {
  BILLING_BALANCE_KEY,
  useBillingBalance,
} from '@/billing/ui/use-billing-balance';
import { BILLING_GATE_KEY } from '@/billing/ui/use-billing-gate';
import { useShowCosts } from '@/billing/ui/use-show-costs';
import { MIN_TOPUP_AMOUNT_USD } from '@/billing/constants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  AlertCircle,
  CreditCard,
  ExternalLink,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type BillingSettingsProps = {
  success?: boolean;
  canceled?: boolean;
  sessionId?: string;
};

type SectionHeaderProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: SectionHeaderProps & { action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
      {action}
    </div>
  );
}

function getErrorMessage(
  error: string | null,
  balanceError: Error | null
): string {
  if (error) return error;
  if (balanceError instanceof Error) return balanceError.message;
  return '出现错误';
}

const RETURN_KEY = 'openstory:billing-return';

export function BillingSettings({
  success,
  canceled,
  sessionId,
}: BillingSettingsProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [autoTopUpPrompt, setAutoTopUpPrompt] = useState<number | null>(null);
  const [autoTopUpDialogOpen, setAutoTopUpDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Handle checkout return — runs once when returning from Stripe with success or canceled params
  const checkoutHandledRef = useRef(false);
  useEffect(() => {
    if (checkoutHandledRef.current || (!success && !canceled)) return;
    checkoutHandledRef.current = true;

    // Clear pending flash marker on cancel
    if (canceled) {
      clearBalanceFlash();
      if (sessionId) {
        void reportCheckoutCanceledFn({ data: { sessionId } });
      }
    }

    // Refetch balance + show return toast on success
    if (success) {
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_BALANCE_KEY],
      });
      void queryClient.invalidateQueries({
        queryKey: ['billing-invoices'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_GATE_KEY],
      });

      const returnTo = localStorage.getItem(RETURN_KEY);
      if (returnTo) {
        localStorage.removeItem(RETURN_KEY);
        toast.success('点数充值成功', {
          description: '您的余额已更新。',
          action: {
            label: '继续创作',
            onClick: () => void navigate({ to: returnTo }),
          },
          duration: 15_000,
        });
      }
    }

    // Clear success/canceled from URL after showing
    const timer = setTimeout(() => {
      window.history.replaceState({}, '', '/credits');
    }, 5000);
    return () => clearTimeout(timer);
  }, [success, canceled, sessionId, queryClient, navigate]);

  const {
    data: balanceData,
    isLoading: balanceLoading,
    error: balanceError,
  } = useBillingBalance();

  // After successful top-up, prompt to enable auto-topup if not already on
  useEffect(() => {
    if (!success || balanceLoading || !balanceData) return;
    if (balanceData.autoTopUp.enabled) return;

    const lastAmount = localStorage.getItem('openstory:last-topup-amount');
    localStorage.removeItem('openstory:last-topup-amount');
    const amount = lastAmount ? parseFloat(lastAmount) : null;
    if (amount && !isNaN(amount) && amount >= MIN_TOPUP_AMOUNT_USD) {
      setAutoTopUpPrompt(amount);
    }
  }, [success, balanceLoading, balanceData]);

  const stripeEnabled = balanceData?.stripeEnabled ?? false;

  const {
    data: invoiceData,
    isLoading: invoicesLoading,
    error: invoicesError,
  } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () =>
      getTransactionsFn({
        data: { type: 'credit_purchase', limit: 10, offset: 0 },
      }),
    staleTime: 5 * 60 * 1000,
  });

  const autoTopUpMutation = useMutation({
    mutationFn: (body: {
      enabled: boolean;
      thresholdUsd?: number;
      amountUsd?: number;
    }) => updateAutoTopUpFn({ data: body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_BALANCE_KEY],
      });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '更新自动充值设置失败');
    },
  });

  const autoTopUpThreshold =
    autoTopUpPrompt !== null ? Math.ceil((autoTopUpPrompt * 0.1) / 5) * 5 : 5;

  return (
    <div className="space-y-6">
      {success && (
        <Alert className="mb-4">
          <AlertDescription>点数充值成功。您的余额已更新。</AlertDescription>
        </Alert>
      )}

      {canceled && (
        <Alert className="mb-4">
          <AlertDescription>充值已取消，未产生任何费用。</AlertDescription>
        </Alert>
      )}

      <AlertDialog open={autoTopUpPrompt !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>启用自动充值？</AlertDialogTitle>
            <AlertDialogDescription>
              当余额低于 ${autoTopUpThreshold} 时，自动充值至 ${autoTopUpPrompt}
              。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAutoTopUpPrompt(null)}>
              不用了，谢谢
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                autoTopUpMutation.mutate({
                  enabled: true,
                  thresholdUsd: autoTopUpThreshold,
                  amountUsd: autoTopUpPrompt ?? 0,
                });
                setAutoTopUpPrompt(null);
              }}
              disabled={autoTopUpMutation.isPending}
            >
              {autoTopUpMutation.isPending ? '启用中…' : '启用自动充值'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(error || balanceError || invoicesError) && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {getErrorMessage(error, balanceError)}
          </AlertDescription>
        </Alert>
      )}

      {/* Balance Card */}
      <Card>
        <CardHeader>
          <SectionHeader
            icon={Wallet}
            title="点数余额"
            description="按服务商成本计费的 AI 生成随用随付钱包"
            action={
              stripeEnabled ? (
                <Button
                  onClick={() => openAddCreditsDialog('billing_settings')}
                >
                  充值点数
                </Button>
              ) : undefined
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {balanceLoading ? (
            <Skeleton className="h-12 w-32" />
          ) : (
            <p className="text-4xl font-bold tabular-nums">
              $
              {(balanceData?.availableUsd ?? balanceData?.balance)?.toFixed(
                2
              ) ?? '0.00'}
            </p>
          )}
          <ShowCostsToggle />
        </CardContent>
      </Card>

      {!stripeEnabled && !balanceLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              可通过礼品码充值点数。
            </p>
            <div className="pt-2">
              <Link
                to="/credits"
                search={{ tab: 'transactions' }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                查看全部交易记录
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {stripeEnabled && (
        <>
          {/* Auto-reload */}
          <Card>
            <CardHeader>
              <SectionHeader
                icon={RefreshCw}
                title="自动充值"
                description="余额不足时自动充值点数"
                action={
                  balanceData?.hasPaymentMethod ? (
                    <Button
                      variant="outline"
                      onClick={() => setAutoTopUpDialogOpen(true)}
                    >
                      修改
                    </Button>
                  ) : undefined
                }
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {balanceLoading ? (
                <Skeleton className="h-5 w-64" />
              ) : !balanceData?.hasPaymentMethod ? (
                <p className="text-sm text-muted-foreground">
                  保存银行卡（不会扣款）或完成一次购买，即可启用自动充值。
                </p>
              ) : balanceData.autoTopUp.enabled ? (
                <p className="text-sm text-muted-foreground tabular-nums">
                  当余额低于 ${balanceData.autoTopUp.thresholdUsd?.toFixed(2)}
                  时，充值 ${balanceData.autoTopUp.amountUsd?.toFixed(2)}。
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">已关闭</p>
              )}
              {balanceData?.autoTopUp.lastFailure && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>自动充值失败，请更新银行卡</AlertTitle>
                  <AlertDescription>
                    银行卡被拒绝后，我们已暂停自动充值。请添加有效的付款方式以恢复。
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <AutoTopUpDialog
            open={autoTopUpDialogOpen}
            onOpenChange={setAutoTopUpDialogOpen}
          />

          {/* Invoices */}
          <Card>
            <CardHeader>
              <SectionHeader
                icon={CreditCard}
                title="账单"
                description="近期购买记录"
              />
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : invoiceData?.transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  暂无购买记录
                </p>
              ) : (
                <div className="space-y-2">
                  {invoiceData?.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.description?.replace(/^Top-up:/, '充值：') ??
                            '购买点数'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <span className="text-sm font-semibold tabular-nums text-green-600 dark:text-green-400">
                          +${tx.amount.toFixed(2)}
                        </span>
                        {tx.metadata?.receiptUrl && (
                          <a
                            href={tx.metadata.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="查看收据"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 text-center">
                    <Link
                      to="/credits"
                      search={{ tab: 'transactions' }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      查看全部交易记录
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ShowCostsToggle() {
  const { showCosts, setShowCosts } = useShowCosts();

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <div>
        <p className="text-sm font-medium">显示费用</p>
        <p className="text-xs text-muted-foreground">
          在侧边栏显示余额，并在生成操作下显示预估费用
        </p>
      </div>
      <Switch
        checked={showCosts}
        onCheckedChange={setShowCosts}
        aria-label="显示费用"
      />
    </div>
  );
}
