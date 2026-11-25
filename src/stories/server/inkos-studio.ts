import { getEnv } from '#env';
import { z } from 'zod';

const inkOSBookSummarySchema = z.object({
  id: z.unknown().optional(),
  title: z.unknown().optional(),
});

const inkOSBooksResponseSchema = z.object({
  books: z.array(inkOSBookSummarySchema).optional(),
});

const inkOSCreateBookResponseSchema = z.object({
  bookId: z.unknown().optional(),
});

export type InkOSBookLink = {
  bookId: string;
  studioUrl: string;
  status: 'creating' | 'ready' | 'unavailable';
  error?: string;
};

const DEFAULT_STUDIO_URL = 'https://creation.dakalami.com/inkos';

function readEnv(name: string): string | undefined {
  const value = (getEnv() as Record<string, unknown>)[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getInkOSStudioUrl(): string {
  return (
    readEnv('INKOS_STUDIO_URL') ??
    readEnv('VITE_INKOS_STUDIO_URL') ??
    DEFAULT_STUDIO_URL
  ).replace(/\/$/, '');
}

export function normalizeInkOSBookId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30);
}

export function buildInkOSBookUrl(studioUrl: string, bookId: string): string {
  return `${studioUrl.replace(/\/$/, '')}/#/book/${encodeURIComponent(bookId)}`;
}

async function findExistingBook(apiUrl: string, title: string, bookId: string) {
  const response = await fetch(`${apiUrl}/books`);
  if (!response.ok) return undefined;

  const rawPayload: unknown = await response.json();
  // The old code dereferenced the JSON value directly, so a null body threw.
  // Keep that path: the caller's try/catch turns it into "unavailable".
  if (rawPayload === null) {
    throw new TypeError("Cannot read properties of null (reading 'books')");
  }
  const parsed = inkOSBooksResponseSchema.safeParse(rawPayload);
  const books =
    parsed.success && Array.isArray(parsed.data.books) ? parsed.data.books : [];
  const match = books.find(
    (book) =>
      book.id === bookId ||
      (book.title === title && typeof book.id === 'string')
  );
  return typeof match?.id === 'string' ? match.id : undefined;
}

/**
 * Creates the canonical screenplay container in InkOS Studio.
 * OpenStory keeps the team/project wrapper; InkOS owns the book files and writing UI.
 */
export async function createOrReuseInkOSBook(input: {
  title: string;
  description?: string | null;
  genre?: string;
  targetLength?: number;
}): Promise<InkOSBookLink> {
  const studioUrl = getInkOSStudioUrl();
  const apiUrl = `${studioUrl}/api/v1`;
  const bookId = normalizeInkOSBookId(input.title);
  const targetChapters = Math.max(
    1,
    Math.round((input.targetLength ?? 100000) / 3000)
  );

  try {
    const response = await fetch(`${apiUrl}/books/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        genre: input.genre || 'other',
        language: 'zh',
        platform: 'other',
        targetChapters,
        chapterWordCount: 3000,
        blurb: input.description || undefined,
      }),
    });

    if (response.ok) {
      const rawPayload: unknown = await response.json();
      if (rawPayload === null) {
        throw new TypeError(
          "Cannot read properties of null (reading 'bookId')"
        );
      }
      const parsed = inkOSCreateBookResponseSchema.safeParse(rawPayload);
      const createdBookId =
        parsed.success && typeof parsed.data.bookId === 'string'
          ? parsed.data.bookId
          : bookId;
      return { bookId: createdBookId, studioUrl, status: 'creating' };
    }

    if (response.status === 409) {
      const existingBookId = await findExistingBook(
        apiUrl,
        input.title,
        bookId
      );
      if (existingBookId) {
        return { bookId: existingBookId, studioUrl, status: 'ready' };
      }
    }

    return {
      bookId,
      studioUrl,
      status: 'unavailable',
      error: `InkOS 暂时无法创建剧本（HTTP ${response.status}）`,
    };
  } catch {
    return {
      bookId,
      studioUrl,
      status: 'unavailable',
      error: 'InkOS 工作台暂时无法连接，仍可稍后重试',
    };
  }
}
