/**
 * Workerd multipart upload protocol for large files (>90 MiB, see src/ui/upload.ts).
 *
 * The browser drives four operations against the same destination:
 *   POST ?action=create&contentType=…            → { uploadId }
 *   PUT  ?uploadId=…&partNumber=N  (binary body) → { part: { partNumber, etag } }
 *   POST ?action=complete&uploadId=… {parts}     → UploadResult
 *   POST ?action=abort&uploadId=…                → { success: true }
 *
 * Every verb re-resolves and re-authorizes `bucket`/`path` through
 * `resolveUploadTarget`: the path's owner segment must name a team the caller
 * belongs to, so a stolen/guessed uploadId can't be used to write into
 * another team's prefix. The multipart helpers come from `#storage` — on
 * Workerd they map to the R2 binding (local Miniflare during e2e).
 */

import { getLogger, toErrorPayload } from '@/platform/logger';
import { authWithTeamRequestMiddleware } from '@/platform/middleware.fn';
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  uploadPart,
} from '#storage';
import { resolveUploadTarget } from '@/platform/server/storage/upload-target';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const logger = getLogger(['openstory', 'api', 'storage', 'multipart']);

const completeSchema = z.object({
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        etag: z.string().min(1),
      })
    )
    .min(1),
});

const fail = (error: string, status: number) =>
  Response.json({ success: false, error }, { status });

export const Route = createFileRoute('/api/storage/multipart')({
  server: {
    middleware: [authWithTeamRequestMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const resolved = await resolveUploadTarget(request, context.user);
        if (!resolved.ok) return resolved.response;

        const url = new URL(request.url);
        const action = url.searchParams.get('action');
        const uploadId = url.searchParams.get('uploadId');
        const { bucket, path, contentType } = resolved.target;

        try {
          if (action === 'create') {
            const created = await createMultipartUpload(
              bucket,
              path,
              contentType
            );
            return Response.json({
              uploadId: created.uploadId,
              key: created.key,
            });
          }

          if (action === 'complete') {
            if (!uploadId) return fail('Missing uploadId', 400);
            let body: unknown;
            try {
              body = await request.json();
            } catch {
              return fail('Request body must be valid JSON', 400);
            }
            const parsed = completeSchema.safeParse(body);
            if (!parsed.success) return fail('Invalid parts', 400);
            const result = await completeMultipartUpload(
              bucket,
              path,
              uploadId,
              parsed.data.parts
            );
            return Response.json(result);
          }

          if (action === 'abort') {
            if (!uploadId) return fail('Missing uploadId', 400);
            await abortMultipartUpload(bucket, path, uploadId);
            return Response.json({ success: true });
          }

          return fail('Invalid or missing action', 400);
        } catch (error) {
          logger.error('Multipart operation failed', {
            action,
            err: toErrorPayload(error),
          });
          return fail('Multipart operation failed', 500);
        }
      },

      PUT: async ({ request, context }) => {
        const resolved = await resolveUploadTarget(request, context.user);
        if (!resolved.ok) return resolved.response;

        const url = new URL(request.url);
        const uploadId = url.searchParams.get('uploadId');
        const partNumber = Number(url.searchParams.get('partNumber'));
        if (!uploadId) return fail('Missing uploadId', 400);
        if (!Number.isInteger(partNumber) || partNumber < 1) {
          return fail('Invalid partNumber', 400);
        }

        try {
          const part = await uploadPart(
            resolved.target.bucket,
            resolved.target.path,
            uploadId,
            partNumber,
            await request.arrayBuffer()
          );
          return Response.json({ part });
        } catch (error) {
          logger.error('Multipart part upload failed', {
            partNumber,
            err: toErrorPayload(error),
          });
          return fail('Multipart part upload failed', 500);
        }
      },
    },
  },
});
