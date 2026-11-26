/**
 * Workerd counterpart of the self-hosted Node server's `PUT /api/storage/upload`.
 *
 * R2 bindings can't mint presigned URLs, so `getSignedUploadUrl` (storage-cloudflare.ts)
 * hands the browser this origin-relative URL and the bytes come back through
 * the Worker. Without this file route the URL only existed on the Node server,
 * so `vite dev` / Workerd answered 404 for every upload.
 *
 * Authorization is *not* reimplemented here: `resolveUploadTarget` reads
 * bucket/path from the query, validates the bucket, and makes sure the path's
 * owner segment names a team the caller belongs to. The middleware supplies
 * the same `user` shape the Node/API routes use.
 */

import { getLogger, toErrorPayload } from '@/platform/logger';
import { authWithTeamRequestMiddleware } from '@/platform/middleware.fn';
import { uploadFile } from '#storage';
import { resolveUploadTarget } from '@/platform/server/storage/upload-target';
import { createFileRoute } from '@tanstack/react-router';

const logger = getLogger(['openstory', 'api', 'storage']);

export const Route = createFileRoute('/api/storage/upload')({
  server: {
    middleware: [authWithTeamRequestMiddleware],
    handlers: {
      PUT: async ({ request, context }) => {
        const resolved = await resolveUploadTarget(request, context.user);
        if (!resolved.ok) return resolved.response;

        try {
          const body = await request.arrayBuffer();
          const result = await uploadFile(
            resolved.target.bucket,
            resolved.target.path,
            body,
            { contentType: resolved.target.contentType }
          );
          return Response.json(result);
        } catch (error) {
          logger.error('Storage upload failed', {
            err: toErrorPayload(error),
          });
          return Response.json(
            { success: false, error: 'Upload failed' },
            { status: 500 }
          );
        }
      },
    },
  },
});
