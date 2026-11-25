/**
 * OTP Verification Page
 * Verifies the code sent to user's email
 */

import { VerifyForm } from '@/platform/ui/auth/verify-form';
import { PageContainer } from '@/ui/layout/page-container';
import { getRedirectFromParams } from '@/platform/ui/auth/navigation';
import { Navigate, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().optional(),
});

export const Route = createFileRoute('/_auth/verify')({
  validateSearch: searchSchema,
  component: VerifyPage,
});

function VerifyPage() {
  const search = Route.useSearch();
  const redirectTo = getRedirectFromParams(search);

  // If no email, redirect back to login
  if (!search.email) {
    return <Navigate to="/login" search={{ redirectTo }} />;
  }

  return (
    <PageContainer>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold">验证你的邮箱</h1>
            <p className="mt-2 text-muted-foreground">
              我们已向你的收件箱发送了验证码
            </p>
          </div>
          <VerifyForm email={search.email} redirectTo={redirectTo} />
        </div>
      </div>
    </PageContainer>
  );
}
