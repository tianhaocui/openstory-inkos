import { createFileRoute, redirect } from '@tanstack/react-router';

/** Theatre playback is now the nothing-selected canvas state (#986). */
export const Route = createFileRoute('/_app/films/$id/theatre')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/films/$id/scenes',
      params: { id: params.id },
    });
  },
  staticData: { breadcrumb: '成片' },
});
