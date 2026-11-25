import { useAuthGate } from '@/platform/ui/auth/auth-gate-provider';
import { AddTalentDialog } from '@/cast/ui/talent-library/add-talent-dialog';
import { TalentLibraryFilters } from '@/cast/ui/talent-library/talent-library-filters';
import { TalentLibraryList } from '@/cast/ui/talent-library/talent-library-list';
import { PageContainer } from '@/ui/layout/page-container';
import { PageIntro } from '@/ui/typography/page-intro';
import { EmptyState } from '@/ui/shadcn/empty-state';
import { useTalent } from '@/cast/ui/use-talent';
import { createFileRoute } from '@tanstack/react-router';
import { User } from 'lucide-react';
import { z } from 'zod';

// No `.default()` here: a default makes the router rewrite bare /talent to
// /talent?filter=all with a 307, which turns the sitemap entry into a
// redirect (#814). The fallback lives in the component instead.
const searchParamsSchema = z.object({
  filter: z.enum(['all', 'favorites']).optional(),
});

export const Route = createFileRoute('/_app/library/talent/')({
  validateSearch: searchParamsSchema,
  component: TalentPage,
  staticData: { breadcrumb: '角色' },
});

function TalentPage() {
  const { filter = 'all' } = Route.useSearch();
  const { isAuthenticated } = useAuthGate();
  const {
    data: talent,
    isLoading,
    error,
  } = useTalent({
    favoritesOnly: filter === 'favorites',
  });

  // Anonymous visitors browse the public ("system") talent catalogue and can
  // open the dialog; the actual add prompts a login (gated inside
  // AddTalentDialog).
  const addAction = <AddTalentDialog />;

  return (
    <div className="h-full overflow-auto">
      <PageIntro title="角色库" actions={addAction}>
        {isAuthenticated
          ? '管理团队的角色库，确保 AI 生成内容的一致性。'
          : '浏览系统角色。登录后可添加自己的角色，保持序列间的角色一致性。'}
      </PageIntro>
      <PageContainer padding="none" className="pb-8">
        {isAuthenticated && <TalentLibraryFilters currentFilter={filter} />}

        {!isLoading && talent && talent.length === 0 ? (
          <EmptyState
            icon={<User className="h-12 w-12" />}
            title={isAuthenticated ? '暂无角色' : '暂无系统角色'}
            description={
              isAuthenticated
                ? '添加角色到你的库中，以保持序列间的视觉一致性。'
                : '敬请期待，或登录创建你自己的角色库。'
            }
            action={addAction}
          />
        ) : (
          <TalentLibraryList
            talent={talent}
            isLoading={isLoading}
            error={error}
          />
        )}
      </PageContainer>
    </div>
  );
}
