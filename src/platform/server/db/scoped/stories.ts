import { and, desc, eq, lte, sql } from 'drizzle-orm';
import type { Database } from '@/platform/server/db/client';
import {
  storyChapters,
  storyProjects,
  storySegments,
  storySyncReceipts,
} from '@/platform/server/db/schema';
import { ulid } from 'ulid';

export type InkOSChapterSourceType = 'inkos-script' | 'inkos-interactive';

export type InkOSChapterSyncInput = {
  eventId: string;
  projectId: string;
  artifactKind: 'script' | 'interactive-film';
  revision: number;
  payloadHash: string;
  generatedBy?: string;
  chapters: Array<{
    sourceKey: string;
    title: string;
    markdown: string;
    contentHash: string;
    sourceUpdatedAt: string;
  }>;
};

export function createStorySyncMethods(db: Database, teamId: string) {
  async function getProject(projectId: string) {
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(
        and(eq(storyProjects.id, projectId), eq(storyProjects.teamId, teamId))
      )
      .limit(1);
    return project ?? null;
  }

  async function syncInkOSChapters(input: InkOSChapterSyncInput) {
    const project = await getProject(input.projectId);
    if (!project) return null;

    const [existingReceipt] = await db
      .select({ payloadHash: storySyncReceipts.payloadHash })
      .from(storySyncReceipts)
      .where(
        and(
          eq(storySyncReceipts.provider, 'inkos'),
          eq(storySyncReceipts.eventId, input.eventId)
        )
      )
      .limit(1);
    if (existingReceipt) {
      return {
        duplicate: true,
        conflict: existingReceipt.payloadHash !== input.payloadHash,
        project,
        chapters: [],
      };
    }

    const [latestArtifact] = await db
      .select({ revision: storySyncReceipts.revision })
      .from(storySyncReceipts)
      .where(
        and(
          eq(storySyncReceipts.provider, 'inkos'),
          eq(storySyncReceipts.projectId, input.projectId),
          eq(storySyncReceipts.artifactKind, input.artifactKind)
        )
      )
      .orderBy(desc(storySyncReceipts.revision))
      .limit(1);
    if (latestArtifact && latestArtifact.revision >= input.revision) {
      return { duplicate: true, conflict: false, project, chapters: [] };
    }

    const sourceType: InkOSChapterSourceType =
      input.artifactKind === 'script' ? 'inkos-script' : 'inkos-interactive';
    const [lastChapter] = await db
      .select({ chapterNumber: storyChapters.chapterNumber })
      .from(storyChapters)
      .where(eq(storyChapters.projectId, input.projectId))
      .orderBy(desc(storyChapters.chapterNumber))
      .limit(1);
    let nextChapterNumber = (lastChapter?.chapterNumber ?? 0) + 1;
    const existingRows = await db
      .select()
      .from(storyChapters)
      .where(
        and(
          eq(storyChapters.projectId, input.projectId),
          eq(storyChapters.sourceType, sourceType)
        )
      );
    const existingByKey = new Map(
      existingRows.map((chapter) => [chapter.sourceKey, chapter])
    );
    type BatchStatement = Parameters<Database['batch']>[0][number];
    const statements: BatchStatement[] = [];
    const now = new Date().toISOString();
    const incomingKeys = new Set(input.chapters.map((chapter) => chapter.sourceKey));

    for (const chapter of input.chapters) {
      const existing = existingByKey.get(chapter.sourceKey);
      const wordCount = chapter.markdown.replace(/\s/g, '').length;
      statements.push(
        db
          .insert(storyChapters)
          .values({
            id: existing?.id ?? ulid(),
            projectId: input.projectId,
            chapterNumber: existing?.chapterNumber ?? nextChapterNumber++,
            title: chapter.title,
            content: chapter.markdown,
            wordCount,
            generatedBy: input.generatedBy ?? 'InkOS',
            status: 'draft',
            sourceType,
            sourceKey: chapter.sourceKey,
            sourceRevision: input.revision,
            sourceHash: chapter.contentHash,
            sourceUpdatedAt: chapter.sourceUpdatedAt,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              storyChapters.projectId,
              storyChapters.sourceType,
              storyChapters.sourceKey,
            ],
            targetWhere: sql`${storyChapters.sourceKey} IS NOT NULL`,
            set: {
              title: chapter.title,
              content: chapter.markdown,
              wordCount,
              generatedBy: input.generatedBy ?? 'InkOS',
              status: 'draft',
              sourceRevision: input.revision,
              sourceHash: chapter.contentHash,
              sourceUpdatedAt: chapter.sourceUpdatedAt,
              updatedAt: now,
            },
            setWhere: lte(storyChapters.sourceRevision, input.revision),
          })
      );

      if (existing && existing.sourceHash !== chapter.contentHash) {
        statements.push(
          db
            .update(storySegments)
            .set({ status: 'stale', updatedAt: now })
            .where(
              and(
                eq(storySegments.projectId, input.projectId),
                eq(storySegments.chapterNumber, existing.chapterNumber)
              )
            )
        );
      }
    }

    for (const removed of existingRows.filter(
      (chapter) => chapter.sourceKey && !incomingKeys.has(chapter.sourceKey)
    )) {
      statements.push(
        db
          .update(storySegments)
          .set({ status: 'stale', updatedAt: now })
          .where(
            and(
              eq(storySegments.projectId, input.projectId),
              eq(storySegments.chapterNumber, removed.chapterNumber)
            )
          ),
        db.delete(storyChapters).where(eq(storyChapters.id, removed.id))
      );
    }

    const settings = project.settings ?? {};
    statements.push(
      db
        .update(storyProjects)
        .set({
          settings: {
            ...settings,
            inkos: settings.inkos
              ? {
                  ...settings.inkos,
                  status: 'ready',
                  error: undefined,
                  lastSyncAt: now,
                  lastArtifactKind: input.artifactKind,
                }
              : undefined,
          },
          updatedAt: now,
        })
        .where(eq(storyProjects.id, input.projectId)),
      db.insert(storySyncReceipts).values({
        provider: 'inkos',
        eventId: input.eventId,
        projectId: input.projectId,
        artifactKind: input.artifactKind,
        revision: input.revision,
        payloadHash: input.payloadHash,
        receivedAt: now,
        appliedAt: now,
      })
    );

    await db.batch(statements as [BatchStatement, ...BatchStatement[]]);
    const synced = await db
      .select()
      .from(storyChapters)
      .where(
        and(
          eq(storyChapters.projectId, input.projectId),
          eq(storyChapters.sourceType, sourceType)
        )
      );

    return { duplicate: false, conflict: false, project, chapters: synced };
  }

  return { getProject, syncInkOSChapters };
}
