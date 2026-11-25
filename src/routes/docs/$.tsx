import { createFileRoute, notFound } from '@tanstack/react-router';
import { allDocs } from 'content-collections';
import { MarkdownContent } from '@/ui/docs/markdown';
import { parseDocsMarkdown } from '@/ui/docs/markdown-ast';
import { getSectionLabel } from '@/ui/docs/sections';

export const Route = createFileRoute('/docs/$')({
  loader: ({ params }) => {
    const slug = params._splat;
    const doc = allDocs.find((d) => d.slug === slug);

    if (!doc) {
      throw notFound();
    }

    const { document, headings } = parseDocsMarkdown(doc.body);

    return {
      title: doc.title,
      description: doc.description,
      section: doc.section,
      document,
      headings,
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} - OpenStory 文档` },
          { name: 'description', content: loaderData.description },
        ]
      : [],
  }),
  component: DocsArticle,
  notFoundComponent: () => (
    <div className="flex flex-col gap-2 py-20 text-center">
      <h1 className="text-2xl font-bold">页面未找到</h1>
      <p className="text-muted-foreground">此文档页面不存在。</p>
    </div>
  ),
});

function DocsArticle() {
  const data = Route.useLoaderData();

  return (
    <article>
      <header className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">
          {getSectionLabel(data.section)}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{data.title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{data.description}</p>
      </header>
      <MarkdownContent document={data.document} />
    </article>
  );
}
