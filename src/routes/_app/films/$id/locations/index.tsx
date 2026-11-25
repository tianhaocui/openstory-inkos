import { createFileRoute, redirect } from '@tanstack/react-router';

/** Locations index is now the nothing-selected Locations facet (#986). */
export const Route = createFileRoute('/_app/films/$id/locations/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/films/$id/scenes',
      params: { id: params.id },
      search: { facet: 'location' },
    });
  },
  staticData: { breadcrumb: '场景' },
});
