import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getEnv } from '#env';
import { authWithTeamRequestMiddleware } from '@/platform/middleware.fn';
import { createInkOSBindingToken } from '@/stories/server/inkos-sync';

const inputSchema = z.object({
  projectId: z.string().min(1),
  mode: z.enum(['script', 'interactive-film']),
});

function syncSecret(): string | undefined {
  const value = (getEnv() as Record<string, unknown>).INKOS_SYNC_SECRET;
  return typeof value === 'string' && value.length >= 32 ? value : undefined;
}

export const Route = createFileRoute('/api/integrations/inkos/launch')({
  server: {
    middleware: [authWithTeamRequestMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        const secret = syncSecret();
        if (!secret) {
          return Response.json(
            {
              error: {
                code: 'NOT_CONFIGURED',
                message: 'InkOS is unavailable.',
              },
            },
            { status: 503 }
          );
        }

        const url = new URL(request.url);
        const parsed = inputSchema.safeParse({
          projectId: url.searchParams.get('projectId'),
          mode: url.searchParams.get('mode'),
        });
        if (!parsed.success) {
          return Response.json(
            {
              error: {
                code: 'INVALID_REQUEST',
                message: 'Invalid InkOS launch request.',
              },
            },
            { status: 400 }
          );
        }

        const project = await context.scopedDb.stories.getProject(
          parsed.data.projectId
        );
        if (!project) {
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

        const binding = await createInkOSBindingToken({
          secret,
          binding: {
            version: 1,
            projectId: project.id,
            teamId: context.teamId,
            userId: context.user.id,
            mode: parsed.data.mode,
            expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90,
          },
        });
        const destination = new URL('/inkos/', url.origin);
        destination.searchParams.set('mode', parsed.data.mode);
        destination.searchParams.set('binding', binding);
        destination.searchParams.set('title', project.name);
        return Response.redirect(destination, 302);
      },
    },
  },
});
