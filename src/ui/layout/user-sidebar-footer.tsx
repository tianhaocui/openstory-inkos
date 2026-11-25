import { Avatar, AvatarFallback, AvatarImage } from '@/ui/shadcn/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/ui/shadcn/dropdown-menu';
import { SidebarMenuButton, SidebarMenuItem } from '@/ui/shadcn/sidebar';
import { isSystemAdminFn } from '@/billing/gift-tokens.fn';
import { useUser } from '@/platform/ui/use-user';
import { authClient } from '@/platform/ui/auth/client';
import { sessionQueryOptions } from '@/platform/ui/auth/session-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Check,
  ChevronsUpDown,
  Languages,
  LogIn,
  LogOut,
  Settings,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';

export function UserSidebarFooter() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Initial session resolve only — not after sign-out (we seed null session
  // so isLoading stays false and "Sign in" shows immediately).
  if (isLoading) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" disabled>
          <div className="h-8 w-8 shrink-0 rounded-full bg-muted animate-pulse" />
          <div className="flex flex-1 flex-col gap-1">
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-32 rounded bg-muted animate-pulse" />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (!user) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={t('auth.signIn')}>
          <Link to="/login">
            <LogIn />
            <span>{t('auth.signIn')}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  const userEmail = user.email;
  const displayName = user.name || userEmail || t('auth.user');
  const initials = getInitials(displayName);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Do NOT removeQueries(['session']) first — that puts useUser into
      // isLoading and flashes the skeleton. authClient.signOut clears caches
      // then seeds session=null (see client.ts).
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            // Only seed anonymous session after a confirmed sign-out. A
            // failed network/API call must not flip the UI to "Sign in"
            // while the cookie is still valid.
            queryClient.setQueryData(sessionQueryOptions.queryKey, null);
            void navigate({ to: '/' });
          },
        },
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user.image || undefined} alt={displayName} />
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              {userEmail && (
                <span className="truncate text-xs text-muted-foreground">
                  {userEmail}
                </span>
              )}
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          sideOffset={4}
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.image || undefined} alt={displayName} />
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                {userEmail && (
                  <span className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                )}
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Settings className="mr-2 h-4 w-4" />
              {t('nav.settings')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/credits" search={{ tab: 'balance' }}>
              <Wallet className="mr-2 h-4 w-4" />
              {t('settings.credits')}
            </Link>
          </DropdownMenuItem>
          <AdminMenuItem />
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Languages className="mr-2 h-4 w-4" />
              {t('settings.interfaceLanguage')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => void i18n.changeLanguage('zh')}>
                <Check className="mr-2 h-4 w-4" />
                {t('settings.chineseCurrent')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <span>English</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {t('settings.comingSoon')}
                </span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isSigningOut ? t('auth.signingOut') : t('auth.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

function AdminMenuItem() {
  const { t } = useTranslation();
  const { data: adminStatus } = useQuery({
    queryKey: ['system-admin-status'],
    queryFn: () => isSystemAdminFn(),
    staleTime: 5 * 60 * 1000,
  });

  if (!adminStatus?.isAdmin) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {t('admin.label')}
      </DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link to="/admin/usage">
          <BarChart3 className="mr-2 h-4 w-4" />
          {t('admin.usage')}
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to="/admin/moderation">
          <ShieldAlert className="mr-2 h-4 w-4" />
          {t('admin.moderation')}
        </Link>
      </DropdownMenuItem>
    </>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!first || !last) return '';
  if (parts.length === 1) {
    return first.substring(0, 2).toUpperCase();
  }
  const firstChar = first[0];
  const lastChar = last[0];
  if (!firstChar || !lastChar) return '';
  return (firstChar + lastChar).toUpperCase();
}
