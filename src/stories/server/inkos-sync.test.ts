import { describe, expect, it } from 'vitest';
import {
  createInkOSBindingToken,
  signInkOSPayload,
  verifyInkOSBindingToken,
  verifyInkOSPayloadSignature,
} from './inkos-sync';

describe('InkOS sync signatures', () => {
  it('accepts an intact request inside the replay window', async () => {
    const timestamp = '1700000000';
    const rawBody = JSON.stringify({ projectId: 'project-1' });
    const signature = await signInkOSPayload({
      secret: 'test-secret',
      timestamp,
      rawBody,
    });

    await expect(
      verifyInkOSPayloadSignature({
        secret: 'test-secret',
        timestamp,
        rawBody,
        signature,
        nowSeconds: 1700000010,
      })
    ).resolves.toBe(true);
  });

  it('rejects tampering and stale timestamps', async () => {
    const timestamp = '1700000000';
    const signature = await signInkOSPayload({
      secret: 'test-secret',
      timestamp,
      rawBody: '{}',
    });

    await expect(
      verifyInkOSPayloadSignature({
        secret: 'test-secret',
        timestamp,
        rawBody: '{"changed":true}',
        signature,
        nowSeconds: 1700000010,
      })
    ).resolves.toBe(false);
    await expect(
      verifyInkOSPayloadSignature({
        secret: 'test-secret',
        timestamp,
        rawBody: '{}',
        signature,
        nowSeconds: 1700001000,
      })
    ).resolves.toBe(false);
  });
});

describe('InkOS project bindings', () => {
  it('round-trips a signed, unexpired binding', async () => {
    const token = await createInkOSBindingToken({
      secret: 'test-secret',
      binding: {
        version: 1,
        projectId: 'project-1',
        teamId: 'team-1',
        userId: 'user-1',
        mode: 'script',
        expiresAt: 1700000600,
      },
    });

    await expect(
      verifyInkOSBindingToken({
        secret: 'test-secret',
        token,
        nowSeconds: 1700000000,
      })
    ).resolves.toMatchObject({ projectId: 'project-1', teamId: 'team-1' });
  });

  it('rejects expired and tampered bindings', async () => {
    const token = await createInkOSBindingToken({
      secret: 'test-secret',
      binding: {
        version: 1,
        projectId: 'project-1',
        teamId: 'team-1',
        userId: 'user-1',
        mode: 'interactive-film',
        expiresAt: 1700000100,
      },
    });

    await expect(
      verifyInkOSBindingToken({
        secret: 'test-secret',
        token,
        nowSeconds: 1700000200,
      })
    ).resolves.toBeNull();
    await expect(
      verifyInkOSBindingToken({
        secret: 'test-secret',
        token: `${token}x`,
        nowSeconds: 1700000000,
      })
    ).resolves.toBeNull();
  });
});
