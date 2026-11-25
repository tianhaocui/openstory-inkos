import { z } from 'zod';

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

export const inkOSSyncPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(1).max(200),
  binding: z.string().min(20).max(2_000),
  artifactKind: z.enum(['script', 'interactive-film']),
  revision: z.number().int().nonnegative(),
  payloadHash: z.string().min(16).max(128),
  generatedBy: z.string().max(200).optional(),
  chapters: z
    .array(
      z.object({
        sourceKey: z.string().min(1).max(200),
        title: z.string().min(1).max(200),
        markdown: z.string().min(1).max(2_000_000),
        contentHash: z.string().min(16).max(128),
        sourceUpdatedAt: z.iso.datetime(),
      })
    )
    .min(1)
    .max(500),
});

export type InkOSSyncPayload = z.infer<typeof inkOSSyncPayloadSchema>;

const inkOSBindingSchema = z.object({
  version: z.literal(1),
  projectId: z.string().min(1).max(200),
  teamId: z.string().min(1).max(200),
  userId: z.string().min(1).max(200),
  mode: z.enum(['script', 'interactive-film']),
  expiresAt: z.number().int().positive(),
});

export type InkOSBinding = z.infer<typeof inkOSBindingSchema>;

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0))
  );
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function signInkOSPayload(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
}): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(input.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${input.timestamp}.${input.rawBody}`)
  );
  return `v1=${toHex(signature)}`;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyInkOSPayloadSignature(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
  signature: string;
  nowSeconds?: number;
}): Promise<boolean> {
  const timestampSeconds = Number(input.timestamp);
  if (!Number.isInteger(timestampSeconds)) return false;
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return false;
  }
  const expected = await signInkOSPayload(input);
  return constantTimeEqual(expected, input.signature);
}

export async function createInkOSBindingToken(input: {
  secret: string;
  binding: InkOSBinding;
}): Promise<string> {
  const payload = base64UrlEncode(JSON.stringify(input.binding));
  const signature = await signInkOSPayload({
    secret: input.secret,
    timestamp: 'binding',
    rawBody: payload,
  });
  return `${payload}.${signature.slice(3)}`;
}

export async function verifyInkOSBindingToken(input: {
  secret: string;
  token: string;
  nowSeconds?: number;
}): Promise<InkOSBinding | null> {
  const [payload, providedSignature, ...rest] = input.token.split('.');
  if (!payload || !providedSignature || rest.length > 0) return null;
  const expected = await signInkOSPayload({
    secret: input.secret,
    timestamp: 'binding',
    rawBody: payload,
  });
  if (!constantTimeEqual(expected.slice(3), providedSignature)) return null;

  try {
    const binding = inkOSBindingSchema.parse(
      JSON.parse(base64UrlDecode(payload))
    );
    const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    return binding.expiresAt >= nowSeconds ? binding : null;
  } catch {
    return null;
  }
}
