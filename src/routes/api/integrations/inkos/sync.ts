import { createFileRoute } from '@tanstack/react-router';
import { getEnv } from '#env';
import { syncInkOSStoryForTeam } from '@/platform/server/db/scoped';
import {
  inkOSSyncPayloadSchema,
  verifyInkOSBindingToken,
  verifyInkOSPayloadSignature,
} from '@/stories/server/inkos-sync';

const MAX_BODY_BYTES = 2_100_000;

function syncSecret(): string | undefined {
  const value = (getEnv() as Record<string, unknown>).INKOS_SYNC_SECRET;
  return typeof value === 'string' && value.length >= 32 ? value : undefined;
}

export const Route = createFileRoute('/api/integrations/inkos/sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = syncSecret();
        if (!secret) {
          return Response.json(
            {
              error: {
                code: 'NOT_CONFIGURED',
                message: 'InkOS sync is unavailable.',
              },
            },
            { status: 503 }
          );
        }

        const contentLength = Number(
          request.headers.get('content-length') ?? 0
        );
        if (contentLength > MAX_BODY_BYTES) {
          return Response.json(
            {
              error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Sync payload is too large.',
              },
            },
            { status: 413 }
          );
        }

        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
          return Response.json(
            {
              error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Sync payload is too large.',
              },
            },
            { status: 413 }
          );
        }

        const timestamp = request.headers.get('x-inkos-timestamp') ?? '';
        const signature = request.headers.get('x-inkos-signature') ?? '';
        const validSignature = await verifyInkOSPayloadSignature({
          secret,
          timestamp,
          signature,
          rawBody,
        });
        if (!validSignature) {
          return Response.json(
            {
              error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid sync signature.',
              },
            },
            { status: 401 }
          );
        }

        let payload;
        try {
          payload = inkOSSyncPayloadSchema.parse(JSON.parse(rawBody));
        } catch {
          return Response.json(
            {
              error: {
                code: 'INVALID_PAYLOAD',
                message: 'Invalid sync payload.',
              },
            },
            { status: 400 }
          );
        }

        const binding = await verifyInkOSBindingToken({
          secret,
          token: payload.binding,
        });
        if (!binding || binding.mode !== payload.artifactKind) {
          return Response.json(
            {
              error: {
                code: 'INVALID_BINDING',
                message: 'Project binding is invalid.',
              },
            },
            { status: 401 }
          );
        }

        const result = await syncInkOSStoryForTeam(binding.teamId, {
          ...payload,
          projectId: binding.projectId,
        });
        if (!result) {
          return Response.json(
            {
              error: {
                code: 'NOT_FOUND',
                message: 'Story project was not found.',
              },
            },
            { status: 404 }
          );
        }
        if (result.conflict) {
          return Response.json(
            {
              error: {
                code: 'EVENT_CONFLICT',
                message: 'Event id was already used.',
              },
            },
            { status: 409 }
          );
        }

        return Response.json({
          ok: true,
          duplicate: result.duplicate,
          projectId: binding.projectId,
          chapterCount: result.chapters.length,
        });
      },
    },
  },
});
