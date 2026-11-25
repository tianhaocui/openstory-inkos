import { useAuthGate } from '@/platform/ui/auth/auth-gate-provider';
import { AddLocationDialog } from '@/cast/ui/location-library/add-location-dialog';
import { LocationLibraryFilters } from '@/cast/ui/location-library/location-library-filters';
import { LocationLibraryList } from '@/cast/ui/location-library/location-library-list';
import { PageContainer } from '@/ui/layout/page-container';
import { PageIntro } from '@/ui/typography/page-intro';
import { EmptyState } from '@/ui/shadcn/empty-state';
import { useLibraryLocations } from '@/cast/ui/use-sequence-locations';
import { createFileRoute } from '@tanstack/react-router';
import { MapPin } from 'lucide-react';
import { z } from 'zod';

const searchParamsSchema = z.object({
  search: z.string().optional(),
});

export const Route = createFileRoute('/_app/locations/')({
  validateSearch: searchParamsSchema,
  component: LocationsPage,
  staticData: { breadcrumb: '场景' },
});

function LocationsPage() {
  const { search } = Route.useSearch();
  const { isAuthenticated } = useAuthGate();
  const { data: locations, isLoading, error } = useLibraryLocations();

  // Filter locations based on search params
  const filteredLocations = locations?.filter((loc) => {
    // Filter by search query
    if (search) {
      const query = search.toLowerCase();
      return (
        loc.name.toLowerCase().includes(query) ||
        loc.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Anonymous visitors browse the public ("system") location catalogue and
  // can open the dialog; the actual add prompts a login (gated inside
  // AddLocationDialog).
  const addAction = <AddLocationDialog />;

  return (
    <div className="h-full overflow-auto">
      <PageIntro title="场景库" actions={addAction}>
        {isAuthenticated
          ? '浏览和管理所有序列中的场景参考。上传自定义参考图片以保持视觉一致性。'
          : '浏览系统场景。登录后可添加自己的参考图片，保持序列间的一致性。'}
      </PageIntro>
      <PageContainer padding="none" className="pb-8">
        {isAuthenticated && <LocationLibraryFilters currentSearch={search} />}

        {!isLoading && filteredLocations && filteredLocations.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-12 w-12" />}
            title={
              isAuthenticated ? '暂无场景' : '暂无系统场景'
            }
            description={
              isAuthenticated
                ? '添加场景到你的库中，以保持序列间的视觉一致性。'
                : '敬请期待，或登录创建你自己的场景库。'
            }
            action={addAction}
          />
        ) : (
          <LocationLibraryList
            locations={filteredLocations}
            isLoading={isLoading}
            error={error}
          />
        )}
      </PageContainer>
    </div>
  );
}
