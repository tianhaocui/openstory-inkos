import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { DependencyGraphView } from '@/ui/docs/dependency-graph-view';
import { GRAPH_MODES, nodeById } from '@/ui/docs/dependency-graph';

const title = '依赖关系图';
const description =
  '生成流程的交互式地图：选择任意可编辑内容，查看哪些提示词、设定图、静帧和视频片段会过期。';

const searchSchema = z.object({
  node: z
    .string()
    .refine((id) => nodeById(id) !== undefined)
    .optional(),
  mode: z.enum(GRAPH_MODES).optional(),
});

// Interactive companion to docs/architecture/prompt-staleness-dependency-graph.md
// (#1595). The graph data lives in `src/ui/docs/dependency-graph.ts` and is
// transcribed from the hash bodies in `src/shots/input-hash.ts`.
export const Route = createFileRoute('/docs/dependency-graph')({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `${title} - OpenStory 文档` },
      { name: 'description', content: description },
    ],
  }),
  component: DependencyGraphArticle,
});

function DependencyGraphArticle() {
  const { node = 'character', mode = 'reference-only' } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <article className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">开发者指南</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{description}</p>
      </header>
      <div className="prose dark:prose-invert max-w-none text-sm">
        <p>
          每个生成产物都会保存生成时输入内容的哈希值。系统不会直接设置“过期”标记：每次读取时，都会根据当前输入重新计算哈希并进行比较。哈希不一致即为
          <strong>过期</strong>。没有保存哈希的记录属于
          <strong>未跟踪</strong>
          ，因此永远不会过期。带版本的内容（绿色边框）会将每次生成结果保存为一条记录，并通过指针选择其中一个版本。渲染产物会记录所使用的提示词或设定图
          <em>版本</em>，因此选择其他版本才会使其过期，单纯编辑文本不会。
        </p>
      </div>
      <DependencyGraphView
        node={node}
        mode={mode}
        onChange={(next) =>
          void navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
          })
        }
      />
    </article>
  );
}
