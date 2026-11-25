/**
 * API Key Settings Component
 * Manages BYOK (Bring Your Own Key) for OpenRouter, Fal.ai, xAI, Google and LLMTR
 */

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
import { FalLogo } from '@/ui/icons/fal-logo';
import { GoogleGIcon } from '@/ui/icons/google-g-icon';
import { LlmtrLogo } from '@/ui/icons/llmtr-logo';
import { OpenRouterLogo } from '@/ui/icons/openrouter-logo';
import { XIcon } from '@/ui/icons/x-icon';
import { Input } from '@/ui/shadcn/input';
import { Skeleton } from '@/ui/shadcn/skeleton';
import {
  checkApiKeyStatusFn,
  deleteApiKeyFn,
  listApiKeysFn,
  revalidateApiKeyFn,
  saveApiKeyFn,
} from '@/platform/api-keys.fn';
import { initiateOpenRouterOAuthFn } from '@/platform/openrouter-oauth.fn';
import { getCurrentUserProfileFn } from '@/platform/user.fn';
import { BILLING_GATE_KEY } from '@/billing/ui/use-billing-gate';
import { usePostHog } from '@posthog/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ExternalLink, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type ApiKeySettingsProps = {
  success?: string;
  error?: string;
};

type ApiKeyProviderId = 'openrouter' | 'fal' | 'xai' | 'google' | 'llmtr';
/** Providers whose key is pasted in — OpenRouter alone uses OAuth. */
type ManualProvider = Exclude<ApiKeyProviderId, 'openrouter'>;

const PROVIDER_LABELS: Record<ApiKeyProviderId, string> = {
  openrouter: 'OpenRouter',
  fal: 'fal.ai',
  xai: 'xAI',
  google: 'Google',
  llmtr: 'LLMTR',
};

export function ApiKeySettings(props: ApiKeySettingsProps) {
  const { data: profile } = useQuery({
    queryKey: ['currentUserProfile'],
    queryFn: () => getCurrentUserProfileFn(),
    staleTime: 5 * 60 * 1000,
  });

  if (!profile?.teamId) {
    return <ApiKeySettingsLoading />;
  }

  return <ApiKeySettingsContent teamId={profile.teamId} {...props} />;
}

function ApiKeySettingsLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-10 w-48" />
      </CardHeader>
      <CardContent className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

const RETURN_KEY = 'openstory:billing-return';

