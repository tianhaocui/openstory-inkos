import { createFileRoute, redirect } from '@tanstack/react-router';

/** Cast index is now the nothing-selected Cast facet (#986). */
export const Route = createFileRoute('/_app/films/$id/cast/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/films/$id/scenes',
      params: { id: params.id },
      search: { facet: 'cast' },
    });
  },
  staticData: { breadcrumb: '角色' },
});
