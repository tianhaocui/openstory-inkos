import { APIError } from 'better-auth/api';
import { getAuth } from '@/platform/server/auth/config';
import { resolveUserTeam } from '@/platform/server/db/scoped';

const noStoreHeaders = {
  'Cache-Control': 'no-store, private',
};

export async function handleInkOSSessionRequest(
  request: Request
): Promise<Response> {
  const cookie = request.headers.get('cookie');
  if (!cookie) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Login required.' } },
      { status: 401, headers: noStoreHeaders }
    );
  }

  try {
    const session = await getAuth().api.getSession({
      headers: new Headers({ cookie }),
    });
    if (!session?.user || session.user.status === 'suspended') {
      return Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Login required.' } },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const team = await resolveUserTeam(session.user.id);
    if (!team) {
      return Response.json(
        { error: { code: 'NO_TEAM', message: 'No team is available.' } },
        { status: 403, headers: noStoreHeaders }
      );
    }

    return new Response(null, {
      status: 204,
      headers: {
        ...noStoreHeaders,
        'X-OpenStory-User-Id': session.user.id,
        'X-OpenStory-Team-Id': team.teamId,
        'X-OpenStory-Team-Role': team.role,
      },
    });
  } catch (error) {
    if (
      error instanceof APIError &&
      (error.statusCode === 401 || error.statusCode === 403)
    ) {
      return Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Login required.' } },
        { status: 401, headers: noStoreHeaders }
      );
    }
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Authentication failed.' } },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
