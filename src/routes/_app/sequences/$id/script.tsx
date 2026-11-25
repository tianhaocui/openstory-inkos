import { createFileRoute, redirect } from '@tanstack/react-router';

/** 兼容层：旧路径保留一版，重定向到规范路径并保留查询参数。 */
export const Route = createFileRoute('/_app/sequences/$id/script')({
  beforeLoad: ({ params, location }) => {
    throw redirect({ href: `/films/${params.id}/script${location.searchStr}` });
  },
});
