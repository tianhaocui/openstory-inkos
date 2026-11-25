import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, resolveUserTeam } = vi.hoisted(() => ({
  getSession: vi.fn(),
  resolveUserTeam: vi.fn(),
}));

vi.mock('@/platform/server/auth/config', () => ({
  getAuth: () => ({ api: { getSession } }),
}));
vi.mock('@/platform/server/db/scoped', () => ({ resolveUserTeam }));

import { handleInkOSSessionRequest } from './inkos-session';

describe('InkOS session auth request', () => {
  beforeEach(() => {
    getSession.mockReset();
    resolveUserTeam.mockReset();
  });

  it('rejects a request without a login cookie', async () => {
    const response = await handleInkOSSessionRequest(
      new Request('https://openstory.test/api/internal/inkos-session')
    );
    expect(response.status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('returns only trusted identity headers for a valid team session', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', status: 'active' },
    });
    resolveUserTeam.mockResolvedValue({
      teamId: 'team-1',
      role: 'member',
      teamName: 'Team One',
    });
    const response = await handleInkOSSessionRequest(
      new Request('https://openstory.test/api/internal/inkos-session', {
        headers: {
          cookie: 'better-auth.session_token=opaque',
          authorization: 'Bearer must-not-be-forwarded',
        },
      })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('x-openstory-user-id')).toBe('user-1');
    expect(response.headers.get('x-openstory-team-id')).toBe('team-1');
    expect(response.headers.get('x-openstory-team-role')).toBe('member');
    expect(getSession).toHaveBeenCalledWith({
      headers: new Headers({ cookie: 'better-auth.session_token=opaque' }),
    });
  });

  it('rejects suspended users and users without a team', async () => {
    getSession.mockResolvedValueOnce({
      user: { id: 'user-1', status: 'suspended' },
    });
    expect(
      (
        await handleInkOSSessionRequest(
          new Request('https://openstory.test/api/internal/inkos-session', {
            headers: { cookie: 'session=one' },
          })
        )
      ).status
    ).toBe(401);

    getSession.mockResolvedValueOnce({
      user: { id: 'user-2', status: 'active' },
    });
    resolveUserTeam.mockResolvedValueOnce(null);
    expect(
      (
        await handleInkOSSessionRequest(
          new Request('https://openstory.test/api/internal/inkos-session', {
            headers: { cookie: 'session=two' },
          })
        )
      ).status
    ).toBe(403);
  });
});