function ApiKeySettingsContent({
  teamId,
  success,
  error: urlError,
}: ApiKeySettingsProps & { teamId: string }) {
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const hasShownToastRef = useRef(false);

  const { data: apiKeys, isLoading: keysLoading } = useQuery({
    queryKey: ['apiKeys', teamId],
    queryFn: () => listApiKeysFn({ data: { teamId } }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: keyStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['apiKeyStatus', teamId],
    queryFn: () => checkApiKeyStatusFn({ data: { teamId } }),
    staleTime: 5 * 60 * 1000,
  });

  // Show toast once generation is covered and there's a return path. A fal
  // key alone is enough — LLM calls route through fal's OpenRouter endpoint.
  useEffect(() => {
    if (hasShownToastRef.current) return;
    if (keyStatus?.fal !== 'team') return;
    const returnTo = localStorage.getItem(RETURN_KEY);
    if (!returnTo) return;

    hasShownToastRef.current = true;
    localStorage.removeItem(RETURN_KEY);
    toast.success('API 密钥已配置', {
      description:
        keyStatus.openrouter === 'team'
          ? 'fal.ai 和 OpenRouter 都已连接。'
          : 'fal.ai 已连接——这已覆盖所有功能。',
      action: {
        label: '继续创作',
        onClick: () => void navigate({ to: returnTo }),
      },
      duration: 15_000,
    });
  }, [keyStatus, navigate]);

  const invalidateKeys = () => {
    void queryClient.invalidateQueries({ queryKey: ['apiKeys', teamId] });
    void queryClient.invalidateQueries({ queryKey: ['apiKeyStatus', teamId] });
    void queryClient.invalidateQueries({ queryKey: [...BILLING_GATE_KEY] });
  };

  const saveKeyMutation = useMutation({
    mutationFn: ({
      provider,
      apiKey,
    }: {
      provider: ManualProvider;
      apiKey: string;
    }) => saveApiKeyFn({ data: { teamId, provider, apiKey } }),
    onSuccess: (_, { provider }) => {
      invalidateKeys();
      setError(null);
      posthog.capture('api_key_saved', { provider });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '保存密钥失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (provider: ApiKeyProviderId) =>
      deleteApiKeyFn({ data: { teamId, provider } }),
    onSuccess: (_, provider) => {
      invalidateKeys();
      setError(null);
      posthog.capture('api_key_deleted', { provider });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '删除密钥失败');
    },
  });

  const oauthMutation = useMutation({
    mutationFn: () => initiateOpenRouterOAuthFn({ data: { teamId } }),
    onSuccess: (data) => {
      posthog.capture('openrouter_oauth_started');
      window.location.href = data.authUrl;
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '启动 OAuth 失败');
    },
  });

  const revalidateMutation = useMutation({
    mutationFn: (provider: ApiKeyProviderId) =>
      revalidateApiKeyFn({ data: { teamId, provider } }),
    onSuccess: (result, provider) => {
      // Only announce recovery — a key that was already valid (e.g. just
      // connected via OAuth) shouldn't toast "valid again" on page mount.
      const wasInvalid =
        apiKeys?.find((k) => k.provider === provider)?.isInvalid ?? false;
      invalidateKeys();
      if (result.valid && wasInvalid) {
        toast.success('密钥已重新验证', {
          description: `你的 ${PROVIDER_LABELS[provider]} 密钥现在有效。`,
        });
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '重新验证失败');
    },
  });

  const isLoading = keysLoading || statusLoading;

  const openrouterKey = apiKeys?.find((k) => k.provider === 'openrouter');
  const falKey = apiKeys?.find((k) => k.provider === 'fal');
  const xaiKey = apiKeys?.find((k) => k.provider === 'xai');
  const googleKey = apiKeys?.find((k) => k.provider === 'google');
  const llmtrKey = apiKeys?.find((k) => k.provider === 'llmtr');

  // Re-validate stored team keys on mount so opening the settings page
  // refreshes their validity without waiting for the next workflow failure.
  const revalidatedRef = useRef(false);
  useEffect(() => {
    if (revalidatedRef.current) return;
    if (!openrouterKey) return;
    revalidatedRef.current = true;
    revalidateMutation.mutate('openrouter');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openrouterKey?.id]);

  const successMessage =
    success === 'openrouter_connected' ? 'OpenRouter 连接成功。' : null;

  const errorMessage =
    urlError === 'openrouter_oauth_missing_code'
      ? 'OAuth 失败：缺少授权码。'
      : urlError === 'openrouter_oauth_no_team'
        ? 'OAuth 失败：未找到团队。'
        : urlError === 'openrouter_oauth_failed'
          ? 'OAuth 失败：无法连接到 OpenRouter。'
          : null;

  return (
    <div className="space-y-6">
      {successMessage && (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {(errorMessage || error) && (
        <Alert variant="destructive">
          <AlertDescription>{error || errorMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API 密钥</CardTitle>
          <CardDescription>
            使用你自己的密钥，直接向服务商付费。只需一个 fal.ai
            密钥即可覆盖所有功能——包括剧本分析。
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <ManualKeyRow
            provider="fal"
            icon={<FalLogo className="size-5" />}
            blurb="图像、视频和音频。也支持剧本分析。"
            placeholder="fal_..."
            keyUrl="https://fal.ai/dashboard/keys"
            existingKey={falKey}
            status={keyStatus?.fal}
            isLoading={isLoading}
            onSave={(apiKey) =>
              saveKeyMutation.mutate({ provider: 'fal', apiKey })
            }
            onDelete={() => deleteMutation.mutate('fal')}
            isSaving={saveKeyMutation.isPending}
            isDeleting={deleteMutation.isPending}
          />

          <ManualKeyRow
            provider="llmtr"
            icon={<LlmtrLogo className="size-5" />}
            blurb="土耳其托管网关：一个密钥访问 Claude、GPT、Gemini 和 Grok。"
            placeholder="llmtr-..."
            keyUrl="https://llmtr.com/dashboard/keys"
            existingKey={llmtrKey}
            status={keyStatus?.llmtr}
            isLoading={isLoading}
            onSave={(apiKey) =>
              saveKeyMutation.mutate({ provider: 'llmtr', apiKey })
            }
            onDelete={() => deleteMutation.mutate('llmtr')}
            isSaving={saveKeyMutation.isPending}
            isDeleting={deleteMutation.isPending}
          />

          <ManualKeyRow
            provider="xai"
            icon={<XIcon className="size-4" />}
            blurb="Grok 聊天、图像和视频，直接向 xAI 付费。"
            placeholder="xai-..."
            keyUrl="https://console.x.ai"
            existingKey={xaiKey}
            status={keyStatus?.xai}
            isLoading={isLoading}
            onSave={(apiKey) =>
              saveKeyMutation.mutate({ provider: 'xai', apiKey })
            }
            onDelete={() => deleteMutation.mutate('xai')}
            isSaving={saveKeyMutation.isPending}
            isDeleting={deleteMutation.isPending}
          />

          <ManualKeyRow
            provider="google"
            icon={<GoogleGIcon className="size-4" />}
            blurb="Gemini 聊天和 Omni Flash 视频，直接向 Google 付费。"
            placeholder="AIza..."
            keyUrl="https://aistudio.google.com/apikey"
            existingKey={googleKey}
            status={keyStatus?.google}
            isLoading={isLoading}
            onSave={(apiKey) =>
              saveKeyMutation.mutate({ provider: 'google', apiKey })
            }
            onDelete={() => deleteMutation.mutate('google')}
            isSaving={saveKeyMutation.isPending}
            isDeleting={deleteMutation.isPending}
          />

          {/* OpenRouter */}
          <div
            className={`flex flex-col gap-3 rounded-xl border p-4 ${
              openrouterKey?.isInvalid ? 'border-destructive' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <OpenRouterLogo className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">OpenRouter</h3>
                    {isLoading ? (
                      <Skeleton className="h-5 w-20" />
                    ) : openrouterKey?.isInvalid ? (
                      <Badge variant="destructive" className="text-xs">
                        无效
                      </Badge>
                    ) : (
                      <StatusBadge source={keyStatus?.openrouter} />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    可选——剧本分析会使用你的 fal.ai 密钥作为备选。
                  </p>
                </div>
              </div>
              {!isLoading &&
                (openrouterKey ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      ••••{openrouterKey.keyHint}
                    </span>
                    {openrouterKey.isInvalid && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => revalidateMutation.mutate('openrouter')}
                        disabled={revalidateMutation.isPending}
                        aria-label="重新验证 OpenRouter 密钥"
                      >
                        <RotateCcw
                          className={`h-4 w-4 ${revalidateMutation.isPending ? 'animate-spin' : ''}`}
                        />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate('openrouter')}
                      disabled={deleteMutation.isPending}
                      aria-label="删除 OpenRouter 密钥"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => oauthMutation.mutate()}
                    disabled={oauthMutation.isPending}
                    aria-label="连接 OpenRouter"
                  >
                    <ExternalLink className="mr-2 size-3.5" />
                    {oauthMutation.isPending ? '连接中…' : '连接'}
                  </Button>
                ))}
            </div>

            {openrouterKey?.isInvalid && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {openrouterKey.invalidReason || 'OpenRouter 拒绝了此密钥。'}{' '}
                  重新验证，或通过 OAuth 重新连接以替换它。
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => revalidateMutation.mutate('openrouter')}
                      disabled={revalidateMutation.isPending}
                    >
                      {revalidateMutation.isPending ? '检查中…' : '重新验证'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => oauthMutation.mutate()}
                      disabled={oauthMutation.isPending}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      重新连接
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * A provider whose key is pasted in rather than connected over OAuth. Both of
 * them render identically, so they share one row — OpenRouter keeps its own
 * block because the OAuth handshake makes it a different interaction.
 */
type ManualKeyRowProps = {
  provider: ManualProvider;
  icon: React.ReactNode;
  blurb: string;
  placeholder: string;
  keyUrl: string;
  existingKey?: { keyHint: string };
  status?: 'team' | 'platform' | 'none';
  isLoading: boolean;
  onSave: (apiKey: string) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
};

function ManualKeyRow({
  provider,
  icon,
  blurb,
  placeholder,
  keyUrl,
  existingKey,
  status,
  isLoading,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: ManualKeyRowProps) {
  const [value, setValue] = useState('');
  const label = PROVIDER_LABELS[provider];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setValue('');
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">{label}</h3>
              {isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <StatusBadge source={status} />
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{blurb}</p>
          </div>
        </div>
        {!isLoading && existingKey && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              ••••{existingKey.keyHint}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={isDeleting}
              aria-label={`删除 ${label} 密钥`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        !existingKey && (
          <div className="flex flex-col gap-2">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                name={`${provider}Key`}
                type="password"
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label={`${label} API 密钥`}
                required
              />
              <Button type="submit" disabled={isSaving || !value.trim()}>
                {isSaving ? '保存中…' : '保存'}
              </Button>
            </form>
            <a
              href={keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              从 {label} 获取密钥
              <ExternalLink className="size-3" />
            </a>
          </div>
        )
      )}
    </div>
  );
}

function StatusBadge({ source }: { source?: 'team' | 'platform' | 'none' }) {
  if (source === 'team') {
    return (
      <Badge variant="default" className="text-xs">
        您的密钥
      </Badge>
    );
  }
  if (source === 'platform') {
    return (
      <Badge variant="secondary" className="text-xs">
        平台密钥
      </Badge>
    );
  }
  return null;
}
