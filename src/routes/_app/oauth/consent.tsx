/**
 * /oauth/consent — approve an app's request for access (#1456).
 *
 * Better Auth sends the signed query to `/oauth/consent-start`, which packs it
 * into `q` and 302s here so TanStack cannot collapse repeated `ba_param`.
 *
 * Who is asking, for what, and which team the grant bills to load in the
 * route loader so the first HTML already has Approve — no client fetch, no
 * skeleton.
 */

import { Button } from '@/ui/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/shadcn/card';
import {
  decideOAuthConsentFn,
  getOAuthConsentContextFn,
  type OAuthConsentContext,
} from '@/platform/oauth-consent.fn';
import {
  consentPageHref,
  displayFieldsFromOAuthQuery,
  needsOAuthQueryPack,
  pickOAuthQuery,
  resolveOAuthQuery,
} from '@/platform/auth/oauth-query-snapshot';
import { requireSessionOrRedirect } from '@/platform/ui/auth/route-guards';
import { errorMessage } from '@/platform/errors';
import { useHydrated } from '@/ui/use-hydrated';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const CONSENT_STALE_MESSAGE = '此请求已失效。请返回应用重新发起授权。';

declare global {
  interface Window {
    __OPENSTORY_OAUTH_QUERY__?: string;
  }
}

/**
 * Prefer the incoming request URL (server) or a head-script snapshot (client)
 * over TanStack's parsed `location.search`. Packed `q` is immune to qss;
 * this still covers a stray hit on `/oauth/consent` with the raw signed query.
 */
const readConsentOAuthQuery = createIsomorphicFn()
  .server(() => new URL(getRequest().url).search)
  .client(() => window.__OPENSTORY_OAUTH_QUERY__ || window.location.search);

export const Route = createFileRoute('/_app/oauth/consent')({
  head: () => ({
    scripts: [
      {
        children:
          'window.__OPENSTORY_OAUTH_QUERY__=window.__OPENSTORY_OAUTH_QUERY__||window.location.search',
      },
    ],
  }),
  // One-shot signed request — don't background-refetch after SSR.
  staleTime: Infinity,
  loader: async () => {
    const oauthQuery = resolveOAuthQuery(readConsentOAuthQuery());
    const { clientId, scope, redirectUri } =
      displayFieldsFromOAuthQuery(oauthQuery);
    const consent: OAuthConsentContext | null = clientId
      ? await getOAuthConsentContextFn({
          data: { clientId, scope, redirectUri },
        })
      : null;
    return { oauthQuery, consent };
  },
  beforeLoad: async ({ context: { queryClient } }) => {
    const rawSearch = readConsentOAuthQuery();
    const href = consentPageHref(rawSearch);
    if (needsOAuthQueryPack(rawSearch)) {
      throw redirect({ href });
    }
    await requireSessionOrRedirect(queryClient, href);
  },
  component: ConsentPage,
  staticData: { breadcrumb: '应用授权' },
});

function ConsentPage() {
  const { oauthQuery: loaderQuery, consent } = Route.useLoaderData();
  const oauthQuery = pickOAuthQuery([
    resolveOAuthQuery(loaderQuery),
    typeof window !== 'undefined'
      ? resolveOAuthQuery(
          window.__OPENSTORY_OAUTH_QUERY__ || window.location.search
        )
      : undefined,
  ]);

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>应用授权</CardTitle>
          <CardDescription>
            一个应用希望使用你的 OpenStory 账户。请仅批准由你本人发起的请求。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {consent ? (
            <ConsentDecision consent={consent} oauthQuery={oauthQuery} />
          ) : (
            <p role="alert">
              此页面缺少授权请求。请返回将你带到此处的应用并重新发起授权。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConsentDecision({
  consent,
  oauthQuery,
}: {
  consent: OAuthConsentContext;
  oauthQuery: string;
}) {
  const hydrated = useHydrated();
  const [outcome, setOutcome] = useState<'granted' | 'denied' | null>(null);

  const decide = useMutation({
    // Suppress the global MutationCache toast — we render our own below.
    mutationFn: (accept: boolean) =>
      decideOAuthConsentFn({
        data: { accept, oauthQuery },
      }),
    onSuccess: ({ url }, accept) => {
      if (!url || (!/^https?:\/\//i.test(url) && !url.startsWith('/'))) {
        toast.error(CONSENT_STALE_MESSAGE);
        return;
      }
      setOutcome(accept ? 'granted' : 'denied');
      window.setTimeout(() => {
        window.location.assign(url);
      }, 800);
    },
    onError: (err) => {
      const text = errorMessage(err, CONSENT_STALE_MESSAGE).trim();
      toast.error(text || CONSENT_STALE_MESSAGE);
    },
  });

  if (!consent.client) {
    return (
      <p role="alert">
        此应用未在 OpenStory 注册，或其注册信息已过期。请返回应用重新发起授权。
      </p>
    );
  }

  if (outcome) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5" aria-hidden />
          <p className="font-semibold">
            {outcome === 'granted' ? '已授予访问权限' : '已拒绝请求'}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          你可以关闭此标签页。正在返回应用…
        </p>
      </div>
    );
  }

  const { client, scopes, team } = consent;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {client.logoUri ? (
          <img
            src={client.logoUri}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-md object-cover"
          />
        ) : null}
        <div className="flex flex-col">
          <span className="font-semibold">{client.name}</span>
          {client.redirectOrigin ? (
            <span className="text-sm text-muted-foreground">
              授权后将返回{' '}
              <code className="font-mono">{client.redirectOrigin}</code>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm">
          此应用将能代表团队 <strong>{team.name}</strong>：
        </p>
        <ul className="list-disc pl-5 text-sm">
          {scopes.length > 0 ? (
            scopes.map((s) => <li key={s.id}>{s.description}</li>)
          ) : (
            <li>确认你的身份</li>
          )}
        </ul>
      </div>

      <p className="text-sm text-muted-foreground">
        此应用生成的任何内容都会消耗该团队的额度。你可以随时在“设置 →
        开发者”中撤销访问权限。
      </p>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={!hydrated || decide.isPending}
          onClick={() => decide.mutate(false)}
        >
          拒绝
        </Button>
        <Button
          disabled={!hydrated || decide.isPending}
          onClick={() => decide.mutate(true)}
        >
          {!hydrated ? '加载中…' : decide.isPending ? '处理中…' : '批准'}
        </Button>
      </div>
    </div>
  );
}
