/**
 * InkOS Stories — 剧本创作入口
 *
 * 列出用户的所有故事项目，支持创建新故事。
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/ui/shadcn/button';
import { EmptyState } from '@/ui/shadcn/empty-state';
import { PageContainer } from '@/ui/layout/page-container';
import { PageIntro } from '@/ui/typography/page-intro';
import { PlusIcon, BookOpenIcon, PenLineIcon } from 'lucide-react';
import { getStoriesFn } from '@/stories/stories.fn';
import { formatDate } from '@/ui/format-date';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/_app/stories/')({
  component: StoriesPage,
  loader: async () => {
    const stories = await getStoriesFn();
    return { stories };
  },
});

function StoriesPage() {
  const { t } = useTranslation();
  const { stories } = Route.useLoaderData();

  return (
    <>
      <PageIntro
        title={t('story.pageTitle')}
        actions={
          <Button asChild>
            <Link to="/stories/new">
              <PlusIcon className="size-4" />
              {t('story.newStory')}
            </Link>
          </Button>
        }
      >
        {t('story.pageDescription')}
      </PageIntro>
      <PageContainer
        padding="none"
        className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6"
      >
        {stories.length === 0 ? (
          <EmptyState
            icon={<BookOpenIcon className="size-8" />}
            title={t('story.noStories')}
            description={t('story.emptyDescription')}
            action={
              <Button asChild>
                <Link to="/stories/new">
                  <PenLineIcon className="size-4" />
                  {t('story.startCreating')}
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <Link
                key={story.id}
                to="/stories/$id"
                params={{ id: story.id }}
                className="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium group-hover:text-primary">
                      {story.name}
                    </h3>
                    {story.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {story.description}
                      </p>
                    )}
                  </div>
                  <BookOpenIcon className="size-5 text-muted-foreground" />
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {t('story.updatedAt')}{' '}
                    {formatDate(new Date(story.updatedAt), i18n.language)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageContainer>
    </>
  );
}
