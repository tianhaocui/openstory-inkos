import { RouteErrorFallback } from '@/ui/error/route-error-fallback';
import { routeParams } from '@/ui/layout/breadcrumbs';
import { RenameSequenceButton } from '@/sequences/ui/rename-sequence-button';
import { SEQUENCE_HEADER_SLOT_ID } from '@/sequences/ui/sequence-header-slot';
import { getDefaultSequenceTabPath } from '@/sequences/ui/sequence-tabs';
import { getSequenceFn } from '@/sequences/sequences.fn';
import { sequenceKeys, useSequence } from '@/sequences/ui/use-sequences';
import { useUser } from '@/platform/ui/use-user';
import { requireSessionOrRedirect } from '@/platform/ui/auth/route-guards';
import { isValidId } from '@/platform/id';
import { useScenesBySequence } from '@/shots/ui/use-scenes';
import { useShotsBySequence } from '@/shots/ui/use-shots';
import { toSceneView, type SceneView } from '@/ui/view-models/scene-view';
import { toShotView, type ShotView } from '@/ui/view-models/shot-view';
import { toStoryView, type StoryView } from '@/ui/view-models/story-view';
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';

function SequenceCrumbLabel({ id }: { id: string }) {
  const { data } = useSequence(id);
  const story: StoryView | null = data
    ? toStoryView({ kind: 'film', row: data })
    : null;
  const title = story?.title ?? '…';
  return <span title={title}>{title}</span>;
}

export const Route = createFileRoute('/_app/films/$id')({
  component: SequenceLayout,
  beforeLoad: async ({ context: { queryClient }, location }) => {
    await requireSessionOrRedirect(queryClient, location.href);
  },
  loader: async ({ params, context: { queryClient } }) => {
    if (!isValidId(params.id)) {
      throw notFound();
    }

    await queryClient.ensureQueryData({
      queryKey: sequenceKeys.detail(params.id),
      queryFn: () => getSequenceFn({ data: { sequenceId: params.id } }),
    });
  },
  staticData: {
    breadcrumb: (match) => {
      const { id } = routeParams<{ id: string }>(match);
      return [
        { label: i18n.t('nav.films'), to: '/films' },
        {
          label: <SequenceCrumbLabel id={id} />,
          to: getDefaultSequenceTabPath(id),
        },
      ];
    },
  },
  errorComponent: (props) => (
    <RouteErrorFallback {...props} heading={i18n.t('films.loadFailed')} />
  ),
});

function SequenceLayout() {
  const { t } = useTranslation();
  const { id: sequenceId } = Route.useParams();

  useUser();

  const { data: sequence } = useSequence(sequenceId);
  const { data: scenes } = useScenesBySequence(sequenceId);
  const { data: shots } = useShotsBySequence(sequenceId);

  // P2 ViewModel：两条数据源在 UI 上统一为 Story → Scene → Shot。
  const story: StoryView | null = sequence
    ? toStoryView({ kind: 'film', row: sequence })
    : null;
  const sceneViews: SceneView[] = (scenes ?? []).map((row) =>
    toSceneView({ kind: 'film', row })
  );
  const shotViews: ShotView[] = (shots ?? []).map((row) =>
    toShotView({ kind: 'film', row })
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-[1920px] shrink-0 space-y-1 px-6 pt-4">
        {/* Title made visible (#1108 Phase 4) so rename has a surface — the
            breadcrumb crumb is always a Link here, which can't host a button. */}
        <div className="flex min-w-0 items-center gap-1">
          <h1 className="truncate text-sm font-medium">
            {story?.title ?? t('films.fallbackTitle')}
          </h1>
          {sequence && (
            <RenameSequenceButton
              sequenceId={sequenceId}
              title={sequence.title}
            />
          )}
          {/* Generation progress portals in here (#1427). The row is already
              this tall with just the title in it, so progress costs no layout
              shift and sits over nothing. `@container` so the chip can size
              its label against the space it actually has, which requires the
              slot be `flex-1` — a container sized by its own content could
              never satisfy the query. */}
          <div
            id={SEQUENCE_HEADER_SLOT_ID}
            className="@container flex min-w-0 flex-1 items-center justify-end pl-2"
          />
        </div>
        {(sceneViews.length > 0 || shotViews.length > 0) && (
          <p className="text-xs text-muted-foreground">
            {t('films.sceneShotCount', {
              scenes: sceneViews.length,
              shots: shotViews.length,
            })}
          </p>
        )}
        {/* No Script | Scenes tab strip — those are lifecycle destinations,
            not peer pages. Pre-analysis lives at /script; analysed work at
            /scenes with script as a canvas view toggle (#1037 / #1072). */}
      </div>
      <div className="mx-auto w-full max-w-[1920px] flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
