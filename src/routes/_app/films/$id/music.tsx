import { createFileRoute, redirect } from '@tanstack/react-router';

/** Music index is now the nothing-selected Music facet (#986). */
export const Route = createFileRoute('/_app/films/$id/music')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/films/$id/scenes',
      params: { id: params.id },
      search: { facet: 'music' },
    });
  },
  staticData: { breadcrumb: '音乐' },
});
