/**
 * Passkey Settings Component
 * Displays list of passkeys with add/delete functionality
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
import { Skeleton } from '@/ui/shadcn/skeleton';
import { authClient } from '@/platform/ui/auth/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Fingerprint, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

type PasskeySettingsProps = {
  isSetupFlow?: boolean;
};

export function PasskeySettings({ isSetupFlow }: PasskeySettingsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const {
    data: passkeys,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ['passkeys'],
    queryFn: async () => {
      const result = await authClient.passkey.listUserPasskeys();
      if (result.error) {
        throw new Error(result.error.message || '加载通行密钥失败');
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const addPasskeyMutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.passkey.addPasskey();
      if (result.error) {
        throw new Error(
          typeof result.error === 'object' &&
            'message' in result.error &&
            typeof result.error.message === 'string'
            ? result.error.message
            : '添加通行密钥失败'
        );
      }
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '添加通行密钥失败');
    },
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) {
        throw new Error(result.error.message || '删除通行密钥失败');
      }
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '删除通行密钥失败');
    },
  });

  const handleContinue = () => {
    void navigate({ to: '/sequences' });
  };

  const handleSkip = () => {
    localStorage.setItem('openstory-passkey-skip', 'true');
    void navigate({ to: '/sequences' });
  };

  const content = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Fingerprint className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{isSetupFlow ? '设置通行密钥' : '通行密钥'}</CardTitle>
              <CardDescription>
                {isSetupFlow
                  ? '使用 Face ID、Touch ID 或设备 PIN 即刻登录'
                  : '管理用于免密码登录的通行密钥'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {(error || fetchError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {error ||
                  (fetchError instanceof Error
                    ? fetchError.message
                    : '加载通行密钥失败')}
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : passkeys && passkeys.length > 0 ? (
            <div className="space-y-3">
              {passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Fingerprint className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {passkey.name || '通行密钥'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        添加于{' '}
                        {new Date(passkey.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePasskeyMutation.mutate(passkey.id)}
                    disabled={deletePasskeyMutation.isPending}
                    aria-label="删除通行密钥"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              尚未注册通行密钥
            </p>
          )}

          <Button
            onClick={() => addPasskeyMutation.mutate()}
            disabled={addPasskeyMutation.isPending}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            {addPasskeyMutation.isPending ? '添加中…' : '添加通行密钥'}
          </Button>

          {isSetupFlow && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleSkip}>
                暂时跳过
              </Button>
              {passkeys && passkeys.length > 0 && (
                <Button className="flex-1" onClick={handleContinue}>
                  继续
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Only wrap with container when in setup flow (standalone page)
  if (isSetupFlow) {
    return <div className="mx-auto max-w-2xl p-6">{content}</div>;
  }

  return content;
}
