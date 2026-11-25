/**
 * Login Form Component
 * Email/password and email OTP authentication with optional Google OAuth.
 */

import { Alert, AlertDescription } from '@/ui/shadcn/alert';
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
import type { AuthOptions } from '@/platform/auth-options.fn';
import { authClient } from './client';
import { DEV_OTP_CODE } from '@/platform/auth/dev-otp';
import { finishSignInRedirect, sanitizeAuthRedirect } from './navigation';
import { usePostHog } from '@posthog/react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { getLogger } from '@/platform/logger';

const logger = getLogger(['openstory', 'ui', 'auth', 'auth-form']);

type AuthFormProps = {
  emailEntered?: string;
  redirectTo?: string;
  /**
   * Server-reported sign-in options (getAuthOptionsFn) — resolved in the
   * /_auth route's beforeLoad (or the auth-gate dialog's query) so the form
   * renders the right options on first paint. Defaults to everything off.
   */
  authOptions?: AuthOptions;
};

export function AuthForm({
  emailEntered,
  redirectTo = '/',
  authOptions,
}: AuthFormProps) {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [email, setEmail] = useState(emailEntered || '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleAuthEnabled = authOptions?.googleAuthEnabled ?? false;
  // Dev only: the server stamps the fixed OTP (no EMAIL_FROM set), so the
  // form signs straight in and shows the zero-friction note. The
  // `import.meta.env.DEV` guard DCE's the branch from production builds.
  const devFixedOtpActive =
    import.meta.env.DEV && (authOptions?.devFixedOtp ?? false);

  // Preload passkeys for conditional UI (browser autofill)
  useEffect(() => {
    let cancelled = false;

    const preloadPasskeys = async () => {
      if (
        // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- runtime guard: method may not exist in all browsers
        !window.PublicKeyCredential?.isConditionalMediationAvailable ||
        !(await window.PublicKeyCredential.isConditionalMediationAvailable())
      ) {
        return;
      }
      if (cancelled) return;

      const result = await authClient.signIn.passkey({
        autoFill: true,
      });

      // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- cancelled can be set true by cleanup between awaits
      if (!cancelled && result.data) {
        void finishSignInRedirect(navigate, redirectTo);
      }
    };
    void preloadPasskeys().catch((error: unknown) => {
      logger.debug('Passkey preload skipped', {
        err: error instanceof Error ? error.message : String(error),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [navigate, redirectTo]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    posthog.capture('user_otp_requested', { email });

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });

      if (result.error) {
        setError('验证码发送失败，请稍后重试。');
        setIsLoading(false);
        return;
      }

      // Local dev: the server stamps a fixed OTP (see devFixedOtp in
      // src/platform/server/auth/config.ts), so sign in straight away and skip the verify
      // page — no code typed at all. Eliminated from production builds
      // (`import.meta.env.DEV` in devFixedOtpActive define-replaced with
      // false). A failed attempt falls through to the verify page.
      if (devFixedOtpActive) {
        const signIn = await authClient.signIn.emailOtp({
          email,
          otp: DEV_OTP_CODE,
        });
        if (!signIn.error) {
          // user_signed_in is captured server-side on session create (#1088).
          await finishSignInRedirect(navigate, redirectTo);
          return;
        }
        logger.warn('Dev fixed-OTP sign-in failed; falling back to verify', {
          error: signIn.error,
        });
      }

      // Navigate to verify page with email in search params
      await navigate({
        to: '/verify',
        search: { email, redirectTo },
      });
    } catch (err) {
      logger.error('Send OTP error:', { err });
      setError('验证码发送失败，请稍后重试。');
      setIsLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const callbackURL = sanitizeAuthRedirect(redirectTo);
      const result = isSignUp
        ? await authClient.signUp.email({
            name: name.trim() || email.split('@')[0] || 'OpenStory 用户',
            email,
            password,
            callbackURL,
          })
        : await authClient.signIn.email({
            email,
            password,
            callbackURL,
          });

      if (result.error) {
        setError(
          isSignUp
            ? '注册失败，请检查信息后重试。'
            : '登录失败，请检查邮箱和密码。'
        );
        return;
      }

      await finishSignInRedirect(navigate, redirectTo);
    } catch (err) {
      logger.error('Password authentication error:', { err });
      setError('认证服务暂时不可用，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    posthog.capture('user_google_sign_in_started');

    try {
      // Strip #compose (and any other hash) — better-auth 403s hashy relative
      // callbackURLs. Style seed lives in ?style= so the composer still restores.
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: sanitizeAuthRedirect(redirectTo),
      });
    } catch (err) {
      logger.error('Google sign-in error:', { err });
      setError('无法使用 Google 登录，请稍后重试。');
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>欢迎</CardTitle>
        <CardDescription>登录或创建账号</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <Button
            type="button"
            size="sm"
            variant={authMode === 'password' ? 'default' : 'ghost'}
            aria-pressed={authMode === 'password'}
            onClick={() => {
              setAuthMode('password');
              setError(null);
            }}
            disabled={isLoading}
          >
            密码登录
          </Button>
          <Button
            type="button"
            size="sm"
            variant={authMode === 'otp' ? 'default' : 'ghost'}
            aria-pressed={authMode === 'otp'}
            onClick={() => {
              setAuthMode('otp');
              setError(null);
            }}
            disabled={isLoading}
          >
            邮箱验证码
          </Button>
        </div>

        {authMode === 'password' && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {isSignUp ? '创建一个新账号' : '使用账号密码登录'}
            </span>
            <button
              type="button"
              className="text-primary underline underline-offset-4"
              onClick={() => {
                setIsSignUp((current) => !current);
                setError(null);
              }}
              disabled={isLoading}
            >
              {isSignUp ? '已有账号？登录' : '注册账号'}
            </button>
          </div>
        )}

        {/* Google OAuth — only where the server has the secrets configured */}
        {googleAuthEnabled && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleGoogleSignIn()}
              disabled={isLoading}
            >
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                aria-label="Google 标志"
              >
                <title>Google</title>
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              使用 Google 继续
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  或
                </span>
              </div>
            </div>
          </>
        )}

        {/* Email/password or OTP form */}
        <form
          className="space-y-4"
          onSubmit={(e) =>
            void (authMode === 'password'
              ? handlePasswordAuth(e)
              : handleSendOtp(e))
          }
        >
          {authMode === 'password' && isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="你的名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          )}
          <div className="mb-4 space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {authMode === 'password' && (
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                placeholder="至少 8 位"
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              isLoading ||
              !email.trim() ||
              (authMode === 'password' && password.length < 8)
            }
          >
            {isLoading
              ? '处理中…'
              : authMode === 'password'
                ? isSignUp
                  ? '注册并登录'
                  : '登录'
                : '发送验证码'}
          </Button>
        </form>

        {authMode === 'otp' && devFixedOtpActive ? (
          <p className="text-center text-xs text-muted-foreground">
            开发模式：无需邮箱验证码——提交邮箱即可直接登录。 在{' '}
            <code>.env.local</code> 中设置 <code>EMAIL_FROM</code>{' '}
            以使用真实的邮箱流程。
          </p>
        ) : authMode === 'otp' ? (
          <p className="text-center text-xs text-muted-foreground">
            无需密码——我们会向你发送验证码。
          </p>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            密码至少 8 位；也可以切换为邮箱验证码登录。
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          登录即表示你同意我们的{' '}
          <Link
            to="/terms"
            className="underline underline-offset-4 hover:text-foreground"
          >
            服务条款
          </Link>{' '}
          和{' '}
          <Link
            to="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            隐私政策
          </Link>
          。举报生成内容请访问{' '}
          <Link
            to="/report"
            className="underline underline-offset-4 hover:text-foreground"
          >
            /report
          </Link>
          。
        </p>
      </CardContent>
    </Card>
  );
}
