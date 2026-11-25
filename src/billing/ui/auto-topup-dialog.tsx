/**
 * Auto Top-Up Dialog (#1099)
 * "Auto-reload credits" modal: enable toggle, the balance that triggers a
 * reload, the amount added, and the resulting charge. Opened from the
 * "Modify" button in billing settings.
 */

import { Button } from '@/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/shadcn/dialog';
import { Input } from '@/ui/shadcn/input';
import { Label } from '@/ui/shadcn/label';
import { Separator } from '@/ui/shadcn/separator';
import { Switch } from '@/ui/shadcn/switch';
import { updateAutoTopUpFn } from '@/billing/billing.fn';
import { BILLING_BALANCE_KEY, useBillingBalance } from './use-billing-balance';
import { BILLING_GATE_KEY } from './use-billing-gate';
import {
  formatPlatformFeePercent,
  MAX_TOPUP_AMOUNT_USD,
  MIN_TOPUP_AMOUNT_USD,
  splitCheckoutAmounts,
} from '@/billing/constants';
import { usePostHog } from '@posthog/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type AutoTopUpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type AmountFieldProps = {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

const AmountField: React.FC<AmountFieldProps> = ({
  id,
  label,
  value,
  disabled,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4">
    <Label htmlFor={id} className="shrink-0 font-normal">
      {label}
    </Label>
    <div className="relative w-40">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        $
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        className="pl-7 tabular-nums"
        autoComplete="off"
      />
    </div>
  </div>
);

export function AutoTopUpDialog({ open, onOpenChange }: AutoTopUpDialogProps) {
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const { data: balanceData } = useBillingBalance();

  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState('5');
  const [amount, setAmount] = useState('100');
  const [error, setError] = useState<string | null>(null);

  // Seed from saved settings on the OPEN transition only. Keying this on
  // `balanceData` would re-run on every balance refetch (staleTime 30s, plus
  // realtime invalidation on each generation) and wipe in-progress edits.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current && balanceData) {
      setEnabled(balanceData.autoTopUp.enabled);
      setThreshold(String(balanceData.autoTopUp.thresholdUsd ?? 5));
      setAmount(String(balanceData.autoTopUp.amountUsd ?? 100));
      setError(null);
      wasOpen.current = true;
    } else if (!open) {
      wasOpen.current = false;
    }
  }, [open, balanceData]);

  const thresholdUsd = parseFloat(threshold);
  const amountUsd = parseFloat(amount);
  const isValid =
    !enabled ||
    (!isNaN(thresholdUsd) &&
      !isNaN(amountUsd) &&
      thresholdUsd >= 0 &&
      thresholdUsd <= MAX_TOPUP_AMOUNT_USD &&
      amountUsd >= MIN_TOPUP_AMOUNT_USD &&
      amountUsd <= MAX_TOPUP_AMOUNT_USD &&
      // Otherwise the reload lands back under the threshold and re-triggers.
      amountUsd > thresholdUsd);
  const chargeBreakdown =
    enabled && isValid ? splitCheckoutAmounts(amountUsd) : null;

  const mutation = useMutation({
    mutationFn: () =>
      updateAutoTopUpFn({
        data: {
          enabled,
          ...(enabled && { thresholdUsd, amountUsd }),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_BALANCE_KEY],
      });
      void queryClient.invalidateQueries({ queryKey: [...BILLING_GATE_KEY] });
      if (enabled) {
        posthog.capture('auto_topup_enabled', {
          threshold_usd: thresholdUsd,
          amount_usd: amountUsd,
        });
      }
      toast.success(enabled ? '已启用自动充值' : '已停用自动充值');
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '更新自动充值设置失败');
    },
  });

  const handleSave = () => {
    if (!isValid) {
      setError(
        `请输入 $${MIN_TOPUP_AMOUNT_USD} 至 $${MAX_TOPUP_AMOUNT_USD.toLocaleString()} 之间，且高于触发余额的金额`
      );
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>自动充值点数</DialogTitle>
          <DialogDescription className="sr-only">
            余额不足时自动充值点数。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="auto-topup-enabled">启用自动充值</Label>
            <Switch
              id="auto-topup-enabled"
              checked={enabled}
              onCheckedChange={(value) => {
                setEnabled(value);
                setError(null);
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            余额不足时自动充值点数。
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <AmountField
            id="auto-topup-threshold"
            label="余额降至："
            value={threshold}
            disabled={!enabled}
            onChange={(value) => {
              setThreshold(value);
              setError(null);
            }}
          />
          <AmountField
            id="auto-topup-amount"
            label="充值金额："
            value={amount}
            disabled={!enabled}
            onChange={(value) => {
              setAmount(value);
              setError(null);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Separator />
          <div className="flex items-center justify-between gap-4 text-sm tabular-nums">
            <span className="text-muted-foreground">扣款金额：</span>
            <span>
              {chargeBreakdown
                ? `$${chargeBreakdown.totalUsd.toFixed(2)}`
                : '—'}
            </span>
          </div>
          {chargeBreakdown && (
            <p className="text-xs text-muted-foreground">
              包含 {formatPlatformFeePercent()} 的平台费。每当余额降至 $
              {thresholdUsd.toFixed(2)} 时收取。
            </p>
          )}
          <Separator />
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !isValid}
          >
            {mutation.isPending ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
