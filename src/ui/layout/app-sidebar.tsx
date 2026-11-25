import { usePostHog } from '@posthog/react';
import { BigKalamiLogo, BigKalamiMark } from '@/ui/icons/big-kalami-logo';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/ui/shadcn/sidebar';
import { MODELS_ENABLED } from '@/platform/flags';
import { Link, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import {
  BookOpenIcon,
  Boxes,
  Clapperboard,
  Film,
  Images,
  MapPin,
  Palette,
  Plus,
  Users,
  Video,
} from 'lucide-react';
import { UserSidebarFooter } from './user-sidebar-footer';

/**
 * Low Balance Warning Hook
 * Fires toast notifications when balance decreases and crosses threshold,
 * and when a generation is rejected for insufficient credits (preflight
 * does not debit, so that path never looks like a balance drop).
 */

import { shouldOfferWelcomeClaim } from '@/billing/constants';
import { showLowBalanceToast } from '@/billing/ui/low-balance-toast';
import { typicalShortCostUsd } from '@/billing/ui/typical-short-cost';
import { subscribeInsufficientCredits } from '@/billing/ui/notify-insufficient-credits';
import { openAddCreditsDialog } from '@/billing/ui/use-add-credits-dialog';
import { openBillingGate } from '@/billing/ui/use-billing-gate-dialog';
import { useBillingBalance } from '@/billing/ui/use-billing-balance';
import { useFalPricing } from '@/billing/ui/use-fal-pricing';
import { useWelcomeCreditsGate } from '@/billing/ui/welcome-credits-dialog';

function useLowBalanceWarning() {
  const {
    balance,
    isLowBalance,
    isZeroBalance,
    lowBalanceThreshold,
    stripeEnabled,
    hasSignupGrant,
    hasOtherCredits,
  } = useBillingBalance();
  const { reopen: reopenWelcomeCredits } = useWelcomeCreditsGate();
  const { pricing } = useFalPricing();
  const posthog = usePostHog();
  const prevBalanceRef = useRef<number | null>(null);
  const hasWarnedRef = useRef(false);

  const fireToast = useCallback(
    (source: 'balance_drop' | 'insufficient_credits') => {
      if (
        shouldOfferWelcomeClaim({
          stripeEnabled,
          hasSignupGrant,
          hasOtherCredits,
        })
      ) {
        reopenWelcomeCredits();
        return;
      }
      const balanceUsd = balance ?? 0;
      const zero = balance === null ? true : isZeroBalance;
      const props = {
        balance_usd: balanceUsd,
        is_zero: zero,
        source,
      };
      posthog.capture('low_balance_toast_shown', props);

      const clicked = (choice: 'add_credits' | 'other_options') =>
        posthog.capture('low_balance_toast_clicked', { ...props, choice });

      showLowBalanceToast({
        balanceUsd,
        isZeroBalance: zero,
        runCostUsd: typicalShortCostUsd(pricing),
        onAddCredits: () => {
          clicked('add_credits');
          openAddCreditsDialog('low_balance_toast');
        },
        onOtherOptions: () => {
          clicked('other_options');
          openBillingGate(zero ? 'zero' : 'insufficient');
        },
      });
    },
    [
      balance,
      isZeroBalance,
      posthog,
      pricing,
      stripeEnabled,
      hasSignupGrant,
      hasOtherCredits,
      reopenWelcomeCredits,
    ]
  );

  useEffect(() => {
    return subscribeInsufficientCredits(() => {
      fireToast('insufficient_credits');
    });
  }, [fireToast]);

  useEffect(() => {
    if (balance === null) return;

    const prevBalance = prevBalanceRef.current;
    prevBalanceRef.current = balance;

    // Only warn on balance decrease, not on initial load
    if (prevBalance === null) return;
    if (balance >= prevBalance) {
      // Balance went up — reset warning so it can fire again next time
      if (balance > lowBalanceThreshold) {
        hasWarnedRef.current = false;
      }
      return;
    }

    // Balance decreased — check if we should warn
    if (hasWarnedRef.current) return;
    if (!isZeroBalance && !isLowBalance) return;

    hasWarnedRef.current = true;
    fireToast('balance_drop');
  }, [balance, fireToast, isLowBalance, isZeroBalance, lowBalanceThreshold]);
}

const navLinks = [
  { to: '/sequences', label: '我的序列', icon: Video },
  { to: '/stories', label: '故事创作', icon: BookOpenIcon },
  { to: '/images', label: '图片', icon: Images },
  { to: '/videos', label: '视频', icon: Film },
  ...(MODELS_ENABLED
    ? [{ to: '/models', label: '模型', icon: Boxes } as const]
    : []),
  { to: '/styles', label: '风格', icon: Palette },
  { to: '/talent', label: '角色', icon: Users },
  { to: '/locations', label: '场景', icon: MapPin },
  { to: '/gallery', label: '作品集', icon: Clapperboard },
] as const;

export function AppSidebar() {
  useLowBalanceWarning();

  const { isMobile, setOpenMobile } = useSidebar();
  const posthog = usePostHog();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          to="/"
          className="flex h-10 items-center px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <BigKalamiLogo className="group-data-[collapsible=icon]:hidden" />
          <BigKalamiMark className="hidden group-data-[collapsible=icon]:block" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="新建序列">
                  {/* `/` is the free composer for everyone (#1104); the
                      signed-in alias `/sequences/new` is for copy/breadcrumb
                      entry points that require a session. */}
                  <Link
                    to="/"
                    onClick={() =>
                      posthog.capture('make_another_clicked', {
                        surface: 'sidebar',
                      })
                    }
                  >
                    <Plus />
                    <span>新建序列</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {navLinks.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton asChild tooltip={label}>
                    <Link
                      to={to}
                      activeProps={{ 'data-active': 'true' }}
                      activeOptions={{ exact: false }}
                    >
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <UserSidebarFooter />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
