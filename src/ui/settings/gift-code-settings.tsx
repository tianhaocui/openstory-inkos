import { Alert, AlertDescription } from '@/ui/shadcn/alert';
import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/shadcn/card';
import { Input } from '@/ui/shadcn/input';
import { Label } from '@/ui/shadcn/label';
import { Skeleton } from '@/ui/shadcn/skeleton';
import { triggerBalanceFlash } from '@/billing/ui/use-balance-flash';
import { BILLING_BALANCE_KEY } from '@/billing/ui/use-billing-balance';
import { BILLING_GATE_KEY } from '@/billing/ui/use-billing-gate';
import { copyTextToClipboard } from '@/ui/clipboard';
import {
  batchCreateGiftTokensFn,
  createGiftTokenFn,
  isSystemAdminFn,
  listGiftTokensFn,
  redeemGiftTokenFn,
} from '@/billing/gift-tokens.fn';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Check, Copy, Gift, Layers, LinkIcon, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const RETURN_KEY = 'openstory:billing-return';

export function GiftCodeSettings() {
  const { data: adminStatus, isLoading: adminLoading } = useQuery({
    queryKey: ['system-admin-status'],
    queryFn: () => isSystemAdminFn(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      <RedeemSection />
      {adminLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : adminStatus?.isAdmin ? (
        <AdminSection />
      ) : null}
    </div>
  );
}

function RedeemSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const redeemMutation = useMutation({
    mutationFn: (input: { code: string }) => redeemGiftTokenFn({ data: input }),
    onSuccess: (result) => {
      setCode('');
      triggerBalanceFlash();
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_BALANCE_KEY],
      });
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_GATE_KEY],
      });

      const returnTo = localStorage.getItem(RETURN_KEY);
      if (returnTo) {
        localStorage.removeItem(RETURN_KEY);
        toast.success(`已向余额添加 $${result.amountUsd.toFixed(2)}`, {
          description: `新余额：$${result.newBalance.toFixed(2)}`,
          action: {
            label: '继续创作',
            onClick: () => void navigate({ to: returnTo }),
          },
          duration: 15_000,
        });
      } else {
        toast.success(`已向余额添加 $${result.amountUsd.toFixed(2)}`, {
          description: `新余额：$${result.newBalance.toFixed(2)}`,
        });
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '兑换礼品码失败');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    redeemMutation.mutate({ code: trimmed });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>兑换礼品码</CardTitle>
            <CardDescription>输入礼品码，为您的团队充值点数</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            name="code"
            placeholder="输入礼品码…"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono uppercase tracking-wider"
            maxLength={6}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <Button
            type="submit"
            disabled={!code.trim() || redeemMutation.isPending}
          >
            {redeemMutation.isPending ? '兑换中…' : '兑换'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AdminSection() {
  return (
    <>
      <BatchCreateCard />
      <CreateGiftCodeCard />
      <GiftCodeListCard />
    </>
  );
}

const INITIAL_BATCH_FORM = {
  count: '100',
  amount: '10',
  note: '',
  expiresInDays: '',
};

function BatchCreateCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(INITIAL_BATCH_FORM);
  const [createdCodes, setCreatedCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const updateField = (field: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const batchMutation = useMutation({
    mutationFn: (input: {
      count: number;
      amountUsd: number;
      note?: string;
      expiresInDays?: number;
    }) => batchCreateGiftTokensFn({ data: input }),
    onSuccess: (result) => {
      setCreatedCodes(result.codes);
      setForm(INITIAL_BATCH_FORM);
      void queryClient.invalidateQueries({ queryKey: ['gift-tokens'] });
      toast.success(`已创建 ${result.codes.length} 个礼品码`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '批量创建失败');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const countNum = parseInt(form.count, 10);
    const amountUsd = parseFloat(form.amount);
    if (isNaN(countNum) || countNum < 1 || countNum > 500) return;
    if (isNaN(amountUsd) || amountUsd <= 0) return;

    const parsedDays = parseInt(form.expiresInDays, 10);
    batchMutation.mutate({
      count: countNum,
      amountUsd,
      note: form.note || undefined,
      expiresInDays: parsedDays > 0 ? parsedDays : undefined,
    });
  };

  const handleCopyAll = async () => {
    if (!createdCodes) return;
    if (!(await copyTextToClipboard(createdCodes.join('\n')))) {
      toast.error('复制礼品码失败', {
        description: '浏览器阻止了剪贴板访问。请选择礼品码并手动复制。',
      });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>批量创建礼品码</CardTitle>
            <CardDescription>
              生成多个一次性礼品码（例如用于推广活动）
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="batch-count">数量</Label>
              <Input
                id="batch-count"
                type="number"
                min="1"
                max="500"
                step="1"
                placeholder="100"
                value={form.count}
                onChange={(e) => updateField('count', e.target.value)}
                className="tabular-nums"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-amount">金额（USD）</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="batch-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="10.00"
                  value={form.amount}
                  onChange={(e) => updateField('amount', e.target.value)}
                  className="pl-7 tabular-nums"
                  autoComplete="off"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-expires">有效期（天）</Label>
              <Input
                id="batch-expires"
                type="number"
                min="1"
                step="1"
                placeholder="永不过期"
                value={form.expiresInDays}
                onChange={(e) => updateField('expiresInDays', e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-note">备注</Label>
              <Input
                id="batch-note"
                placeholder="例如：推广活动批次…"
                value={form.note}
                onChange={(e) => updateField('note', e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={!form.count || !form.amount || batchMutation.isPending}
          >
            {batchMutation.isPending
              ? `正在创建 ${form.count} 个礼品码…`
              : `创建 ${form.count} 个礼品码`}
          </Button>
        </form>

        {createdCodes && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>已生成 {createdCodes.length} 个礼品码</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCopyAll()}
                className="gap-1.5"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? '已复制' : '全部复制'}
              </Button>
            </div>
            <textarea
              readOnly
              value={createdCodes.join('\n')}
              className="h-48 w-full resize-y rounded-md border bg-muted/50 p-3 font-mono text-sm tracking-wider"
              onClick={(e) => {
                if (e.target instanceof HTMLTextAreaElement) {
                  e.target.select();
                }
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const INITIAL_GIFT_FORM = {
  amount: '',
  maxRedemptions: '1',
  note: '',
  expiresInDays: '',
};

function CreateGiftCodeCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(INITIAL_GIFT_FORM);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const updateField = (field: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const createMutation = useMutation({
    mutationFn: (input: {
      amountUsd: number;
      maxRedemptions: number;
      note?: string;
      expiresInDays?: number;
    }) => createGiftTokenFn({ data: input }),
    onSuccess: (token) => {
      setCreatedCode(token.code);
      setForm(INITIAL_GIFT_FORM);
      void queryClient.invalidateQueries({ queryKey: ['gift-tokens'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '创建礼品码失败');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const amountUsd = parseFloat(form.amount);
    if (isNaN(amountUsd) || amountUsd <= 0) return;

    const parsedDays = parseInt(form.expiresInDays, 10);
    const parsedMax = parseInt(form.maxRedemptions, 10);
    createMutation.mutate({
      amountUsd,
      maxRedemptions: parsedMax > 0 ? parsedMax : 1,
      note: form.note || undefined,
      expiresInDays: parsedDays > 0 ? parsedDays : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>创建礼品码</CardTitle>
            <CardDescription>生成新的礼品码（仅限管理员）</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gift-amount">金额（USD）</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="gift-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="10.00"
                  value={form.amount}
                  onChange={(e) => updateField('amount', e.target.value)}
                  className="pl-7 tabular-nums"
                  autoComplete="off"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gift-max-redemptions">最多兑换次数</Label>
              <Input
                id="gift-max-redemptions"
                type="number"
                min="1"
                step="1"
                placeholder="1"
                value={form.maxRedemptions}
                onChange={(e) => updateField('maxRedemptions', e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gift-expires">有效期（天）</Label>
              <Input
                id="gift-expires"
                type="number"
                min="1"
                step="1"
                placeholder="永不过期"
                value={form.expiresInDays}
                onChange={(e) => updateField('expiresInDays', e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gift-note">备注（可选）</Label>
            <Input
              id="gift-note"
              placeholder="例如：Beta 测试者奖励…"
              value={form.note}
              onChange={(e) => updateField('note', e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            disabled={!form.amount || createMutation.isPending}
          >
            {createMutation.isPending ? '创建中…' : '创建礼品码'}
          </Button>
        </form>

        {createdCode && (
          <Alert>
            <AlertDescription className="flex items-center justify-between">
              <span>
                礼品码已创建：{' '}
                <span className="font-mono font-bold tracking-wider">
                  {createdCode}
                </span>
              </span>
              <div className="flex items-center gap-1">
                <CopyButton text={createdCode} />
                <CopyLinkButton code={createdCode} />
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function GiftCodeListCard() {
  const { data: tokens, isLoading } = useQuery({
    queryKey: ['gift-tokens'],
    queryFn: () => listGiftTokensFn(),
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>礼品码</CardTitle>
        <CardDescription>管理员创建的所有礼品码</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !tokens?.length ? (
          <p className="text-center text-muted-foreground py-4">暂无礼品码</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <GiftTokenRow key={token.id} token={token} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type GiftTokenRowProps = {
  token: {
    id: string;
    code: string;
    status: string;
    note: string | null;
    createdAt: Date | string;
    expiresAt: Date | string | null;
    amountUsd: number;
    maxRedemptions: number;
    redemptionCount: number;
  };
};

function GiftTokenRow({ token }: GiftTokenRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold tracking-wider">
            {token.code}
          </span>
          <StatusBadge status={token.status} />
          <span className="text-xs text-muted-foreground tabular-nums">
            {token.redemptionCount}/{token.maxRedemptions}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {[
            token.note,
            new Date(token.createdAt).toLocaleDateString(),
            token.expiresAt &&
              `到期日期 ${new Date(token.expiresAt).toLocaleDateString()}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <span className="text-sm font-semibold tabular-nums">
          ${token.amountUsd.toFixed(2)}
        </span>
        {token.status === 'available' && (
          <>
            <CopyButton text={token.code} />
            <CopyLinkButton code={token.code} />
          </>
        )}
      </div>
    </div>
  );
}

function getStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'available':
      return 'default';
    case 'fully_redeemed':
      return 'secondary';
    default:
      return 'destructive';
  }
}

function getStatusLabel(status: string): string {
  if (status === 'fully_redeemed') return '已全部兑换';
  if (status === 'available') return '可用';
  if (status === 'expired') return '已过期';
  if (status === 'disabled') return '已停用';
  return status;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={getStatusVariant(status)}>{getStatusLabel(status)}</Badge>
  );
}

function CopyLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/gift/${code}`;
    if (!(await copyTextToClipboard(url))) {
      toast.error('复制礼品链接失败');
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => void handleCopy()}
      aria-label="复制礼品链接"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <LinkIcon className="h-4 w-4" />
      )}
    </Button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await copyTextToClipboard(text))) {
      toast.error('复制礼品码失败');
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => void handleCopy()}
      aria-label="复制礼品码"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}
