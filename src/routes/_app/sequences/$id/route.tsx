import { createFileRoute } from '@tanstack/react-router';

/** 兼容层：保留旧路由父子结构，具体入口由各子路由的 beforeLoad 重定向。 */
export const Route = createFileRoute('/_app/sequences/$id')({});
