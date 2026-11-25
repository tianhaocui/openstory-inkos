/**
 * InkOS Stories — 剧本创作入口
 *
 * 列出用户的所有故事项目，支持创建新故事。
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/ui/shadcn/button';
import { EmptyState } from '@/ui/shadcn/empty-state';
import { PageHeader } from '@/ui/typography/page-header';
import { PlusIcon, BookOpenIcon, PenLineIcon } from 'lucide-react';
import { getStoriesFn } from '@/stories/stories.fn';

export const Route = createFileRoute('/_app/stories/')({
  component: StoriesPage,
  loader: async () => {
    const stories = await getStoriesFn();
    return { stories };
  },
});

function StoriesPage() {
  const { stories } = Route.useLoaderData();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="故事创作"
        description="使用 AI 辅助创作长篇小说和剧本"
        actions={
          <Button asChild>
            <Link to="/stories/new">
              <PlusIcon className="size-4" />
              新建故事
            </Link>
          </Button>
        }
      />

      {stories.length === 0 ? (
        <EmptyState
          icon={<BookOpenIcon className="size-8" />}
          title="还没有故事"
          description="开始创作你的第一个 AI 辅助故事吧"
          action={
            <Button asChild>
              <Link to="/stories/new">
                <PenLineIcon className="size-4" />
                开始创作
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
                <span>更新于 {new Date(story.updatedAt).toLocaleDateString('zh-CN')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
