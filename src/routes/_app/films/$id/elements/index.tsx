import { createFileRoute, redirect } from '@tanstack/react-router';

/** Elements index is now the nothing-selected Elements facet (#986). */
export const Route = createFileRoute('/_app/films/$id/elements/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/films/$id/scenes',
      params: { id: params.id },
      search: { facet: 'elements' },
    });
  },
  staticData: { breadcrumb: '元素' },
});
